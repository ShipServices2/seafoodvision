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
      .select('id, user_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (req.user_id && user?.id !== req.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update status to analyzing
    await supabase
      .from('identification_requests')
      .update({ status: 'analyzing' })
      .eq('id', requestId);

    // Run engine
    const result = await runIdentificationEngine(requestId, {
      categoryHint,
      stateHint,
      contextHint,
      countryHint,
      notes,
    });

    // Save candidates
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
      metadata: { candidate_count: result.candidates.length },
      created_by: user?.id || null,
    });

    return NextResponse.json({
      status: result.status,
      candidateCount: result.candidates.length,
      visualAI: result.visualAI,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
