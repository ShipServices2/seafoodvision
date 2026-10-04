'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Circle as HelpCircle, ChevronLeft, Globe, CircleAlert as AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface UnansweredQuestion {
  id: string;
  normalized_question: string;
  locale: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: string;
  failure_reason?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  assigned: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  wont_fix: 'bg-muted text-muted-foreground',
};

export default function AdminAssistantUnansweredPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<string>('open');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant/unanswered');
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) router.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return;
    const supabase = createClient();
    let q = supabase
      .from('assistant_unanswered_questions')
      .select('*')
      .order('occurrence_count', { ascending: false })
      .limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    q.then(({ data }) => {
      setQuestions(data || []);
      setFetching(false);
    });
  }, [profile, filter]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from('assistant_unanswered_questions').update({ status }).eq('id', id);
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, status } : q));
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <HelpCircle size={18} className="text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Unanswered Questions</h1>
                <p className="text-xs text-muted-foreground">Questions the assistant could not answer — knowledge gaps</p>
              </div>
            </div>
            <div className="flex gap-2">
              {['open', 'assigned', 'resolved', 'all'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {fetching ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16">
              <AlertCircle size={40} className="text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">No unanswered questions with status: {filter}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{q.normalized_question}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || STATUS_COLORS.open}`}>
                          {q.status}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe size={10} />
                          {q.locale.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {q.occurrence_count}× · Last: {formatDate(q.last_seen_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {q.status === 'open' && (
                        <>
                          <button onClick={() => updateStatus(q.id, 'assigned')} className="px-2 py-1 text-xs rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">Assign</button>
                          <button onClick={() => updateStatus(q.id, 'wont_fix')} className="px-2 py-1 text-xs rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">Skip</button>
                        </>
                      )}
                      {q.status === 'assigned' && (
                        <button onClick={() => updateStatus(q.id, 'resolved')} className="px-2 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">Resolve</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
