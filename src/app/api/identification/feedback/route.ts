'use server';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { requestId, feedbackType, candidateId, comment } = body;

    if (!requestId || !feedbackType) {
      return NextResponse.json({ error: 'requestId and feedbackType required' }, { status: 400 });
    }

    await supabase.from('identification_feedback').insert({
      request_id: requestId,
      candidate_id: candidateId || null,
      user_id: user?.id || null,
      feedback_type: feedbackType,
      comment: comment || null,
    });

    // If requesting expert review, update request status
    if (feedbackType === 'request_expert_review') {
      await supabase
        .from('identification_requests')
        .update({ status: 'human_review_requested' })
        .eq('id', requestId);

      await supabase.from('identification_reviews').insert({
        request_id: requestId,
        review_status: 'requested',
      });

      await supabase.from('identification_events').insert({
        request_id: requestId,
        event_type: 'human_review_requested',
        previous_status: 'candidates_ready',
        new_status: 'human_review_requested',
        created_by: user?.id || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
