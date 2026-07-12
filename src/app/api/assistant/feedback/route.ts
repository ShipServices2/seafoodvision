import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message_id, feedback_type, reason, comment } = await req.json();
  if (!message_id || !feedback_type) {
    return NextResponse.json({ error: 'message_id and feedback_type required' }, { status: 400 });
  }

  const { error } = await supabase.from('assistant_feedback').insert({
    user_id: user.id,
    message_id,
    feedback_type,
    reason: reason || null,
    comment: comment || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
