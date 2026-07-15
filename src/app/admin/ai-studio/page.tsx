'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Brain, Zap, Layers, Eye, CheckCircle2, BarChart2, Upload, AlertTriangle, ChevronRight, Database, Globe, Cpu, TrendingUp, Users, Target, Sparkles } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


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

const PROGRESS_STEPS = [
  { key: 'queued', label: 'Analyse...', icon: Upload, color: 'text-gray-500' },
  { key: 'vision_processing', label: 'Vision...', icon: Eye, color: 'text-blue-500' },
  { key: 'taxonomy_search', label: 'Recherche taxonomique...', icon: Database, color: 'text-violet-500' },
  { key: 'building_metadata', label: 'Construction des métadonnées...', icon: Cpu, color: 'text-amber-500' },
  { key: 'proposals_ready', label: 'Propositions terminées...', icon: CheckCircle2, color: 'text-emerald-500' },
];

const STUDIO_MODULES = [
  {
    href: '/admin/ai-studio/identify',
    icon: Brain,
    label: 'Identify with AI',
    desc: 'Import or select photos — 1, 50, 100, 500 or all filtered assets',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    iconColor: 'text-violet-600',
    badge: 'Core',
  },
  {
    href: '/admin/ai-studio/validation',
    icon: Target,
    label: 'Human Validation',
    desc: 'Photo left · AI proposals right — Approve / Reject / Edit / Unknown per field',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    badge: null,
  },
  {
    href: '/admin/ai-studio/candidates',
    icon: Layers,
    label: 'Species Candidates',
    desc: 'Top 5 per image — common name, scientific name, family, score, reasons',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
    badge: null,
  },
  {
    href: '/admin/ai-studio/analytics',
    icon: BarChart2,
    label: 'SIE Analytics',
    desc: 'Identified · Unknown · Avg time · Validation rate · Top species',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    badge: null,
  },
];

const VISION_FEATURES = [
  'Forme & silhouette', 'Tête & bouche', 'Queue & nageoires',
  'Texture & couleurs', 'Motifs & yeux', 'Taille relative',
  'Whole / Fillet / Steak', 'IQF / Block / Vacuum', 'Orientation produit',
];

