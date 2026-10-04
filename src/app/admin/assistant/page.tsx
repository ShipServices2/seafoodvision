'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, MessageSquare, ChartBar as BarChart2, CircleAlert as AlertCircle, ThumbsUp, ThumbsDown, Clock, TrendingUp, ChevronRight, Settings, Shield, Database, Circle as HelpCircle, Activity } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


interface AssistantAdminStats {
  totalConversations: number;
  totalMessages: number;
  unansweredOpen: number;
  feedbackPositive: number;
  feedbackNegative: number;
  avgLatencyMs: number;
  loading: boolean;
}

const adminNavLinks = [
  { href: '/admin/assistant/conversations', label: 'Conversations', icon: MessageSquare, desc: 'All user conversations' },
  { href: '/admin/assistant/feedback', label: 'Feedback', icon: ThumbsUp, desc: 'User feedback on answers' },
  { href: '/admin/assistant/unanswered', label: 'Unanswered', icon: HelpCircle, desc: 'Questions without answers' },
  { href: '/admin/assistant/sources', label: 'Sources', icon: Database, desc: 'Source citation analysis' },
  { href: '/admin/assistant/analytics', label: 'Analytics', icon: BarChart2, desc: 'Usage statistics' },
  { href: '/admin/assistant/safety', label: 'Safety', icon: Shield, desc: 'Injection attempts & blocks' },
  { href: '/admin/assistant/settings', label: 'Settings', icon: Settings, desc: 'Provider & quota config' },
];

export default function AdminAssistantPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AssistantAdminStats>({
    totalConversations: 0, totalMessages: 0, unansweredOpen: 0,
    feedbackPositive: 0, feedbackNegative: 0, avgLatencyMs: 0, loading: true,
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant');
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('assistant_conversations').select('*', { count: 'exact', head: true }),
      supabase.from('assistant_messages').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('assistant_unanswered_questions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('assistant_feedback').select('*', { count: 'exact', head: true }).eq('feedback_type', 'helpful'),
      supabase.from('assistant_feedback').select('*', { count: 'exact', head: true }).neq('feedback_type', 'helpful'),
      supabase.from('assistant_usage_events').select('latency_ms').eq('success', true).limit(100),
    ]).then(([conv, msgs, unanswered, pos, neg, usage]) => {
      const latencies = (usage.data || []).map((e: any) => e.latency_ms).filter(Boolean);
      const avg = latencies.length > 0 ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;
      setStats({
        totalConversations: conv.count || 0,
        totalMessages: msgs.count || 0,
        unansweredOpen: unanswered.count || 0,
        feedbackPositive: pos.count || 0,
        feedbackNegative: neg.count || 0,
        avgLatencyMs: avg,
        loading: false,
      });
    });
  }, [profile]);

  if (loading || stats.loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-16 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  const statCards = [
    { label: 'Conversations', value: stats.totalConversations, icon: MessageSquare, color: 'text-primary bg-primary/10' },
    { label: 'User Questions', value: stats.totalMessages, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Unanswered', value: stats.unansweredOpen, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Positive Feedback', value: stats.feedbackPositive, icon: ThumbsUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Negative Feedback', value: stats.feedbackNegative, icon: ThumbsDown, color: 'text-red-600 bg-red-50' },
    { label: 'Avg Latency', value: stats.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '—', icon: Clock, color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Admin
              </Link>
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-ocean-600 flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">AI Knowledge Assistant</h1>
                  <p className="text-xs text-muted-foreground">Phase 5.4 — Administration</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Activity size={11} />
                retrieval_only
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                    <Icon size={15} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminNavLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-150 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
