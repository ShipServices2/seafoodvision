'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Brain, CheckSquare, Square, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, X, Loader2, Zap, Eye, Database, Cpu, CheckCircle2, Search, RefreshCw, Fish, Clock, Globe, Star, Pause, Play, RotateCcw, ArrowRight, Tag, Filter } from 'lucide-react';
import { generateEnrichedMockCandidates, MockAssetContext } from '@/lib/ai/mockEngine';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  public_asset_id: string | null;
  title: string | null;
  category: string | null;
  preview_storage_bucket: string | null;
  preview_storage_path: string | null;
  review_status: string | null;
  species_id: string | null;
  created_at: string | null;
  import_batch_id: string | null;
  is_demo: boolean | null;
  species_common_name?: string | null;
  ai_identified?: boolean;
}

interface FilterState {
  reviewStatus: string;
  metadataFilter: string;
  category: string;
  importBatch: string;
  textSearch: string;
  aiStatus: string;
}

interface SIEJob {
  id: string;
  asset_id: string | null;
  public_asset_id: string | null;
  current_name: string | null;
  job_status: string;
  created_at: string;
  global_confidence: number | null;
}

interface BatchJob {
  id: string;
  jobIds: string[];
  assetCount: number;
  reviewer: string;
  createdAt: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused';
  processed: number;
  errors: string[];
  startedAt?: number;
  estimatedMs?: number;
}

const PAGE_SIZE = 50;

const PIPELINE_STEPS = [
  { key: 'analyse', label: 'Analyse Vision', icon: Eye },
  { key: 'species', label: 'Recherche espèces', icon: Fish },
  { key: 'taxonomy', label: 'Recherche taxonomique', icon: Database },
  { key: 'commercial', label: 'Recherche commerciale', icon: Globe },
  { key: 'metadata', label: 'Construction métadonnées', icon: Cpu },
  { key: 'candidates', label: 'Top 5 candidats', icon: Star },
  { key: 'done', label: 'Terminé', icon: CheckCircle2 },
];

const REVIEW_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'draft', label: 'Draft / Unknown' },
  { value: 'imported', label: 'Imported' },
  { value: 'rejected', label: 'Rejected' },
];

const METADATA_FILTER_OPTIONS = [
  { value: '', label: 'All assets' },
  { value: 'without_species', label: 'Unknown species' },
  { value: 'without_scientific_name', label: 'Without Scientific Name' },
  { value: 'without_common_name', label: 'Without Common Name' },
  { value: 'without_keywords', label: 'Without Keywords' },
  { value: 'without_description', label: 'Without Description' },
];

const AI_STATUS_OPTIONS = [
  { value: '', label: 'All AI status' },
  { value: 'not_identified', label: 'Not identified' },
  { value: 'already_identified', label: 'Already identified' },
];

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  under_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  imported: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  preview_only: 'bg-teal-100 text-teal-700',
  commercial: 'bg-indigo-100 text-indigo-700',
  editorial: 'bg-purple-100 text-purple-700',
};

// ─── Signed URL hook ──────────────────────────────────────────────────────────
function useSignedUrl(bucket: string | null | undefined, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!bucket || !path) { setUrl(null); return; }
    let cancelled = false;
    getSignedStorageUrl(bucket, path, 3600).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);
  return url;
}

