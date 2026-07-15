'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Brain, Upload, Play, CheckSquare, AlertTriangle, Layers,
  ChevronDown, X, Loader2, Zap, Eye, Database, Cpu, CheckCircle2
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


type BatchSize = 1 | 50 | 100 | 500 | 'all';

interface Asset {
  id: string;
  public_asset_id: string | null;
  title: string | null;
  file_name: string | null;
  category: string | null;
  thumbnail_url: string | null;
}

interface ProgressState {
  step: string;
  pct: number;
  active: boolean;
}

const BATCH_OPTIONS: { label: string; value: BatchSize }[] = [
  { label: '1 photo', value: 1 },
  { label: '50 photos', value: 50 },
  { label: '100 photos', value: 100 },
  { label: '500 photos', value: 500 },
  { label: 'Tous les résultats filtrés', value: 'all' },
];

const PIPELINE_STEPS = [
  { key: 'analyse', label: 'Analyse...', icon: Upload },
  { key: 'vision', label: 'Vision...', icon: Eye },
  { key: 'taxonomy', label: 'Recherche taxonomique...', icon: Database },
  { key: 'metadata', label: 'Construction des métadonnées...', icon: Cpu },
  { key: 'done', label: 'Propositions terminées...', icon: CheckCircle2 },
];

