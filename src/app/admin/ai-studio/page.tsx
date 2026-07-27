'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Brain, Zap, Layers, Eye, CircleCheck as CheckCircle2, ChartBar as BarChart2, TriangleAlert as AlertTriangle, Database, Cpu, TrendingUp, Sparkles, ArrowRight, Fish, Target, SquareCheck as CheckSquare, Star, Globe, RefreshCw, Upload } from 'lucide-react';

interface SIEStats {
  totalJobs: number;
  queued: number;
  proposalsReady: number;
  validated: number;
  rejected: number;
  unknown: number;
  ignored: number;
  avgConfidence: number;
  todayValidations: number;
  loading: boolean;
}

interface AssetStats {
  total: number;
  withoutSpecies: number;
  underReview: number;
  approved: number;
  loading: boolean;
}

const PIPELINE_STEPS = [
  { key: 'analyse', label: 'Analyse Vision', icon: Eye, color: 'text-blue-500' },
  { key: 'species', label: 'Recherche espèces', icon: Fish, color: 'text-teal-500' },
  { key: 'taxonomy', label: 'Recherche taxonomique', icon: Database, color: 'text-violet-500' },
  { key: 'commercial', label: 'Recherche commerciale', icon: Globe, color: 'text-amber-500' },
  { key: 'metadata', label: 'Construction métadonnées', icon: Cpu, color: 'text-orange-500' },
  { key: 'candidates', label: 'Top 5 candidats', icon: Star, color: 'text-pink-500' },
  { key: 'done', label: 'Terminé', icon: CheckCircle2, color: 'text-emerald-500' },
];

