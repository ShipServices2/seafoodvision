import { createClient } from '@/lib/supabase/server';
import { runIdentificationEngine, saveCandidates, InsufficientCreditsError } from '@/lib/identification/engine';
import { NextRequest, NextResponse } from 'next/server';

// Disable Next.js route cache for this endpoint — always run fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  console.log('\n══════════════════════════════════════════════════');
  console.log('[analyze/route] ▶ POST /api/identification/analyze');
  console.log(`[analyze/route] timestamp=${new Date().toISOString()}`);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      requestId,
      categoryHint,
      stateHint,
      contextHint,
      countryHint,
      notes,
    } = body;

    console.log(`[analyze/route] requestId=${requestId} | userId=${user?.id ?? 'anonymous'}`);
    console.log(`[analyze/route] hints: category=${categoryHint ?? '-'} state=${stateHint ?? '-'} context=${contextHint ?? '-'} country=${countryHint ?? '-'}`);

    if (!requestId) {
      return NextResponse.json({ error: 'requestId required' }, { status: 400 });
    }

    // Verify ownership and fetch upload metadata
    const { data: req } = await supabase
      .from('identification_requests')
      .select('id, user_id, status, checksum, upload_path, file_size, media_type')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.user_id && user?.id !== req.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log(`[analyze/route] DB record | uploadPath=${req.upload_path ?? 'NONE'} | fileSize=${req.file_size ?? 'unknown'} bytes | existingChecksum=${req.checksum ?? 'none'}`);

    // Warn if no upload path — OpenAI cannot be called without the image
    if (!req.upload_path) {
      console.warn('[analyze/route] ⚠ upload_path is NULL — image was not stored in Supabase Storage. OpenAI Vision will NOT be called.');
    }

    // Update status to analyzing
    await supabase
      .from('identification_requests')
      .update({ status: 'analyzing' })
      .eq('id', requestId);

    // Run engine
    let result;
    try {
      result = await runIdentificationEngine(
        requestId,
        { categoryHint, stateHint, contextHint, countryHint, notes },
        user?.id ?? null
      );
    } catch (engineErr: unknown) {
      if (engineErr instanceof InsufficientCreditsError) {
        console.warn(`[analyze/route] ✗ Insufficient credits for userId=${user?.id ?? 'anonymous'}`);
        await supabase
          .from('identification_requests')
          .update({ status: 'insufficient_quality' })
          .eq('id', requestId);
        return NextResponse.json(
          { error: engineErr.message, code: 'INSUFFICIENT_CREDITS', creditsRequired: 2 },
          { status: 402 }
        );
      }
      throw engineErr;
    }

    // ── Detailed result logging ──────────────────────────────────────────────
    const openAICalled = result.visualAI.enabled && !result.fromCache;
    const candidateNames = result.candidates
      .map((c) => `${c.species?.scientificName ?? c.species?.commonName ?? 'unknown'} (${c.confidenceScore ?? c.confidenceLevel})`)
      .join(' | ');

    console.log(`[analyze/route] ── RESULT SUMMARY ──────────────────────────`);
    console.log(`[analyze/route] fromCache=${result.fromCache}`);
    console.log(`[analyze/route] OpenAI called=${openAICalled}`);
    console.log(`[analyze/route] OpenAI model=${result.visualAI.model ?? 'n/a'}`);
    console.log(`[analyze/route] seafoodDetected=${result.seafoodDetected}`);
    console.log(`[analyze/route] status=${result.status}`);
    console.log(`[analyze/route] candidateCount=${result.candidates.length}`);
    console.log(`[analyze/route] candidates=[${candidateNames || 'none'}]`);
    console.log(`[analyze/route] visualAI.message=${result.visualAI.message}`);
    console.log(`[analyze/route] elapsed=${Date.now() - routeStart}ms`);
    console.log('══════════════════════════════════════════════════\n');

    // Save candidates — always replaces old ones
    await saveCandidates(requestId, result.candidates);

    // Update request status
    await supabase
      .from('identification_requests')
      .update({
        status: result.status,
        user_category_hint: categoryHint || null,
        user_state_hint: stateHint || null,
        user_context_hint: contextHint || null,
        user_country_hint: countryHint || null,
        user_notes: notes || null,
      })
      .eq('id', requestId);

    // Log event
    await supabase.from('identification_events').insert({
      request_id: requestId,
      event_type: 'analysis_completed',
      previous_status: 'analyzing',
      new_status: result.status,
      metadata: {
        candidate_count: result.candidates.length,
        from_cache: result.fromCache,
        seafood_detected: result.seafoodDetected,
        visual_ai_enabled: result.visualAI.enabled,
        openai_called: openAICalled,
        model: result.visualAI.model ?? null,
        elapsed_ms: Date.now() - routeStart,
      },
      created_by: user?.id || null,
    });

    return NextResponse.json({
      status: result.status,
      candidateCount: result.candidates.length,
      visualAI: result.visualAI,
      fromCache: result.fromCache,
      seafoodDetected: result.seafoodDetected,
      openAICalled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analyze/route] ✗ Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