export default function AIStudioIdentifyPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = useState<BatchSize>(50);
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ step: '', pct: 0, active: false });
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [jobsCreated, setJobsCreated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/identify'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchAssets = useCallback(async () => {
    if (!profile) return;
    setAssetsLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('assets')
      .select('id, public_asset_id, title, file_name, category, thumbnail_url')
      .order('created_at', { ascending: false });
    if (filterCategory) query = query.eq('category', filterCategory);
    const limit = batchSize === 'all' ? 1000 : (batchSize as number);
    query = query.limit(limit);
    const { data } = await query;
    setAssets(data ?? []);
    setAssetsLoading(false);
  }, [profile, filterCategory, batchSize]);

  const fetchCategories = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const { data } = await supabase.from('categories').select('name').order('name');
    setCategories((data ?? []).map((c: { name: string }) => c.name));
  }, [profile]);

  useEffect(() => { fetchAssets(); fetchCategories(); }, [fetchAssets, fetchCategories]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(assets.map((a) => a.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const runIdentification = async () => {
    const toProcess = selectedIds.size > 0 ? Array.from(selectedIds) : assets.map((a) => a.id);
    if (toProcess.length === 0) { setError('Sélectionnez au moins une photo.'); return; }
    setError(null);
    setSuccess(null);
    setRunning(true);
    setCurrentStepIdx(0);
    setProgress({ step: 'Analyse...', pct: 5, active: true });

    // Simulate pipeline steps
    const stepDurations = [600, 900, 800, 700, 500];
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      setCurrentStepIdx(i);
      setProgress({ step: PIPELINE_STEPS[i].label, pct: Math.round(((i + 1) / PIPELINE_STEPS.length) * 90), active: true });
      await new Promise((r) => setTimeout(r, stepDurations[i]));
    }

    // Create SIE jobs in Supabase
    const supabase = createClient();
    const jobRows = toProcess.map((assetId) => {
      const asset = assets.find((a) => a.id === assetId);
      return {
        asset_id: assetId,
        public_asset_id: asset?.public_asset_id ?? null,
        current_name: asset?.title ?? asset?.file_name ?? null,
        current_category: asset?.category ?? null,
        job_status: 'queued' as const,
        progress_step: 'queued',
        progress_pct: 0,
        ai_provider: 'mock',
      };
    });

    const { data: created, error: insertErr } = await supabase
      .from('sie_jobs')
      .insert(jobRows)
      .select('id');

    if (insertErr) {
      setError(`Erreur lors de la création des jobs: ${insertErr.message}`);
      setRunning(false);
      setProgress({ step: '', pct: 0, active: false });
      return;
    }

    setJobsCreated(created?.length ?? 0);
    setProgress({ step: 'Propositions terminées...', pct: 100, active: false });
    setCurrentStepIdx(PIPELINE_STEPS.length - 1);
    setSuccess(`${created?.length ?? 0} job(s) créés avec succès. Rendez-vous dans Validation pour examiner les propositions.`);
    setRunning(false);
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
              <Brain size={18} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Identify with AI</h1>
                <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">SIE</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Sélectionner des photos et lancer l&apos;identification</p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← AI Studio
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Controls */}
          <div className="space-y-4">

            {/* Batch size selector */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Layers size={14} className="text-violet-500" />
                Taille du lot
              </h3>
              <div className="space-y-2">
                {BATCH_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setBatchSize(opt.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${batchSize === opt.value
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-muted/40 border-border text-foreground hover:border-violet-200'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Filtrer par catégorie</h3>
              <div className="relative">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full appearance-none bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground pr-8 focus:outline-none focus:ring-2 focus:ring-violet-300">
                  <option value="">Toutes les catégories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Pipeline progress */}
            {(running || progress.active || success) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap size={14} className="text-violet-500" />
                  Pipeline SIE
                </h3>
                <div className="space-y-2 mb-3">
                  {PIPELINE_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i === currentStepIdx && running;
                    const isDone = i < currentStepIdx || (!running && success);
                    return (
                      <div key={step.key}
                        className={`flex items-center gap-2 p-2 rounded-lg transition-all ${isActive ? 'bg-violet-50 border border-violet-200' : isDone ? 'opacity-60' : 'opacity-25'}`}>
                        <Icon size={12} className={isActive ? 'text-violet-600' : isDone ? 'text-emerald-500' : 'text-muted-foreground'} />
                        <span className={`text-xs ${isActive ? 'text-violet-700 font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                        {isActive && <Loader2 size={10} className="ml-auto text-violet-500 animate-spin" />}
                        {isDone && !isActive && <CheckCircle2 size={10} className="ml-auto text-emerald-500" />}
                      </div>
                    );
                  })}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-right">{progress.pct}%</p>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={runIdentification}
              disabled={running || assets.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm">
              {running ? (
                <><Loader2 size={16} className="animate-spin" />Identification en cours...</>
              ) : (
                <><Play size={16} />IDENTIFY WITH AI</>
              )}
            </button>

            {/* Feedback */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <X size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs text-emerald-700 font-medium">{success}</p>
                <Link href="/admin/ai-studio/validation"
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 underline mt-1 hover:no-underline">
                  → Aller à la validation
                </Link>
              </div>
            )}

            {/* Safety notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Aucune identification n&apos;est publiée automatiquement. Toutes les propositions requièrent une validation humaine.
              </p>
            </div>
          </div>

          {/* Right: Asset grid */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {assetsLoading ? 'Chargement...' : `${assets.length} actifs`}
                  </span>
                  {selectedIds.size > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
                      {selectedIds.size} sélectionné(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Tout sélectionner
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {assetsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-border border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Upload size={32} className="text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun actif trouvé</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4 max-h-[600px] overflow-y-auto">
                  {assets.map((asset) => {
                    const isSelected = selectedIds.has(asset.id);
                    return (
                      <button key={asset.id} onClick={() => toggleSelect(asset.id)}
                        className={`relative rounded-xl border-2 overflow-hidden aspect-square transition-all duration-150 ${isSelected ? 'border-violet-500 shadow-md' : 'border-border hover:border-violet-300'}`}>
                        {asset.thumbnail_url ? (
                          <img src={asset.thumbnail_url} alt={asset.title ?? asset.file_name ?? 'Asset'}
                            className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Brain size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                            <CheckSquare size={20} className="text-violet-700" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                          <p className="text-xs text-white truncate leading-tight">
                            {asset.title ?? asset.file_name ?? asset.public_asset_id ?? '—'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
