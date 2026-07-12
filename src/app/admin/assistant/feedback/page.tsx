'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThumbsUp, ThumbsDown, ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface FeedbackItem {
  id: string;
  feedback_type: string;
  reason?: string;
  comment?: string;
  created_at: string;
  message_id: string;
}

const FEEDBACK_COLORS: Record<string, string> = {
  helpful: 'bg-emerald-50 text-emerald-700',
  not_helpful: 'bg-red-50 text-red-700',
  incorrect: 'bg-red-50 text-red-700',
  missing_information: 'bg-amber-50 text-amber-700',
  outdated_information: 'bg-amber-50 text-amber-700',
  citation_problem: 'bg-orange-50 text-orange-700',
  other: 'bg-muted text-muted-foreground',
};

export default function AdminAssistantFeedbackPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant/feedback');
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) router.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return;
    const supabase = createClient();
    supabase
      .from('assistant_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setFeedback(data || []);
        setFetching(false);
      });
  }, [profile]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const positiveCount = feedback.filter(f => f.feedback_type === 'helpful').length;
  const negativeCount = feedback.filter(f => f.feedback_type !== 'helpful').length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ThumbsUp size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">User Feedback</h1>
              <p className="text-xs text-muted-foreground">{positiveCount} positive · {negativeCount} negative</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <ThumbsUp size={20} className="text-emerald-600" />
              <div>
                <p className="text-2xl font-bold text-emerald-700">{positiveCount}</p>
                <p className="text-xs text-emerald-600">Helpful</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <ThumbsDown size={20} className="text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{negativeCount}</p>
                <p className="text-xs text-red-600">Needs improvement</p>
              </div>
            </div>
          </div>

          {fetching ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comment</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {feedback.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_COLORS[f.feedback_type] || FEEDBACK_COLORS.other}`}>
                          {f.feedback_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{f.message_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{f.comment || f.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feedback.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No feedback yet</div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
