'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronLeft, TrendingUp, Clock, Globe, MessageSquare, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface AnalyticsData {
  totalConversations: number;
  totalQuestions: number;
  totalAnswers: number;
  unansweredOpen: number;
  feedbackPositive: number;
  feedbackNegative: number;
  avgLatencyMs: number;
  localeBreakdown: { locale: string; count: number }[];
  recentUsage: { date: string; count: number }[];
  loading: boolean;
}

export default function AdminAssistantAnalyticsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData>({
    totalConversations: 0, totalQuestions: 0, totalAnswers: 0,
    unansweredOpen: 0, feedbackPositive: 0, feedbackNegative: 0,
    avgLatencyMs: 0, localeBreakdown: [], recentUsage: [], loading: true,
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant/analytics');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) router.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('assistant_conversations').select('*', { count: 'exact', head: true }),
      supabase.from('assistant_messages').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('assistant_messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant'),
      supabase.from('assistant_unanswered_questions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('assistant_feedback').select('*', { count: 'exact', head: true }).eq('feedback_type', 'helpful'),
      supabase.from('assistant_feedback').select('*', { count: 'exact', head: true }).neq('feedback_type', 'helpful'),
      supabase.from('assistant_usage_events').select('latency_ms').eq('success', true).limit(200),
      supabase.from('assistant_conversations').select('locale').limit(500),
    ]).then(([conv, questions, answers, unanswered, pos, neg, usage, locales]) => {
      const latencies = (usage.data || []).map((e: any) => e.latency_ms).filter(Boolean);
      const avg = latencies.length > 0 ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;

      const localeCounts: Record<string, number> = {};
      (locales.data || []).forEach((c: any) => {
        localeCounts[c.locale] = (localeCounts[c.locale] || 0) + 1;
      });
      const localeBreakdown = Object.entries(localeCounts)
        .map(([locale, count]) => ({ locale, count }))
        .sort((a, b) => b.count - a.count);

      setData({
        totalConversations: conv.count || 0,
        totalQuestions: questions.count || 0,
        totalAnswers: answers.count || 0,
        unansweredOpen: unanswered.count || 0,
        feedbackPositive: pos.count || 0,
        feedbackNegative: neg.count || 0,
        avgLatencyMs: avg,
        localeBreakdown,
        recentUsage: [],
        loading: false,
      });
    });
  }, [profile]);

  const statCards = [
    { label: 'Conversations', value: data.totalConversations, icon: MessageSquare, color: 'text-primary bg-primary/10' },
    { label: 'Questions asked', value: data.totalQuestions, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Answers generated', value: data.totalAnswers, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Unanswered (open)', value: data.unansweredOpen, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Positive feedback', value: data.feedbackPositive, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Avg response time', value: data.avgLatencyMs ? `${data.avgLatencyMs}ms` : '—', icon: Clock, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart2 size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          </div>

          {data.loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {statCards.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-card border border-border rounded-xl p-5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                        <Icon size={16} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {data.localeBreakdown.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={16} className="text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Language breakdown</h2>
                  </div>
                  <div className="space-y-3">
                    {data.localeBreakdown.map((l) => {
                      const pct = data.totalConversations > 0 ? Math.round((l.count / data.totalConversations) * 100) : 0;
                      return (
                        <div key={l.locale} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-muted-foreground w-8 uppercase">{l.locale}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-12 text-right">{l.count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>Provider mode:</strong> retrieval_only — No external AI costs.
                  Model cost tracking will be available when an LLM provider is configured.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
