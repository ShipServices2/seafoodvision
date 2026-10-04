'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ChartBar as BarChart2, TrendingUp, Users, Target, Clock, CircleCheck as CheckCircle2, Circle as XCircle, Circle as HelpCircle, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';


interface DashboardStats {
  totalJobs: number;
  queued: number;
  proposalsReady: number;
  validated: number;
  rejected: number;
  unknown: number;
  ignored: number;
  avgGlobalConfidence: number;
  avgVisionConfidence: number;
  avgSpeciesConfidence: number;
  avgCommercialConfidence: number;
  todayValidations: number;
  totalCandidates: number;
  validatedCandidates: number;
  loading: boolean;
}

interface TopSpecies {
  common_name: string;
  count: number;
}

export default function AIStudioAnalyticsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0, queued: 0, proposalsReady: 0, validated: 0, rejected: 0,
    unknown: 0, ignored: 0, avgGlobalConfidence: 0, avgVisionConfidence: 0,
    avgSpeciesConfidence: 0, avgCommercialConfidence: 0, todayValidations: 0,
    totalCandidates: 0, validatedCandidates: 0, loading: true,
  });
  const [topSpecies, setTopSpecies] = useState<TopSpecies[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; fill: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/analytics'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchStats = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const [total, queued, ready, validated, rejected, unknown, ignored, conf, todayV, candidates, validatedC] = await Promise.all([
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'queued'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'proposals_ready'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'validated'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'rejected'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'unknown'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'ignored'),
      supabase.from('sie_jobs').select('global_confidence, vision_confidence, species_confidence, commercial_confidence').not('global_confidence', 'is', null).limit(500),
      supabase.from('sie_validation_history').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('sie_species_candidates').select('*', { count: 'exact', head: true }),
      supabase.from('sie_species_candidates').select('*', { count: 'exact', head: true }).eq('is_validated', true),
    ]);

    const confData = conf.data ?? [];
    const avg = (key: string) => confData.length > 0
      ? Math.round(confData.reduce((s: number, r: Record<string, number>) => s + (r[key] ?? 0), 0) / confData.length)
      : 0;

    setStats({
      totalJobs: total.count ?? 0,
      queued: queued.count ?? 0,
      proposalsReady: ready.count ?? 0,
      validated: validated.count ?? 0,
      rejected: rejected.count ?? 0,
      unknown: unknown.count ?? 0,
      ignored: ignored.count ?? 0,
      avgGlobalConfidence: avg('global_confidence'),
      avgVisionConfidence: avg('vision_confidence'),
      avgSpeciesConfidence: avg('species_confidence'),
      avgCommercialConfidence: avg('commercial_confidence'),
      todayValidations: todayV.count ?? 0,
      totalCandidates: candidates.count ?? 0,
      validatedCandidates: validatedC.count ?? 0,
      loading: false,
    });

    setStatusData([
      { name: 'Validés', value: validated.count ?? 0, fill: '#10b981' },
      { name: 'Rejetés', value: rejected.count ?? 0, fill: '#ef4444' },
      { name: 'Inconnus', value: unknown.count ?? 0, fill: '#9ca3af' },
      { name: 'En attente', value: queued.count ?? 0, fill: '#f59e0b' },
      { name: 'Propositions', value: ready.count ?? 0, fill: '#6366f1' },
    ]);

    // Top species from candidates
    const { data: topData } = await supabase
      .from('sie_species_candidates')
      .select('common_name')
      .eq('is_validated', true)
      .limit(200);
    if (topData) {
      const counts: Record<string, number> = {};
      topData.forEach((r: { common_name: string }) => { counts[r.common_name] = (counts[r.common_name] ?? 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ common_name: name, count }));
      setTopSpecies(sorted);
    }
  }, [profile]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const validationRate = stats.totalJobs > 0
    ? Math.round(((stats.validated + stats.rejected + stats.unknown) / stats.totalJobs) * 100)
    : 0;

  const confidenceScores = [
    { label: 'Vision', value: stats.avgVisionConfidence, color: 'bg-blue-500' },
    { label: 'Species', value: stats.avgSpeciesConfidence, color: 'bg-violet-500' },
    { label: 'Commercial', value: stats.avgCommercialConfidence, color: 'bg-amber-500' },
    { label: 'Global', value: stats.avgGlobalConfidence, color: 'bg-secondary' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
              <BarChart2 size={18} className="text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">SIE Analytics</h1>
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Dashboard</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Statistiques du Seafood Intelligence Engine</p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
        </div>

        {/* KPI grid */}
        {!stats.loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Total Jobs', value: stats.totalJobs, icon: Zap, color: 'text-foreground' },
              { label: 'Validés', value: stats.validated, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'Rejetés', value: stats.rejected, icon: XCircle, color: 'text-red-500' },
              { label: 'Inconnus', value: stats.unknown, icon: HelpCircle, color: 'text-gray-500' },
              { label: "Aujourd'hui", value: stats.todayValidations, icon: Clock, color: 'text-teal-600' },
              { label: 'Taux validation', value: `${validationRate}%`, icon: Target, color: 'text-secondary' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  <Icon size={16} className={`${s.color} mx-auto mb-1`} />
                  <p className={`text-2xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Status distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart2 size={14} className="text-secondary" />
              Distribution des statuts
            </h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <rect key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </div>

          {/* Confidence scores */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target size={14} className="text-secondary" />
              Scores de confiance moyens
            </h3>
            <div className="space-y-4">
              {confidenceScores.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground font-medium">{s.label} Confidence</span>
                    <span className="text-sm font-mono-data font-bold text-foreground">{s.value}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`${s.color} h-2 rounded-full transition-all duration-700`}
                      style={{ width: `${s.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-bold font-mono-data text-foreground">{stats.totalCandidates}</p>
                <p className="text-xs text-muted-foreground">Total candidats</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono-data text-emerald-600">{stats.validatedCandidates}</p>
                <p className="text-xs text-muted-foreground">Candidats validés</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top species */}
        {topSpecies.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-secondary" />
              Top espèces validées
            </h3>
            <div className="space-y-2">
              {topSpecies.map((s, i) => (
                <div key={s.common_name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-foreground">{s.common_name}</span>
                      <span className="text-xs font-mono-data text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-teal-400 to-blue-400 h-1.5 rounded-full"
                        style={{ width: `${topSpecies[0] ? (s.count / topSpecies[0].count) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Architecture note */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users size={14} className="text-secondary" />
            Architecture SIE — Compatibilité
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {['608 actifs', '5 314 actifs', 'Centaines de milliers', 'Marketplace', 'Metadata Review', 'Species Center', 'Encyclopedia', 'Smart Search', 'Library', 'API', 'OpenAI', 'Gemini'].map((t) => (
              <span key={t} className="text-xs bg-muted text-muted-foreground border border-border px-2 py-1.5 rounded-lg text-center">
                {t}
              </span>
            ))}
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