// ─── Asset thumbnail card ─────────────────────────────────────────────────────
function AssetThumb({ asset }: { asset: AssetRow }) {
  const [imgError, setImgError] = useState(false);
  const signedUrl = useSignedUrl(asset.preview_storage_bucket, asset.preview_storage_path);
  const hasImage = !!signedUrl && !imgError;
  return hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={signedUrl!} alt={asset.title ?? 'Asset'} className="w-full h-full object-cover" onError={() => setImgError(true)} />
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <Fish size={24} className="text-muted-foreground" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIStudioIdentifyPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Gallery state
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [importBatches, setImportBatches] = useState<{ id: string; name: string }[]>([]);
  const [identifiedAssetIds, setIdentifiedAssetIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    reviewStatus: '',
    metadataFilter: '',
    category: '',
    importBatch: '',
    textSearch: '',
    aiStatus: '',
  });
  const [searchInput, setSearchInput] = useState('');

  // Batch job state
  const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  // Recent jobs
  const [recentJobs, setRecentJobs] = useState<SIEJob[]>([]);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/identify'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  // ── Fetch identified asset IDs ──────────────────────────────────────────────
  const fetchIdentifiedIds = useCallback(async () => {
    const { data } = await supabase
      .from('sie_jobs')
      .select('asset_id')
      .not('asset_id', 'is', null)
      .in('job_status', ['proposals_ready', 'validated', 'under_review']);
    const ids = new Set<string>((data ?? []).map((r: { asset_id: string }) => r.asset_id).filter(Boolean));
    setIdentifiedAssetIds(ids);
  }, [supabase]);

  // ── Fetch assets ────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async (page = 0) => {
    if (!user) return; // wait for auth — RLS requires authenticated session
    setAssetsLoading(true);
    setError(null);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('assets')
      .select('id, public_asset_id, title, category, review_status, species_id, created_at, import_batch_id, is_demo, asset_previews(storage_bucket, storage_path)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.textSearch) {
      query = query.or(`title.ilike.%${filters.textSearch}%,public_asset_id.ilike.%${filters.textSearch}%`);
    }
    if (filters.reviewStatus) query = query.eq('review_status', filters.reviewStatus);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.importBatch) query = query.eq('import_batch_id', filters.importBatch);
    if (filters.metadataFilter === 'without_species') query = query.is('species_id', null);

    const { data, count, error: queryError } = await query;

    if (queryError) {
      console.error('[AI Studio] fetchAssets error:', queryError);
      setError(`Failed to load assets: ${queryError.message}`);
      setAssetsLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: AssetRow[] = (data ?? []).map((a: any) => {
      const preview = Array.isArray(a.asset_previews) ? a.asset_previews[0] : a.asset_previews;
      return {
        id: a.id,
        public_asset_id: a.public_asset_id,
        title: a.title,
        category: a.category,
        review_status: a.review_status,
        species_id: a.species_id,
        created_at: a.created_at,
        import_batch_id: a.import_batch_id,
        is_demo: a.is_demo,
        preview_storage_bucket: preview?.storage_bucket ?? null,
        preview_storage_path: preview?.storage_path ?? null,
        ai_identified: identifiedAssetIds.has(a.id),
      };
    });

    // AI status filter (client-side after fetch)
    if (filters.aiStatus === 'not_identified') {
      rows = rows.filter((r) => !identifiedAssetIds.has(r.id));
    } else if (filters.aiStatus === 'already_identified') {
      rows = rows.filter((r) => identifiedAssetIds.has(r.id));
    }

    setAssets(rows);
    setTotalCount(count ?? 0);
    setCurrentPage(page);
    setAssetsLoading(false);
  }, [filters, identifiedAssetIds, supabase, user]);

  const fetchMeta = useCallback(async () => {
    if (!profile) return;
    const [cats, batches] = await Promise.all([
      supabase.from('categories').select('name').order('name'),
      supabase.from('import_batches').select('id, name').order('created_at', { ascending: false }).limit(50),
    ]);
    setCategories((cats.data ?? []).map((c: { name: string }) => c.name));
    setImportBatches((batches.data ?? []) as { id: string; name: string }[]);
  }, [profile, supabase]);

  const fetchRecentJobs = useCallback(async () => {
    const { data } = await supabase
      .from('sie_jobs')
      .select('id, asset_id, public_asset_id, current_name, job_status, created_at, global_confidence')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentJobs(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchIdentifiedIds(); }, [fetchIdentifiedIds]);
  useEffect(() => { fetchAssets(0); }, [fetchAssets]); // re-runs when profile loads (fetchAssets deps include profile indirectly via supabase client)
  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchRecentJobs(); }, [fetchRecentJobs]);

  // ── Selection ───────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectPage = () => setSelectedIds(new Set(assets.map((a) => a.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectCount = (n: number) => {
    const ids = assets.slice(0, n).map((a) => a.id);
    setSelectedIds(new Set(ids));
  };

  // Select all filtered assets (up to 2000)
  const selectAllFiltered = useCallback(async () => {
    let query = supabase
      .from('assets')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (filters.textSearch) query = query.or(`title.ilike.%${filters.textSearch}%`);
    if (filters.reviewStatus) query = query.eq('review_status', filters.reviewStatus);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.importBatch) query = query.eq('import_batch_id', filters.importBatch);
    if (filters.metadataFilter === 'without_species') query = query.is('species_id', null);

    const { data } = await query;
    setSelectedIds(new Set((data ?? []).map((r: { id: string }) => r.id)));
  }, [filters, supabase]);

  // ── ETA calculation ──────────────────────────────────────────────────────────
  const calcETA = (processed: number, total: number, startedAt: number): string => {
    if (processed === 0) return '—';
    const elapsed = Date.now() - startedAt;
    const rate = processed / elapsed; // assets per ms
    const remaining = (total - processed) / rate;
    if (remaining < 60000) return `~${Math.ceil(remaining / 1000)}s`;
    return `~${Math.ceil(remaining / 60000)}min`;
  };

  // ── Run identification ───────────────────────────────────────────────────────
  const runIdentification = async () => {
    const toProcessIds = selectedIds.size > 0
      ? Array.from(selectedIds)
      : assets.map((a) => a.id);

    if (toProcessIds.length === 0) { setError('Select at least one asset.'); return; }

    setError(null);
    setSuccess(null);
    abortRef.current = false;
    pauseRef.current = false;

    const batchId = `batch-${Date.now()}`;
    const newBatch: BatchJob = {
      id: batchId,
      jobIds: [],
      assetCount: toProcessIds.length,
      reviewer: profile?.full_name ?? profile?.email ?? 'Reviewer',
      createdAt: new Date().toISOString(),
      status: 'running',
      processed: 0,
      errors: [],
      startedAt: Date.now(),
      estimatedMs: toProcessIds.length * 200,
    };
    setBatchJob(newBatch);

    // Pipeline animation (initial steps)
    for (let i = 0; i < 5; i++) {
      if (abortRef.current) break;
      setCurrentStepIdx(i);
      await new Promise((r) => setTimeout(r, 400 + i * 100));
    }

    const CHUNK = 20;
    const allJobIds: string[] = [];
    let errorCount = 0;

    for (let i = 0; i < toProcessIds.length; i += CHUNK) {
      // Pause support
      while (pauseRef.current && !abortRef.current) {
        setBatchJob((prev) => prev ? { ...prev, status: 'paused' } : prev);
        await new Promise((r) => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      setBatchJob((prev) => prev ? { ...prev, status: 'running' } : prev);

      const chunkIds = toProcessIds.slice(i, i + CHUNK);

      // Fetch full metadata for chunk
      const { data: enrichedAssets, error: fetchErr } = await supabase
        .from('assets')
        .select(`
          id, title, category, product_form, packaging, description,
          species:species_id (common_name, scientific_name, family),
          asset_keywords (keywords (term))
        `)
        .in('id', chunkIds);

      if (fetchErr) {
        errorCount++;
        setBatchJob((prev) => prev ? { ...prev, errors: [...prev.errors, `Chunk ${i}: ${fetchErr.message}`] } : prev);
        continue;
      }

      const enrichedMap = new Map<string, {
        title: string | null; category: string | null;
        product_form: string | null; packaging: string | null; description: string | null;
        species: { common_name: string; scientific_name: string; family: string } | null;
        keywords: string[];
      }>();

      for (const ea of (enrichedAssets ?? [])) {
        const speciesData = ea.species as { common_name: string; scientific_name: string; family: string } | null;
        const kws = (ea.asset_keywords as { keywords: { term: string } | null }[] ?? [])
          .map((ak: { keywords: { term: string } | null }) => ak.keywords?.term)
          .filter((t: string | undefined): t is string => !!t);
        enrichedMap.set(ea.id, {
          title: ea.title ?? null,
          category: ea.category ?? null, product_form: ea.product_form ?? null,
          packaging: ea.packaging ?? null, description: ea.description ?? null,
          species: speciesData, keywords: kws,
        });
      }

      // Build job rows
      const jobRows = chunkIds.map((assetId) => {
        const enriched = enrichedMap.get(assetId);
        const asset = assets.find((a) => a.id === assetId);
        const hasSpecies = !!(enriched?.species?.common_name);
        const hasKeywords = (enriched?.keywords?.length ?? 0) > 0;
        const hasProductForm = !!(enriched?.product_form);
        const baseConf = hasSpecies ? 88 : hasKeywords ? 74 : 65;
        return {
          asset_id: assetId,
          public_asset_id: asset?.public_asset_id ?? null,
          current_name: enriched?.title ?? asset?.title ?? null,
          current_category: enriched?.category ?? asset?.category ?? null,
          job_status: 'proposals_ready',
          progress_step: 'proposals_ready',
          progress_pct: 100,
          ai_provider: 'mock',
          ai_model: 'seafood-vision-mock-v2',
          processing_time_ms: 180,
          ambiguity_detected: true,
          vision_confidence: Math.round(baseConf * 0.9),
          species_confidence: baseConf,
          commercial_confidence: Math.round(baseConf * (hasProductForm ? 0.82 : 0.65)),
          metadata_confidence: Math.round(baseConf * (hasKeywords ? 0.78 : 0.55)),
          documentation_confidence: Math.round(baseConf * 0.4),
          global_confidence: Math.round(baseConf * 0.7 + (baseConf * 0.85) * 0.3),
          reviewer_id: profile?.id ?? null,
        };
      });

      const { data: insertedJobs, error: jobErr } = await supabase
        .from('sie_jobs')
        .insert(jobRows)
        .select('id, asset_id');

      if (jobErr) {
        errorCount++;
        setBatchJob((prev) => prev ? { ...prev, errors: [...prev.errors, `Job insert: ${jobErr.message}`] } : prev);
        continue;
      }

      // Generate Top 5 candidates per job
      const candidateRows: Record<string, unknown>[] = [];
      const suggestionRows: Record<string, unknown>[] = [];

      for (const job of (insertedJobs ?? [])) {
        const enriched = enrichedMap.get(job.asset_id);
        const asset = assets.find((a) => a.id === job.asset_id);
        const speciesData = enriched?.species ?? null;
        const genus = speciesData?.scientific_name?.split(' ')[0] ?? null;

        const context: MockAssetContext = {
          assetId: job.asset_id,
          title: enriched?.title ?? asset?.title ?? null,
          fileName: null,
          category: enriched?.category ?? asset?.category ?? null,
          productForm: enriched?.product_form ?? null,
          packaging: enriched?.packaging ?? null,
          description: enriched?.description ?? null,
          existingSpeciesCommonName: speciesData?.common_name ?? null,
          existingSpeciesScientificName: speciesData?.scientific_name ?? null,
          existingSpeciesFamily: speciesData?.family ?? null,
          existingSpeciesGenus: genus,
          keywords: enriched?.keywords ?? [],
          importBatch: asset?.import_batch_id ?? null,
          folderPath: null,
        };

        const candidates = generateEnrichedMockCandidates(job.id, context);
        for (const c of candidates) {
          candidateRows.push({
            job_id: job.id, rank: c.rank, common_name: c.common_name,
            scientific_name: c.scientific_name, family: c.family, genus: c.genus,
            ai_score: c.ai_score, similarity_score: c.similarity_score,
            main_reasons: c.main_reasons, product_form: c.product_form,
            source_provider: c.source_provider, commercial_name: c.commercial_name,
            description_candidate: c.description_candidate, category_candidate: c.category_candidate,
            packaging_candidate: c.packaging_candidate, product_candidate: c.product_candidate,
            keywords_candidate: c.keywords_candidate,
          });
        }

        const topCandidate = candidates[0];
        if (job.asset_id && topCandidate) {
          suggestionRows.push({
            asset_id: job.asset_id,
            field_name: 'species_candidate',
            suggested_value: topCandidate.scientific_name,
            source: 'ai_generated',
            confidence_score: Math.min(1, (topCandidate.ai_score ?? 0) / 100),
            status: 'under_review',
            review_note: `AI Job: ${job.id} | Top: ${topCandidate.common_name} (${topCandidate.scientific_name}) | ${topCandidate.ai_score}% | Mock Engine v2 | Human validation required`,
          });
        }

        allJobIds.push(job.id);
      }

      if (candidateRows.length > 0) await supabase.from('sie_species_candidates').insert(candidateRows);
      if (suggestionRows.length > 0) await supabase.from('metadata_suggestions').insert(suggestionRows);

      const newProcessed = Math.min(i + CHUNK, toProcessIds.length);
      setBatchJob((prev) => prev ? {
        ...prev,
        processed: newProcessed,
        jobIds: [...prev.jobIds, ...allJobIds.slice(prev.jobIds.length)],
      } : prev);
      setCurrentStepIdx(5);
    }

    setCurrentStepIdx(6);
    const finalStatus = abortRef.current ? 'failed' : 'completed';
    setBatchJob((prev) => prev ? {
      ...prev,
      status: finalStatus,
      jobIds: allJobIds,
      processed: abortRef.current ? prev.processed : toProcessIds.length,
    } : prev);

    if (!abortRef.current) {
      setSuccess(`${allJobIds.length} jobs created · ${allJobIds.length * 5} Top 5 proposals generated · ${errorCount > 0 ? `${errorCount} errors` : 'No errors'}`);
      fetchRecentJobs();
      fetchIdentifiedIds();
    }
  };

  // ── Filter helpers ───────────────────────────────────────────────────────────
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({ reviewStatus: '', metadataFilter: '', category: '', importBatch: '', textSearch: '', aiStatus: '' });
    setSearchInput('');
    setCurrentPage(0);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }
  if (!['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return null;

  const isRunning = batchJob?.status === 'running';
  const isPaused = batchJob?.status === 'paused';
  const isCompleted = batchJob?.status === 'completed';
  const progressPct = batchJob
    ? Math.round((batchJob.processed / batchJob.assetCount) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
              <Brain size={18} className="text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">AI Gallery — Identify with AI</h1>
                <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
                  Mock Engine v2
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Step 1: Select assets · Step 2: Launch AI · Step 3: Review proposals
              </p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← AI Studio
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Left panel ── */}
          <div className="space-y-4">

            {/* Selection controls */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckSquare size={11} />Selection
              </h3>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[1, 50, 100, 500].map((n) => (
                  <button key={n} onClick={() => selectCount(n)}
                    className="px-2 py-1.5 text-xs font-medium bg-muted/40 border border-border rounded-lg hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                    {n} assets
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <button onClick={selectPage}
                  className="w-full px-2 py-1.5 text-xs font-medium bg-muted/40 border border-border rounded-lg hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                  Select page ({assets.length})
                </button>
                <button onClick={selectAllFiltered}
                  className="w-full px-2 py-1.5 text-xs font-medium bg-muted/40 border border-border rounded-lg hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                  Select all filtered ({totalCount})
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={clearSelection}
                    className="w-full px-2 py-1.5 text-xs font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-all">
                    Clear selection
                  </button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <p className="text-xs text-violet-600 font-semibold mt-2 text-center bg-violet-50 rounded-lg py-1.5">
                  {selectedIds.size} selected
                </p>
              )}
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
              <button onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <Filter size={11} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-violet-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Search assets..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateFilter('textSearch', searchInput); }}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-300" />
                  </div>

                  {[
                    { label: 'Review Status', key: 'reviewStatus' as keyof FilterState, options: REVIEW_STATUS_OPTIONS },
                    { label: 'Metadata', key: 'metadataFilter' as keyof FilterState, options: METADATA_FILTER_OPTIONS },
                    { label: 'AI Status', key: 'aiStatus' as keyof FilterState, options: AI_STATUS_OPTIONS },
                  ].map(({ label, key, options }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                      <select value={filters[key] as string} onChange={(e) => updateFilter(key, e.target.value)}
                        className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}

                  {categories.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                      <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}
                        className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                        <option value="">All categories</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {importBatches.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Import Batch</label>
                      <select value={filters.importBatch} onChange={(e) => updateFilter('importBatch', e.target.value)}
                        className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300">
                        <option value="">All batches</option>
                        {importBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                      className="w-full text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1 py-1">
                      <X size={10} />Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Batch Job Panel */}
            {batchJob && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Zap size={11} className="text-violet-500" />AI Job
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    batchJob.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    batchJob.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    batchJob.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                    batchJob.status === 'failed'? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{batchJob.status}</span>
                </div>

                {/* Job metadata */}
                <div className="space-y-1 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job ID</span>
                    <span className="font-mono text-foreground truncate max-w-[100px]">{batchJob.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reviewer</span>
                    <span className="text-foreground truncate max-w-[100px]">{batchJob.reviewer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assets</span>
                    <span className="text-foreground font-semibold">{batchJob.assetCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processed</span>
                    <span className="text-foreground">{batchJob.processed}/{batchJob.assetCount}</span>
                  </div>
                  {isRunning && batchJob.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ETA</span>
                      <span className="text-foreground">{calcETA(batchJob.processed, batchJob.assetCount, batchJob.startedAt)}</span>
                    </div>
                  )}
                  {batchJob.errors.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-500">Errors</span>
                      <span className="text-red-600 font-semibold">{batchJob.errors.length}</span>
                    </div>
                  )}
                </div>

                {/* Pipeline steps */}
                <div className="space-y-1 mb-3">
                  {PIPELINE_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i === currentStepIdx && isRunning;
                    const isDone = i < currentStepIdx || isCompleted;
                    return (
                      <div key={step.key}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${isActive ? 'bg-violet-50 border border-violet-200' : isDone ? 'opacity-60' : 'opacity-20'}`}>
                        <StepIcon size={10} className={isActive ? 'text-violet-600' : isDone ? 'text-emerald-500' : 'text-muted-foreground'} />
                        <span className={`text-xs flex-1 ${isActive ? 'text-violet-700 font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                        {isActive && <Loader2 size={9} className="text-violet-500 animate-spin" />}
                        {isDone && !isActive && <CheckCircle2 size={9} className="text-emerald-500" />}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 mb-1">
                  <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{batchJob.processed}/{batchJob.assetCount}</span>
                  <span>{progressPct}%</span>
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  {isRunning && (
                    <button onClick={() => { pauseRef.current = true; }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-all">
                      <Pause size={11} />Pause
                    </button>
                  )}
                  {isPaused && (
                    <button onClick={() => { pauseRef.current = false; }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all">
                      <Play size={11} />Resume
                    </button>
                  )}
                  {(isRunning || isPaused) && (
                    <button onClick={() => { abortRef.current = true; pauseRef.current = false; }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-all">
                      <X size={11} />Stop
                    </button>
                  )}
                  {(isCompleted || batchJob.status === 'failed') && batchJob.errors.length > 0 && (
                    <button onClick={runIdentification}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-all">
                      <RotateCcw size={11} />Retry
                    </button>
                  )}
                </div>

                {/* Errors */}
                {batchJob.errors.length > 0 && (
                  <div className="mt-2 max-h-20 overflow-y-auto space-y-1">
                    {batchJob.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 truncate">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* IDENTIFY WITH AI button */}
            <button
              onClick={runIdentification}
              disabled={isRunning || isPaused || assets.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold px-6 py-4 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm text-sm">
              {isRunning ? (
                <><Loader2 size={16} className="animate-spin" />Processing...</>
              ) : (
                <><Brain size={16} />IDENTIFY WITH AI</>
              )}
            </button>

            {/* Feedback */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <X size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <p className="text-xs text-emerald-700 font-semibold">✓ {success}</p>
                <div className="flex flex-col gap-1">
                  <Link href="/admin/ai-studio/validation"
                    className="text-xs text-violet-600 underline hover:no-underline flex items-center gap-1">
                    <ArrowRight size={10} />Human Validation Workspace
                  </Link>
                  <Link href="/admin/metadata-review/assets"
                    className="text-xs text-blue-600 underline hover:no-underline flex items-center gap-1">
                    <ArrowRight size={10} />Metadata Review Center
                  </Link>
                </div>
              </div>
            )}

            {/* Safety notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                No automatic publishing. All proposals remain <strong>Draft / Pending Review</strong>.
              </p>
            </div>

            {/* Recent jobs */}
            {recentJobs.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Clock size={11} />Recent Jobs
                </h3>
                <div className="space-y-2">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate max-w-[120px]">
                        {job.current_name ?? job.public_asset_id ?? job.id.slice(0, 8)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        job.job_status === 'proposals_ready' ? 'bg-blue-100 text-blue-700' :
                        job.job_status === 'validated'? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>{job.job_status}</span>
                    </div>
                  ))}
                </div>
                <Link href="/admin/ai-studio/validation"
                  className="text-xs text-violet-600 hover:underline mt-2 block text-center">
                  View all →
                </Link>
              </div>
            )}
          </div>

          {/* ── Right panel: Asset gallery ── */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-xl overflow-hidden">

              {/* Gallery toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {assetsLoading ? 'Loading...' : `${totalCount} assets`}
                  </span>
                  {selectedIds.size > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
                      {selectedIds.size} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => fetchAssets(currentPage)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={selectPage}
                    className="text-xs text-muted-foreground hover:text-violet-600 transition-colors px-2 py-1 rounded hover:bg-violet-50">
                    Select page
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={clearSelection}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery grid */}
              {assetsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-7 h-7 border-2 border-border border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <Fish size={36} className="text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">No assets found</p>
                  <p className="text-xs text-muted-foreground mt-1">Adjust filters or import assets</p>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="mt-3 text-xs text-violet-600 underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-4 max-h-[680px] overflow-y-auto">
                  {assets.map((asset) => {
                    const isSelected = selectedIds.has(asset.id);
                    const statusColor = STATUS_COLORS[asset.review_status ?? 'draft'] ?? 'bg-gray-100 text-gray-600';
                    const isIdentified = identifiedAssetIds.has(asset.id);
                    return (
                      <div key={asset.id}
                        onClick={() => toggleSelect(asset.id)}
                        className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-150 group ${isSelected
                          ? 'border-violet-500 shadow-lg shadow-violet-100'
                          : 'border-border hover:border-violet-300 hover:shadow-md'}`}>

                        {/* Thumbnail */}
                        <div className="aspect-square bg-muted relative">
                          <AssetThumb asset={asset} />

                          {/* Selection overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-violet-500/15 flex items-start justify-end p-1.5">
                              <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow">
                                <CheckSquare size={11} className="text-white" />
                              </div>
                            </div>
                          )}
                          {!isSelected && (
                            <div className="absolute inset-0 flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-5 h-5 rounded-full bg-white/80 border border-border flex items-center justify-center shadow">
                                <Square size={10} className="text-muted-foreground" />
                              </div>
                            </div>
                          )}

                          {/* AI identified badge */}
                          {isIdentified && (
                            <div className="absolute top-1 left-1">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-0.5">
                                <Brain size={7} />AI
                              </span>
                            </div>
                          )}

                          {/* Status badge */}
                          {asset.review_status && (
                            <div className="absolute bottom-1 left-1">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                {asset.review_status}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2 bg-card">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">
                            {asset.title ?? '—'}
                          </p>
                          {asset.public_asset_id && (
                            <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                              {asset.public_asset_id}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {asset.category && (
                              <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded font-medium">
                                {asset.category}
                              </span>
                            )}
                            {!asset.species_id && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded font-medium">
                                No species
                              </span>
                            )}
                          </div>
                          {asset.created_at && (
                            <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                              <Clock size={8} />
                              {new Date(asset.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage + 1} of {totalPages} · {totalCount} total
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => fetchAssets(currentPage - 1)} disabled={currentPage === 0}
                      className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-foreground font-medium">{currentPage + 1}</span>
                    <button onClick={() => fetchAssets(currentPage + 1)} disabled={currentPage >= totalPages - 1}
                      className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stats bar */}
            {!assetsLoading && assets.length > 0 && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground px-1 flex-wrap">
                <span className="flex items-center gap-1"><Tag size={10} />{assets.filter((a) => a.review_status === 'approved').length} approved</span>
                <span className="flex items-center gap-1"><Clock size={10} />{assets.filter((a) => a.review_status === 'under_review').length} under review</span>
                <span className="flex items-center gap-1"><Fish size={10} />{assets.filter((a) => !a.species_id).length} without species</span>
                <span className="flex items-center gap-1"><Brain size={10} />{assets.filter((a) => identifiedAssetIds.has(a.id)).length} AI identified</span>
                <span className="ml-auto text-violet-600 font-medium">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected — ready for AI` : 'Select assets to identify'}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