const WORKFLOW_STEPS = [
  { label: 'Assets', desc: 'Table assets Supabase', icon: Database, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'Sélection', desc: 'Galerie + filtres', icon: CheckSquare, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { label: 'Identify With AI', desc: 'Mock Engine / IA', icon: Brain, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { label: 'AI Processing Queue', desc: 'Pipeline 7 étapes', icon: Zap, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'AI Species Proposals', desc: 'Top 5 par actif', icon: Star, color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { label: 'Metadata Review Center', desc: 'Pending Review', icon: Eye, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { label: 'Validation humaine', desc: 'Approve / Reject', icon: Target, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { label: 'Propagation', desc: 'Library · Species · Encyclopedia', icon: Globe, color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const STUDIO_MODULES = [
  {
    href: '/admin/ai-studio/identify',
    icon: Brain,
    label: 'Identify with AI',
    desc: 'Galerie assets · Filtres · Sélection · Pipeline · Propositions',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    iconBg: 'bg-violet-100',
    badge: 'Core',
    badgeColor: 'bg-violet-600 text-white',
  },
  {
    href: '/admin/ai-studio/validation',
    icon: Target,
    label: 'Human Validation',
    desc: 'Photo · Top 5 propositions · Approve / Reject / Edit / Unknown',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBg: 'bg-blue-100',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/admin/ai-studio/candidates',
    icon: Layers,
    label: 'Species Candidates',
    desc: 'Top 5 par image · Nom scientifique · Famille · Score · Raisons',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconBg: 'bg-teal-100',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/admin/ai-studio/analytics',
    icon: BarChart2,
    label: 'SIE Analytics',
    desc: 'Identifiés · Inconnus · Temps moyen · Taux validation · Top espèces',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBg: 'bg-amber-100',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/admin/ai-studio/import-real-ai',
    icon: Upload,
    label: 'Import Real AI Results',
    desc: 'OpenAI Vision Pilot · 20 actifs · Dry Run · provider=openai · Real AI badges',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-100',
    badge: 'REAL AI',
    badgeColor: 'bg-emerald-600 text-white',
  },
];

const KNOWLEDGE_CONNECTORS = [
  { name: 'FishBase', status: 'ready' },
  { name: 'WoRMS', status: 'ready' },
  { name: 'FAO ASFIS', status: 'ready' },
  { name: 'Catalogue of Life', status: 'ready' },
  { name: 'GBIF', status: 'ready' },
];

export default function AIStudioPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SIEStats>({
    totalJobs: 0, queued: 0, proposalsReady: 0, validated: 0,
    rejected: 0, unknown: 0, ignored: 0, avgConfidence: 0,
    todayValidations: 0, loading: true,
  });
  const [assetStats, setAssetStats] = useState<AssetStats>({
    total: 0, withoutSpecies: 0, underReview: 0, approved: 0, loading: true,
  });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  // Animate pipeline steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const [total, queued, ready, validated, rejected, unknown, ignored, conf, todayV,
      assetTotal, assetNoSpecies, assetUnderReview, assetApproved] = await Promise.all([
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'queued'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'proposals_ready'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'validated'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'rejected'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'unknown'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'ignored'),
      supabase.from('sie_jobs').select('global_confidence').not('global_confidence', 'is', null).limit(200),
      supabase.from('sie_validation_history').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }).is('species_id', null),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'under_review'),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'approved'),
    ]);

    const confData = conf.data ?? [];
    const avg = confData.length > 0
      ? Math.round(confData.reduce((s: number, r: { global_confidence: number }) => s + (r.global_confidence ?? 0), 0) / confData.length)
      : 0;

    setStats({
      totalJobs: total.count ?? 0,
      queued: queued.count ?? 0,
      proposalsReady: ready.count ?? 0,
      validated: validated.count ?? 0,
      rejected: rejected.count ?? 0,
      unknown: unknown.count ?? 0,
      ignored: ignored.count ?? 0,
      avgConfidence: avg,
      todayValidations: todayV.count ?? 0,
      loading: false,
    });

    setAssetStats({
      total: assetTotal.count ?? 0,
      withoutSpecies: assetNoSpecies.count ?? 0,
      underReview: assetUnderReview.count ?? 0,
      approved: assetApproved.count ?? 0,
      loading: false,
    });
  }, [profile]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }
  if (!['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return null;

  const totalProcessed = stats.validated + stats.rejected + stats.unknown;
  const progressPct = stats.totalJobs > 0 ? Math.round((totalProcessed / stats.totalJobs) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-200 flex items-center justify-center">
              <Sparkles size={20} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">AI Identification Studio</h1>
                <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">SIE · Phase 8</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Seafood Intelligence Engine — atelier de production IA · {assetStats.total > 0 ? `${assetStats.total} actifs disponibles` : 'chargement...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchStats} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <RefreshCw size={14} />
            </button>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Admin
            </Link>
          </div>
        </div>

        {/* Safety notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Validation humaine obligatoire — Aucune publication automatique</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Le SIE ne publie jamais automatiquement. Toutes les propositions restent <strong>Draft / Pending Review</strong>.
              Suggestion IA ≠ Validation humaine ≠ Données publiées.
            </p>
          </div>
        </div>

        {/* CTA: Start identification */}
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">Lancer l&apos;identification IA</h2>
              <p className="text-sm text-white/80">
                {assetStats.withoutSpecies > 0
                  ? `${assetStats.withoutSpecies} actifs sans espèce · ${assetStats.underReview} en cours de review`
                  : 'Sélectionnez des actifs dans la galerie et lancez le pipeline'}
              </p>
            </div>
            <Link href="/admin/ai-studio/identify"
              className="flex items-center gap-2 bg-white text-violet-700 font-bold px-5 py-3 rounded-xl hover:bg-violet-50 transition-colors text-sm shadow-sm">
              <Brain size={16} />
              Ouvrir la galerie
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Asset stats */}
        {!assetStats.loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Assets', value: assetStats.total, color: 'text-foreground', bg: 'bg-card' },
              { label: 'Sans espèce', value: assetStats.withoutSpecies, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Under Review', value: assetStats.underReview, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Approved', value: assetStats.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-border p-4 text-center`}>
                <p className={`text-2xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* SIE job stats */}
        {!stats.loading && stats.totalJobs > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
            {[
              { label: 'Jobs', value: stats.totalJobs, color: 'text-foreground' },
              { label: 'En attente', value: stats.queued, color: 'text-amber-600' },
              { label: 'Prêts', value: stats.proposalsReady, color: 'text-blue-600' },
              { label: 'Validés', value: stats.validated, color: 'text-emerald-600' },
              { label: 'Rejetés', value: stats.rejected, color: 'text-red-500' },
              { label: 'Inconnus', value: stats.unknown, color: 'text-gray-500' },
              { label: 'Ignorés', value: stats.ignored, color: 'text-gray-400' },
              { label: "Aujourd'hui", value: stats.todayValidations, color: 'text-teal-600' },
              { label: 'Confiance', value: `${stats.avgConfidence}%`, color: 'text-violet-600' },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className={`text-lg font-bold font-mono-data ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {!stats.loading && stats.totalJobs > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-secondary" />
                <span className="text-sm font-semibold text-foreground">Progression globale d&apos;identification</span>
              </div>
              <span className="text-sm font-mono-data text-secondary">{progressPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{stats.validated} validés</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{stats.rejected} rejetés</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />{stats.unknown} inconnus</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{stats.queued} en attente</span>
            </div>
          </div>
        )}

        {/* OpenAI Vision Pilot CTA */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold">OpenAI Vision Pilot — 20 Assets</h2>
                <span className="text-xs bg-white/20 border border-white/30 px-2 py-0.5 rounded-full font-semibold">
                  REAL AI — OPENAI VISION
                </span>
              </div>
              <p className="text-sm text-white/80">
                Importer les résultats réels OpenAI Vision · provider=openai · model=gpt-5-mini-2025-08-07 · Dry Run obligatoire
              </p>
            </div>
            <Link href="/admin/ai-studio/import-real-ai"
              className="flex items-center gap-2 bg-white text-emerald-700 font-bold px-5 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-sm shrink-0">
              <Upload size={16} />
              Import Real AI Results
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Studio modules */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STUDIO_MODULES.map((m) => {
              const ModuleIcon = m.icon;
              return (
                <Link key={m.href} href={m.href}
                  className={`group relative flex flex-col gap-3 p-5 rounded-2xl border transition-all hover:shadow-md ${m.color}`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>
                      <ModuleIcon size={18} />
                    </div>
                    {m.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{m.label}</h3>
                    <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                  <ArrowRight size={14} className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}

            {/* Quick links */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <Link href="/admin/metadata-review/assets"
                className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:shadow-sm transition-all group">
                <Eye size={16} className="text-indigo-600" />
                <div>
                  <p className="text-sm font-semibold text-indigo-700">Metadata Review Center</p>
                  <p className="text-xs text-indigo-600/70">Voir les propositions en attente</p>
                </div>
                <ArrowRight size={12} className="ml-auto text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link href="/admin/ai-identification"
                className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl hover:shadow-sm transition-all group">
                <Fish size={16} className="text-teal-600" />
                <div>
                  <p className="text-sm font-semibold text-teal-700">AI Identification Center</p>
                  <p className="text-xs text-teal-600/70">Phase 8 — queue & review</p>
                </div>
                <ArrowRight size={12} className="ml-auto text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>

          {/* Right: Pipeline + workflow */}
          <div className="space-y-4">

            {/* Pipeline animation */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-violet-500" />
                <h3 className="text-sm font-semibold text-foreground">Pipeline SIE</h3>
                <span className="text-xs text-muted-foreground ml-auto">7 étapes</span>
              </div>
              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  const isActive = i === activeStep;
                  return (
                    <div key={step.key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-500 ${isActive ? 'bg-violet-50 border border-violet-200' : 'opacity-40'}`}>
                      <StepIcon size={13} className={isActive ? 'text-violet-600' : step.color} />
                      <span className={`text-xs ${isActive ? 'text-violet-700 font-semibold' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto flex gap-0.5">
                          {[0, 1, 2].map((d) => (
                            <div key={d} className="w-1 h-1 rounded-full bg-violet-500 animate-bounce"
                              style={{ animationDelay: `${d * 150}ms` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Knowledge connectors */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-teal-500" />
                <h3 className="text-sm font-semibold text-foreground">Knowledge Connectors</h3>
              </div>
              <div className="space-y-1.5">
                {KNOWLEDGE_CONNECTORS.map((kc) => (
                  <div key={kc.name} className="flex items-center justify-between py-1">
                    <span className="text-xs text-foreground">{kc.name}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Enrichissement seul
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                Les données externes enrichissent les propositions uniquement. Aucune publication automatique.
              </p>
            </div>
          </div>
        </div>

        {/* Workflow diagram */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-violet-500" />
            <h3 className="text-sm font-semibold text-foreground">Workflow officiel</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <React.Fragment key={step.label}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${step.color}`}>
                    <StepIcon size={12} />
                    <div>
                      <p className="font-semibold leading-tight">{step.label}</p>
                      <p className="opacity-70 text-[10px]">{step.desc}</p>
                    </div>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