const KNOWLEDGE_CONNECTORS = [
  { name: 'FishBase', status: 'active', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'WoRMS', status: 'active', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'FAO ASFIS', status: 'active', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Catalogue of Life', status: 'active', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'GBIF', status: 'active', color: 'bg-emerald-100 text-emerald-700' },
];

export default function AIStudioPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<SIEStats>({
    totalJobs: 0, queued: 0, proposalsReady: 0, validated: 0,
    rejected: 0, unknown: 0, ignored: 0, avgConfidence: 0,
    todayValidations: 0, loading: true,
  });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  // Animate progress steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % PROGRESS_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const [total, queued, ready, validated, rejected, unknown, ignored, conf, todayV] = await Promise.all([
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'queued'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'proposals_ready'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'validated'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'rejected'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'unknown'),
      supabase.from('sie_jobs').select('*', { count: 'exact', head: true }).eq('job_status', 'ignored'),
      supabase.from('sie_jobs').select('global_confidence').not('global_confidence', 'is', null).limit(200),
      supabase.from('sie_validation_history').select('*', { count: 'exact', head: true }).gte('created_at', today),
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
        <div className="flex items-start justify-between mb-8">
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
                Seafood Intelligence Engine — analyse automatique · propositions · validation humaine
              </p>
            </div>
          </div>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Admin
          </Link>
        </div>

        {/* Safety notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Validation humaine obligatoire</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Le SIE ne publie jamais automatiquement. Toutes les propositions sont classées Top 5.
              Chaque identification requiert une approbation explicite du reviewer avant toute mise à jour.
              Suggestion IA ≠ Validation humaine ≠ Données publiées.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        {!stats.loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
            {[
              { label: 'Total Jobs', value: stats.totalJobs, color: 'text-foreground' },
              { label: 'En attente', value: stats.queued, color: 'text-amber-600' },
              { label: 'Propositions prêtes', value: stats.proposalsReady, color: 'text-blue-600' },
              { label: 'Validés', value: stats.validated, color: 'text-emerald-600' },
              { label: 'Rejetés', value: stats.rejected, color: 'text-red-500' },
              { label: 'Inconnus', value: stats.unknown, color: 'text-gray-500' },
              { label: 'Ignorés', value: stats.ignored, color: 'text-gray-400' },
              { label: "Aujourd'hui", value: stats.todayValidations, color: 'text-teal-600' },
              { label: 'Confiance moy.', value: `${stats.avgConfidence}%`, color: 'text-violet-600' },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className={`text-xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
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

        {/* Main grid: modules + pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Studio modules */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STUDIO_MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <Link key={m.href} href={m.href}
                  className="group bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:border-secondary/30 hover:shadow-card transition-all duration-150">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${m.color}`}>
                    <Icon size={18} className={m.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm">{m.label}</h3>
                      {m.badge && (
                        <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-medium">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>

          {/* Pipeline animation */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-foreground">Pipeline SIE</h3>
            </div>
            <div className="space-y-3">
              {PROGRESS_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === activeStep;
                const isDone = i < activeStep;
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-500 ${isActive ? 'bg-violet-50 border border-violet-200' : isDone ? 'opacity-50' : 'opacity-30'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-violet-100' : 'bg-muted'}`}>
                      <Icon size={13} className={isActive ? 'text-violet-600' : 'text-muted-foreground'} />
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-violet-700' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <div className="ml-auto flex gap-0.5">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="w-1 h-1 rounded-full bg-violet-400 animate-bounce"
                            style={{ animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Architecture multi-modèles · Aucun fournisseur connecté
              </p>
            </div>
          </div>
        </div>

        {/* Vision Engine + Knowledge Connectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Vision Engine */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={14} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">Vision Engine</h3>
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full ml-auto">Architecture prête</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VISION_FEATURES.map((f) => (
                <span key={f} className="text-xs bg-muted text-muted-foreground border border-border px-2 py-1 rounded-lg">{f}</span>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 font-medium">Multi-modèles · Aucun fournisseur connecté</p>
              <p className="text-xs text-blue-600 mt-0.5">OpenAI · Gemini · Anthropic · Modèles spécialisés · Local</p>
            </div>
          </div>

          {/* Knowledge Connectors */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-foreground">Knowledge Connectors</h3>
              <span className="text-xs bg-teal-50 text-teal-600 border border-teal-200 px-1.5 py-0.5 rounded-full ml-auto">Enrichissement uniquement</span>
            </div>
            <div className="space-y-2">
              {KNOWLEDGE_CONNECTORS.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}>
                    {c.status === 'active' ? 'Connecteur prêt' : 'Inactif'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Les données externes enrichissent uniquement les propositions IA. Aucune donnée n&apos;est publiée automatiquement.
            </p>
          </div>
        </div>

        {/* Confidence Scores Architecture */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} className="text-secondary" />
            <h3 className="text-sm font-semibold text-foreground">Scores de confiance indépendants</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Vision', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: 'Species', color: 'bg-violet-50 border-violet-200 text-violet-700' },
              { label: 'Commercial', color: 'bg-amber-50 border-amber-200 text-amber-700' },
              { label: 'Metadata', color: 'bg-teal-50 border-teal-200 text-teal-700' },
              { label: 'Documentation', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { label: 'Global', color: 'bg-secondary/10 border-secondary/20 text-secondary' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                <p className="text-lg font-bold font-mono-data">—</p>
                <p className="text-xs font-medium mt-0.5">{s.label} Confidence</p>
              </div>
            ))}
          </div>
        </div>

        {/* Propagation targets */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-secondary" />
            <h3 className="text-sm font-semibold text-foreground">Propagation automatique après validation</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Species Center', 'Metadata Review', 'Encyclopedia', 'Marketplace', 'Smart Search', 'Library', 'API'].map((t) => (
              <span key={t} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
                ✓ {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Une validation met automatiquement à jour tous les systèmes sans duplication. Suggestion IA → Validation humaine → Publication.
          </p>
        </div>

      </main>
      <Footer />
    </div>
  );
}
