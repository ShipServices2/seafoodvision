'use server';

import { createClient } from '@/lib/supabase/server';
import { runIdentificationEngine, saveCandidates } from '@/lib/identification/engine';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    if (!requestId) {
      return NextResponse.json({ error: 'requestId required' }, { status: 400 });
    }

    // Verify ownership
    const { data: req } = await supabase
      .from('identification_requests')
      .select('id, user_id, status, checksum')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.user_id && user?.id !== req.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log(`[analyze/route] requestId=${requestId} | existingChecksum=${req.checksum ?? 'none'} | userId=${user?.id ?? 'anonymous'}`);

    // Update status to analyzing
    await supabase
      .from('identification_requests')
      .update({ status: 'analyzing' })
      .eq('id', requestId);

    // Run engine — pass userId for credit debit
    const result = await runIdentificationEngine(
      requestId,
      {
        categoryHint,
        stateHint,
        contextHint,
        countryHint,
        notes,
      },
      user?.id ?? null
    );

    console.log(`[analyze/route] Engine result | fromCache=${result.fromCache} | candidateCount=${result.candidates.length} | seafoodDetected=${result.seafoodDetected} | status=${result.status}`);

    // Always save candidates — replaces any old mock-era candidates for this request.
    // saveCandidates deletes existing rows before inserting, so re-analysis always
    // reflects the latest OpenAI result rather than accumulating stale data.
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
        model: result.visualAI.model ?? null,
      },
      created_by: user?.id || null,
    });

    return NextResponse.json({
      status: result.status,
      candidateCount: result.candidates.length,
      visualAI: result.visualAI,
      fromCache: result.fromCache,
      seafoodDetected: result.seafoodDetected,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analyze/route] Unhandled error (no credits debited):', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
