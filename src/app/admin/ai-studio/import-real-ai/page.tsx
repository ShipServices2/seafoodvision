'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Upload, FileText, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, Eye, Database, Zap, ArrowRight, RefreshCw, Info, ShieldAlert, ChartBar as BarChart2, Fish, Tag, Globe, Hash, Star, Brain, Package } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DryRunReport {
  assets_expected: number;
  assets_found: number;
  assets_missing: string[];
  results_found: number;
  candidates_found: number;
  metadata_found: number;
  local_names_found: number;
  keywords_found: number;
  conflicts: number;
  duplicates: number;
  mock_proposals_existing: number;
  rows_to_create: number;
  rows_to_update: number;
  rejected_rows: { public_asset_id: string; reason: string }[];
  // Duplicate detection fields
  is_duplicate?: boolean;
  duplicate_of_job_id?: string;
  duplicate_of_job_name?: string;
  overlap_count?: number;
  overlap_ratio?: number;
  message?: string;
}

interface ImportResult {
  success: boolean;
  mode: string;
  pilot_job_id?: string;
  report: DryRunReport & {
    results_imported?: number;
    candidates_imported?: number;
    metadata_imported?: number;
  };
}

interface PilotJob {
  id: string;
  pilot_job_name: string | null;
  job_status: string;
  ai_provider: string | null;
  ai_model: string | null;
  provider_mode: string | null;
  total_assets: number | null;
  avg_confidence: number | null;
  processing_progress: number | null;
  validation_progress: number | null;
  created_at: string;
}

interface PilotResult {
  id: string;
  public_asset_id: string;
  provider: string;
  provider_mode: string;
  model: string;
  validation_status: string;
  review_status: string;
  publication_status: string;
  human_validated: boolean;
  total_candidates: number;
  avg_confidence: number | null;
  created_at: string;
}

const CSV_FILES = [
  { key: 'jobs', label: 'openai_identification_jobs_20.csv', required: true, desc: 'Job definitions for the 20 assets' },
  { key: 'results', label: 'openai_identification_results_20.csv', required: true, desc: 'Identification results per asset' },
  { key: 'candidates', label: 'openai_species_candidates_20.csv', required: true, desc: 'Species candidates (up to 5 per asset)' },
  { key: 'metadata', label: 'openai_candidate_metadata_20.csv', required: false, desc: 'Candidate metadata (names, taxonomy, etc.)' },
  { key: 'local_names', label: 'openai_local_names_20.csv', required: false, desc: 'Local names per language' },
  { key: 'keywords', label: 'openai_keywords_20.csv', required: false, desc: 'Keywords per candidate' },
];

const PILOT_ASSETS = [
  'SV-B100-0001', 'SV-B100-0012', 'SV-PILOT-0002', 'SV-PILOT-0004', 'SV-PILOT-0006',
];

