'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MessageSquare, Loader2, ThumbsUp, ThumbsDown, HelpCircle, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FeedbackRow {
  id: string;
  request_id: string;
  feedback_type: string;
  comment: string | null;
  created_at: string;
}

const feedbackIcons: Record<string, React.ReactNode> = {
  looks_correct: <ThumbsUp size={14} className="text-emerald-600" />,
  incorrect: <ThumbsDown size={14} className="text-red-600" />,
  not_sure: <HelpCircle size={14} className="text-amber-600" />,
  request_expert_review: <Users size={14} className="text-purple-600" />,
};

const feedbackLabels: Record<string, string> = {
  looks_correct: 'Looks correct',
  incorrect: 'Incorrect',
  not_sure: 'Not sure',
  request_expert_review: 'Expert review requested',
};

export default function AdminIdentificationFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('identification_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setFeedback((data || []) as FeedbackRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/identification" className="hover:text-foreground">Identification</Link>
          <ChevronRight size={12} />
          <span>Feedback</span>
        </div>

        <h1 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          <MessageSquare size={18} className="text-ocean-600" />
          User Feedback
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No feedback yet.</div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Request</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Comment</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {feedback.map((fb) => (
                  <tr key={fb.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {feedbackIcons[fb.feedback_type]}
                        <span className="text-foreground">{feedbackLabels[fb.feedback_type] || fb.feedback_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Link href={`/identify/${fb.request_id}`} className="text-primary hover:underline font-mono text-xs">
                        {fb.request_id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fb.comment || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{new Date(fb.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
