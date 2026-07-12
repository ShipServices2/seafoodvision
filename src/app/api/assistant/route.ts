import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveContext, retrieveMedia, retrieveForComparison } from '@/lib/assistant/retrieval';
import {
  detectInjection,
  detectLanguage,
  isMediaQuery,
  isComparisonQuery,
  buildStructuredResponse,
  buildInjectionRefusal,
  buildComparisonResponse,
} from '@/lib/assistant/responseBuilder';
import type { AssistantQueryRequest } from '@/lib/assistant/types';

// ============================================================
// PHASE 5.4 — ASSISTANT API ROUTE (Server-side only)
// AI_PROVIDER=retrieval_only by default
// Never exposes API keys, never calls models from browser
// ============================================================

const GUEST_DAILY_LIMIT = parseInt(process.env.AI_DAILY_GUEST_LIMIT || '5', 10);
const MEMBER_DAILY_LIMIT = parseInt(process.env.AI_DAILY_MEMBER_LIMIT || '50', 10);
const ASSISTANT_ENABLED = process.env.AI_ASSISTANT_ENABLED !== 'false';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  if (!ASSISTANT_ENABLED) {
    return NextResponse.json(
      { error: 'Assistant is temporarily unavailable.' },
      { status: 503 }
    );
  }

  let body: AssistantQueryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { question, conversation_id, locale: reqLocale, anonymous_session_id } = body;

  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
  }

  if (question.length > 1000) {
    return NextResponse.json({ error: 'Question too long.' }, { status: 400 });
  }

  // ---- Injection protection ----
  if (detectInjection(question)) {
    const locale = reqLocale || detectLanguage(question);
    let structured_content = buildInjectionRefusal(locale);
    return NextResponse.json({
      conversation_id: conversation_id || null,
      message_id: null,
      structured_content,
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ---- Rate limiting ----
  const limit = user ? MEMBER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const sessionKey = user?.id || anonymous_session_id || 'unknown';
  const today = new Date().toISOString().split('T')[0];

  const { count: usageCount } = await supabase
    .from('assistant_usage_events')
    .select('*', { count: 'exact', head: true })
    .eq(user ? 'user_id' : 'anonymous_session_id', sessionKey)
    .gte('created_at', `${today}T00:00:00Z`);

  if ((usageCount || 0) >= limit) {
    return NextResponse.json(
      {
        error: user
          ? `Daily limit of ${limit} questions reached. Please try again tomorrow.`
          : `Guest limit of ${limit} questions per day reached. Sign in for more.`,
        limit_reached: true,
      },
      { status: 429 }
    );
  }

  const locale = reqLocale || detectLanguage(question);

  // ---- Get or create conversation ----
  let convId = conversation_id;
  if (!convId) {
    const convData: any = {
      locale,
      status: 'active',
      context_entities: [],
    };
    if (user) convData.user_id = user.id;
    else if (anonymous_session_id) convData.anonymous_session_id = anonymous_session_id;

    const { data: newConv } = await supabase
      .from('assistant_conversations')
      .insert(convData)
      .select('id')
      .single();
    convId = newConv?.id;
  }

  // ---- Save user message ----
  const { data: userMsg } = await supabase
    .from('assistant_messages')
    .insert({
      conversation_id: convId,
      role: 'user',
      content: question,
      provider_mode: 'retrieval_only',
    })
    .select('id')
    .single();

  // ---- Retrieve context ----
  let structured_content;
  try {
    if (isComparisonQuery(question)) {
      // Extract comparison terms
      const terms = extractComparisonTerms(question);
      const entityGroups = await retrieveForComparison(terms, locale);
      structured_content = buildComparisonResponse(terms, entityGroups, locale);
    } else if (isMediaQuery(question)) {
      const media = await retrieveMedia(question, locale);
      const ctx = await retrieveContext(question, locale);
      ctx.media = media;
      structured_content = buildStructuredResponse(ctx, locale);
      structured_content.answer_type = 'media';
    } else {
      const ctx = await retrieveContext(question, locale);
      structured_content = buildStructuredResponse(ctx, locale);
    }
  } catch (err) {
    console.error('Assistant retrieval error:', err);
    structured_content = buildInjectionRefusal(locale);
  }

  // ---- Save assistant message ----
  const { data: assistantMsg } = await supabase
    .from('assistant_messages')
    .insert({
      conversation_id: convId,
      role: 'assistant',
      content: structured_content.answer,
      structured_content,
      confidence_level: structured_content.confidence_level,
      provider_mode: 'retrieval_only',
    })
    .select('id')
    .single();

  // ---- Save sources ----
  if (structured_content.sources.length > 0 && assistantMsg?.id) {
    const sourceRows = structured_content.sources.map((s, i) => ({
      message_id: assistantMsg.id,
      source_type: s.source_type,
      source_id: s.source_id,
      source_title: s.source_title,
      source_url: s.source_url,
      relevance_score: s.relevance_score || 1.0,
      citation_order: i + 1,
    }));
    await supabase.from('assistant_message_sources').insert(sourceRows);
  }

  // ---- Track unanswered ----
  if (structured_content.answer_type === 'no_data') {
    await supabase.rpc('assistant_upsert_unanswered', {
      p_question: question.toLowerCase().trim(),
      p_locale: locale,
    }).catch(() => {});
  }

  // ---- Log usage ----
  const latency = Date.now() - startTime;
  await supabase.from('assistant_usage_events').insert({
    user_id: user?.id || null,
    anonymous_session_id: anonymous_session_id || null,
    event_type: 'query',
    model_provider: 'retrieval_only',
    latency_ms: latency,
    success: true,
  });

  // ---- Update conversation title ----
  if (!conversation_id && convId) {
    const title = question.slice(0, 80);
    await supabase
      .from('assistant_conversations')
      .update({ title })
      .eq('id', convId);
  }

  return NextResponse.json({
    conversation_id: convId,
    message_id: assistantMsg?.id,
    structured_content,
  });
}

function extractComparisonTerms(question: string): string[] {
  // Try "X vs Y" or "X and Y" or "compare X and Y"
  const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i);
  if (vsMatch) return [vsMatch[1].trim(), vsMatch[2].trim()];
  const andMatch = question.match(/compare\s+(.+?)\s+and\s+(.+)/i);
  if (andMatch) return [andMatch[1].trim(), andMatch[2].trim()];
  const frMatch = question.match(/comparer?\s+(.+?)\s+et\s+(.+)/i);
  if (frMatch) return [frMatch[1].trim(), frMatch[2].trim()];
  // Fallback: split by comma
  const parts = question.split(/,|;/).map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(0, 3) : [question];
}