const CONFIDENCE_LABEL = (score: number) => {
  if (score < 0.40) return { label: 'Low confidence', color: 'text-red-600 bg-red-50 border-red-200' };
  if (score < 0.70) return { label: 'Medium confidence', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { label: 'Higher confidence — human review still required', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
};

export default function ImportRealAIPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [files, setFiles] = useState<Record<string, File | null>>({
    jobs: null, results: null, candidates: null, metadata: null, local_names: null, keywords: null,
  });
  const [step, setStep] = useState<'upload' | 'dry_run' | 'confirm' | 'importing' | 'done'>('upload');
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pilotJobs, setPilotJobs] = useState<PilotJob[]>([]);
  const [pilotResults, setPilotResults] = useState<PilotResult[]>([]);
  const [loadingPilot, setLoadingPilot] = useState(true);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/import-real-ai'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchPilotData = useCallback(async () => {
    if (!profile) return;
    setLoadingPilot(true);
    const supabase = createClient();
    const [jobsRes, resultsRes] = await Promise.all([
      supabase.from('sie_jobs').select('id,pilot_job_name,job_status,ai_provider,ai_model,provider_mode,total_assets,avg_confidence,processing_progress,validation_progress,created_at')
        .eq('provider_mode', 'real_ai').order('created_at', { ascending: false }).limit(10),
      supabase.from('openai_pilot_results').select('id,public_asset_id,provider,provider_mode,model,validation_status,review_status,publication_status,human_validated,total_candidates,avg_confidence,created_at')
        .order('created_at', { ascending: false }).limit(25),
    ]);
    setPilotJobs(jobsRes.data ?? []);
    setPilotResults(resultsRes.data ?? []);
    setLoadingPilot(false);
  }, [profile]);

  useEffect(() => { fetchPilotData(); }, [fetchPilotData]);

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const requiredFilesReady = CSV_FILES.filter((f) => f.required).every((f) => files[f.key] !== null);

  const runDryRun = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('mode', 'dry_run');
      CSV_FILES.forEach((f) => { if (files[f.key]) fd.append(f.key, files[f.key]!); });
      const res = await fetch('/api/admin/openai-pilot-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dry run failed');
      setDryRunReport(data.report);
      setStep('dry_run');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const confirmImport = async () => {
    setIsRunning(true);
    setStep('importing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('mode', 'import');
      CSV_FILES.forEach((f) => { if (files[f.key]) fd.append(f.key, files[f.key]!); });
      const res = await fetch('/api/admin/openai-pilot-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data);
      setStep('done');
      fetchPilotData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStep('dry_run');
    } finally {
      setIsRunning(false);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }
  if (!['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <span>/</span>
          <Link href="/admin/ai-studio" className="hover:text-foreground">AI Studio</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Import Real AI Results</span>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-200 flex items-center justify-center">
              <Brain size={20} className="text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Import Real AI Results</h1>
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  REAL AI — OPENAI VISION
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                OpenAI Vision Pilot — 20 Assets · provider=openai · model=gpt-5-mini-2025-08-07
              </p>
            </div>
          </div>
          <button onClick={fetchPilotData} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Real AI badge notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <ShieldAlert size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              REAL AI — OPENAI VISION · Ces résultats proviennent d&apos;une véritable analyse visuelle OpenAI
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              provider=openai · provider_mode=real_ai · model=gpt-5-mini-2025-08-07 · validation_status=suggested_unverified · requires_human_review=true
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Aucune publication automatique. Aucune validation automatique. Aucun asset créé depuis cet import. Matching par public_asset_id uniquement.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left: Import wizard */}
          <div className="xl:col-span-2 space-y-6">

            {/* Step 1: Upload CSVs */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'upload' ? 'bg-violet-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {step === 'upload' ? '1' : <CheckCircle2 size={14} />}
                </div>
                <h2 className="text-base font-semibold text-foreground">Étape 1 — Charger les fichiers CSV</h2>
              </div>

              <div className="space-y-3">
                {CSV_FILES.map((csvFile) => (
                  <div key={csvFile.key} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <FileText size={16} className={files[csvFile.key] ? 'text-emerald-500' : 'text-muted-foreground'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{csvFile.label}</span>
                        {csvFile.required && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Requis</span>
                        )}
                        {!csvFile.required && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Optionnel</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{csvFile.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {files[csvFile.key] ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium truncate max-w-[120px]">{files[csvFile.key]!.name}</span>
                          <button
                            onClick={() => handleFileChange(csvFile.key, null)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[csvFile.key]?.click()}
                          className="text-xs bg-background border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors font-medium"
                        >
                          Choisir
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[csvFile.key] = el; }}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleFileChange(csvFile.key, e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {step === 'upload' && (
                <button
                  onClick={runDryRun}
                  disabled={!requiredFilesReady || isRunning}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                  {isRunning ? 'Analyse en cours...' : 'Lancer le Dry Run (obligatoire)'}
                </button>
              )}
            </div>

            {/* Step 2: Dry Run Report */}
            {(step === 'dry_run' || step === 'confirm' || step === 'importing' || step === 'done') && dryRunReport && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'dry_run' ? 'bg-violet-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    {step === 'dry_run' ? '2' : <CheckCircle2 size={14} />}
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Étape 2 — Rapport Dry Run</h2>
                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                    AUCUNE ÉCRITURE EFFECTUÉE
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Actifs attendus', value: dryRunReport.assets_expected, icon: Database, color: 'text-blue-600' },
                    { label: 'Actifs trouvés', value: dryRunReport.assets_found, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: 'Actifs manquants', value: dryRunReport.assets_missing.length, icon: XCircle, color: 'text-red-500' },
                    { label: 'Résultats trouvés', value: dryRunReport.results_found, icon: BarChart2, color: 'text-violet-600' },
                    { label: 'Candidats trouvés', value: dryRunReport.candidates_found, icon: Fish, color: 'text-teal-600' },
                    { label: 'Métadonnées', value: dryRunReport.metadata_found, icon: Tag, color: 'text-amber-600' },
                    { label: 'Noms locaux', value: dryRunReport.local_names_found, icon: Globe, color: 'text-indigo-600' },
                    { label: 'Mots-clés', value: dryRunReport.keywords_found, icon: Hash, color: 'text-pink-600' },
                    { label: 'Conflits', value: dryRunReport.conflicts, icon: AlertTriangle, color: 'text-orange-600' },
                    { label: 'Doublons', value: dryRunReport.duplicates, icon: RefreshCw, color: 'text-gray-500' },
                    { label: 'Propositions Mock existantes', value: dryRunReport.mock_proposals_existing, icon: Brain, color: 'text-gray-500' },
                    { label: 'Lignes à créer', value: dryRunReport.rows_to_create, icon: Zap, color: 'text-emerald-600' },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <stat.icon size={12} className={stat.color} />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {dryRunReport.assets_missing.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-700 mb-2">
                      Actifs rejetés ({dryRunReport.assets_missing.length}) — public_asset_id introuvable
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dryRunReport.assets_missing.map((id) => (
                        <span key={id} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-mono">{id}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <p className="text-xs text-amber-700">
                    <strong>Règle :</strong> Les propositions Mock existantes ({dryRunReport.mock_proposals_existing}) sont conservées dans l&apos;historique.
                    Seules les propositions Real AI OpenAI sont ajoutées. Aucun asset n&apos;est créé.
                  </p>
                </div>

                {/* Duplicate detection warning */}
                {dryRunReport.is_duplicate && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-xl mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-800 mb-1">Import dupliqué détecté</p>
                        <p className="text-xs text-red-700">{dryRunReport.message}</p>
                        {dryRunReport.duplicate_of_job_id && (
                          <a
                            href={`/admin/ai-studio/validation?job=${dryRunReport.duplicate_of_job_id}`}
                            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
                          >
                            → Ouvrir &quot;{dryRunReport.duplicate_of_job_name}&quot; dans Human Validation
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 'dry_run' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('upload')}
                      className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                    >
                      ← Modifier les fichiers
                    </button>
                    <button
                      onClick={() => setStep('confirm')}
                      disabled={dryRunReport.assets_found === 0 || dryRunReport.is_duplicate === true}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <ArrowRight size={16} />
                      Confirmer l&apos;import
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
              <div className="bg-card border border-emerald-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                  <h2 className="text-base font-semibold text-foreground">Étape 3 — Confirmation de l&apos;import</h2>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">Résumé de l&apos;import confirmé :</p>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    <li>• {dryRunReport!.assets_found} actifs appariés par public_asset_id</li>
                    <li>• {dryRunReport!.results_found} résultats à importer</li>
                    <li>• {dryRunReport!.candidates_found} candidats à importer</li>
                    <li>• provider=openai · provider_mode=real_ai · model=gpt-5-mini-2025-08-07</li>
                    <li>• validation_status=suggested_unverified · review_status=under_review · publication_status=private</li>
                    <li>• requires_human_review=true · human_validated=false</li>
                    <li>• {dryRunReport!.mock_proposals_existing} propositions Mock conservées (non modifiées)</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('dry_run')}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    ← Retour au rapport
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={isRunning}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    {isRunning ? 'Import en cours...' : 'LANCER L\'IMPORT RÉEL'}
                  </button>
                </div>
              </div>
            )}

            {/* Importing */}
            {step === 'importing' && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Loader2 size={32} className="animate-spin text-violet-600 mx-auto mb-3" />
                <p className="text-base font-semibold text-foreground">Import en cours...</p>
                <p className="text-sm text-muted-foreground mt-1">Création des résultats, candidats et métadonnées OpenAI Vision</p>
              </div>
            )}

            {/* Done */}
            {step === 'done' && importResult && (
              <div className="bg-card border border-emerald-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <h2 className="text-base font-semibold text-foreground">Import terminé avec succès</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Actifs appariés', value: importResult.report.assets_found },
                    { label: 'Résultats importés', value: importResult.report.results_imported ?? 0 },
                    { label: 'Candidats importés', value: importResult.report.candidates_imported ?? 0 },
                    { label: 'Métadonnées importées', value: importResult.report.metadata_imported ?? 0 },
                    { label: 'Conflits', value: importResult.report.conflicts },
                    { label: 'Mock conservés', value: importResult.report.mock_proposals_existing },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-xl font-bold text-emerald-700">{stat.value}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/admin/ai-studio/validation${importResult.pilot_job_id ? `?job=${importResult.pilot_job_id}` : ''}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    <Eye size={16} />
                    REVIEW AI PROPOSALS
                  </Link>
                  <button
                    onClick={() => { setStep('upload'); setDryRunReport(null); setImportResult(null); setFiles({ jobs: null, results: null, candidates: null, metadata: null, local_names: null, keywords: null }); }}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Nouvel import
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Pilot status + existing jobs */}
          <div className="space-y-6">

            {/* Pilot assets */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Star size={14} className="text-amber-500" />
                Actifs pilote à tester
              </h3>
              <div className="space-y-2">
                {PILOT_ASSETS.map((id) => (
                  <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-xs font-mono text-foreground">{id}</span>
                    <Link
                      href={`/admin/ai-studio/validation?asset=${id}`}
                      className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                    >
                      Review →
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence rules */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info size={14} className="text-blue-500" />
                Règles de confiance
              </h3>
              <div className="space-y-2">
                {[
                  { range: '< 0.40', label: 'Low confidence', color: 'bg-red-50 border-red-200 text-red-700' },
                  { range: '0.40 – 0.69', label: 'Medium confidence', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { range: '≥ 0.70', label: 'Higher confidence — human review still required', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                ].map((rule) => (
                  <div key={rule.range} className={`p-2 rounded-lg border text-xs ${rule.color}`}>
                    <span className="font-mono font-semibold">{rule.range}</span> — {rule.label}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Aucune validation automatique même au-dessus de 0.70. Validation humaine obligatoire pour le pilote.
                </p>
              </div>
            </div>

            {/* Existing pilot jobs */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Brain size={14} className="text-violet-500" />
                Jobs Real AI existants
              </h3>
              {loadingPilot ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : pilotJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun job Real AI importé</p>
              ) : (
                <div className="space-y-2">
                  {pilotJobs.map((job) => (
                    <div key={job.id} className="p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {job.pilot_job_name || 'OpenAI Vision Pilot'}
                        </p>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                          REAL AI
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{job.total_assets ?? 0} actifs</span>
                        <span>{job.job_status}</span>
                        {job.avg_confidence && (
                          <span className={CONFIDENCE_LABEL(job.avg_confidence / 100).color.split(' ')[0]}>
                            {job.avg_confidence}% conf.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Link
                          href={`/admin/ai-studio/validation?job=${job.id}`}
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                          Review proposals →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent pilot results */}
            {pilotResults.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Package size={14} className="text-teal-500" />
                  Résultats importés ({pilotResults.length})
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {pilotResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <span className="text-xs font-mono text-foreground">{r.public_asset_id}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium">REAL AI</span>
                          {r.avg_confidence && (
                            <span className={`text-xs px-1 py-0.5 rounded border ${CONFIDENCE_LABEL(r.avg_confidence).color}`}>
                              {Math.round(r.avg_confidence * 100)}%
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{r.total_candidates} cand.</span>
                        </div>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.human_validated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.human_validated ? 'Validated' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
