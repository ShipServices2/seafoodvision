'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Brain, Clock, Layers, TrendingUp, ArrowRight, Database, BarChart2, AlertTriangle, Target } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface AIStats {
  totalJobs: number;
  pending: number;
  processing: number;
  candidatesReady: number;
  approved: number;
  rejected: number;
  unknown: number;
  ignored: number;
  avgGlobalConfidence: number;
  todayValidations: number;
  validatedSpecies: number;
  rejectedSpecies: number;
  loading: boolean;
}

const SECTIONS = [
  {
    href: '/admin/ai-identification/queue',
    icon: Clock,
    label: 'Pending Queue',
    desc: 'Assets awaiting AI identification — Identify, Report, Ignore',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    badge: null as string | null,
  },
  {
    href: '/admin/ai-identification/review',
    icon: Target,
    label: 'Identification Review',
    desc: 'Top 5 candidates per asset — Approve, Reject, Replace, Unknown',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    badge: null as string | null,
  },
  {
    href: '/admin/ai-identification/bulk',
    icon: Layers,
    label: 'Bulk Identification',
    desc: 'Process 50 / 100 / 250 / 500 assets — mass validation workflow',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    iconColor: 'text-violet-600',
    badge: null as string | null,
  },
  {
    href: '/admin/ai-identification/analytics',
    icon: BarChart2,
    label: 'Analytics & Dashboard',
    desc: 'Accuracy, top reviewers, top species, progression',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
    badge: null as string | null,
  },
];

export default function AIIdentificationPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AIStats>({
    totalJobs: 0, pending: 0, processing: 0, candidatesReady: 0,
    approved: 0, rejected: 0, unknown: 0, ignored: 0,
    avgGlobalConfidence: 0, todayValidations: 0, validatedSpecies: 0,
    rejectedSpecies: 0, loading: true,
  });

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-identification'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'candidates_ready'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'unknown'),
      supabase.from('ai_identification_jobs').select('*', { count: 'exact', head: true }).eq('status', 'ignored'),
      supabase.from('ai_identification_jobs').select('global_confidence').not('global_confidence', 'is', null).limit(200),
      supabase.from('ai_validation_history').select('*', { count: 'exact', head: true }).gte('created_at', today),
    ]).then(([total, pending, processing, ready, approved, rejected, unknown, ignored, conf, todayV]) => {
      const confData = conf.data ?? [];
      const avg = confData.length > 0
        ? Math.round(confData.reduce((s: number, r: { global_confidence: number }) => s + (r.global_confidence ?? 0), 0) / confData.length)
        : 0;
      setStats({
        totalJobs: total.count ?? 0,
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        candidatesReady: ready.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
        unknown: unknown.count ?? 0,
        ignored: ignored.count ?? 0,
        avgGlobalConfidence: avg,
        todayValidations: todayV.count ?? 0,
        validatedSpecies: approved.count ?? 0,
        rejectedSpecies: rejected.count ?? 0,
        loading: false,
      });
    });
  }, [profile]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return null;

  const statCards = [
    { label: 'Total Jobs', value: stats.totalJobs, color: 'text-foreground' },
    { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
    { label: 'Candidates Ready', value: stats.candidatesReady, color: 'text-blue-600' },
    { label: 'Approved', value: stats.approved, color: 'text-emerald-600' },
    { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
    { label: 'Unknown', value: stats.unknown, color: 'text-gray-500' },
    { label: 'Avg Confidence', value: `${stats.avgGlobalConfidence}%`, color: 'text-secondary' },
    { label: "Today\'s Validations", value: stats.todayValidations, color: 'text-teal-600' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Brain size={18} className="text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">AI Identification Center</h1>
                <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full font-medium">Phase 8</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI-assisted species recognition — all proposals require human validation
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Admin
          </Link>
        </div>

        {/* Safety notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Human Validation Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The AI engine never publishes automatically. All suggestions are ranked Top 5 candidates.
              Every identification requires explicit reviewer approval before any data is updated.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        {!stats.loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            {statCards.map((s) => (
              <div key={s.label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className={`text-xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {!stats.loading && stats.totalJobs > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-secondary" />
                <span className="text-sm font-semibold text-foreground">Global Identification Progress</span>
              </div>
              <span className="text-sm font-mono-data text-secondary">
                {stats.totalJobs > 0 ? Math.round(((stats.approved + stats.rejected + stats.unknown) / stats.totalJobs) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-secondary h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${stats.totalJobs > 0 ? Math.round(((stats.approved + stats.rejected + stats.unknown) / stats.totalJobs) * 100) : 0}%`
                }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{stats.approved} approved</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{stats.rejected} rejected</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />{stats.unknown} unknown</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{stats.pending} pending</span>
            </div>
          </div>
        )}

        {/* Section cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:border-secondary/30 hover:shadow-card transition-all duration-150"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon size={18} className={s.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm">{s.label}</h3>
                    {s.badge && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:text-secondary transition-colors" />
              </Link>
            );
          })}
        </div>

        {/* AI Provider + Knowledge Sources info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain size={14} className="text-secondary" />
              <h2 className="text-sm font-semibold text-foreground">AI Provider Layer</h2>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Mock Engine (Active)', model: 'seafood-vision-mock-v1', status: 'active' },
                { name: 'OpenAI', model: 'gpt-4o', status: 'pending_key' },
                { name: 'Google Gemini', model: 'gemini-1.5-pro', status: 'pending_key' },
                { name: 'Anthropic', model: 'claude-3-5-sonnet', status: 'pending_key' },
              ].map((p) => (
                <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono-data">{p.model}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === 'active' ?'bg-emerald-100 text-emerald-700 border border-emerald-200' :'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {p.status === 'active' ? 'Active' : 'Needs API Key'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database size={14} className="text-secondary" />
              <h2 className="text-sm font-semibold text-foreground">Knowledge Sources</h2>
            </div>
            <div className="space-y-2">
              {[
                { name: 'FishBase', url: 'fishbase.se', status: 'ready' },
                { name: 'WoRMS', url: 'marinespecies.org', status: 'ready' },
                { name: 'FAO ASFIS', url: 'fao.org/fishery', status: 'ready' },
                { name: 'Catalogue of Life', url: 'catalogueoflife.org', status: 'ready' },
                { name: 'GBIF', url: 'gbif.org', status: 'ready' },
              ].map((src) => (
                <div key={src.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{src.name}</p>
                    <p className="text-xs text-muted-foreground">{src.url}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    Enrichment Only
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
