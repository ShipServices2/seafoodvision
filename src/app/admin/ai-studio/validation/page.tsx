'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';
import { Target, CheckCircle2, XCircle, HelpCircle, Edit3, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Clock, Fish, Tag, Layers, Star, Brain, Globe, Zap, CheckSquare, ArrowRight, Package, Hash, BookOpen, Search, Loader2, Eye, BarChart2, List, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  rank: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  order_name: string | null;
  ai_score: number;
  similarity_score: number;
  main_reasons: string[];
  product_form: string | null;
  commercial_name: string | null;
  description_candidate: string | null;
  category_candidate: string | null;
  packaging_candidate: string | null;
  product_candidate: string | null;
  keywords_candidate: string[] | null;
  is_selected: boolean;
  is_validated: boolean;
  source_provider: string;
  asset_id: string | null;
  provider_mode?: string;
  confidence_score?: number | null;
  biological_order?: string | null;
  visual_evidence?: string[] | null;
  identification_limits?: string[] | null;
  reasoning_summary?: string | null;
  is_real_ai?: boolean;
  result_id?: string | null;
}

interface OpenAIPilotCandidate {
  id: string;
  rank: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  biological_order: string | null;
  taxonomic_level: string | null;
  confidence_score: number | null;
  visual_evidence: string[] | null;
  identification_limits: string[] | null;
  source: string | null;
  provider: string | null;
  provider_mode: string | null;
  is_selected: boolean;
  is_validated: boolean;
  status: string | null;
  result_id: string;
  asset_id: string | null;
  public_asset_id: string;
}

interface OpenAIPilotMetadata {
  id: string;
  species_name: string | null;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  biological_order: string | null;
  commercial_names: string[] | null;
  local_names_fr: string[] | null;
  local_names_en: string[] | null;
  local_names_es: string[] | null;
  local_names_pt: string[] | null;
  local_names_ar: string[] | null;
  synonyms: string[] | null;
  category: string | null;
  product_form: string | null;
  conservation_method: string | null;
  packaging: string | null;
  keywords: string[] | null;
  short_description: string | null;
  vision_confidence: number | null;
  species_confidence: number | null;
  commercial_confidence: number | null;
  metadata_confidence: number | null;
  global_confidence: number | null;
  warnings: string[] | null;
}

interface SIEJob {
  id: string;
  asset_id: string | null;
  public_asset_id: string | null;
  current_name: string | null;
  current_category: string | null;
  job_status: string;
  global_confidence: number | null;
  reviewer_comment: string | null;
  created_at: string;
  reviewer_id: string | null;
  ai_model: string | null;
  ai_provider: string | null;
  vision_confidence: number | null;
  species_confidence: number | null;
  commercial_confidence: number | null;
  metadata_confidence: number | null;
  validation_progress?: number | null;
  processing_progress?: number | null;
  pilot_job_name?: string | null;
  provider_mode?: string | null;
  total_assets?: number | null;
  is_superseded?: boolean | null;
}

// Batch asset entry from openai_pilot_job_assets
interface BatchAsset {
  id: string; // openai_pilot_job_assets.id
  batch_job_id: string;
  asset_job_id: string | null;
  asset_id: string | null;
  public_asset_id: string;
  result_id: string | null;
  review_position: number;
  review_status: string;
  reviewed_at: string | null;
}

interface AssetPreviewData {
  storage_bucket: string | null;
  storage_path: string | null;
}

interface ValidationEntry {
  id: string;
  action: string;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  field_name: string | null;
}

interface FieldDecision {
  action: 'approve' | 'reject' | 'edit' | 'unknown';
  value?: string;
}

type ValidationField =
  | 'species' | 'scientific_name' | 'commercial_name' | 'local_names'
  | 'family' | 'genus' | 'order_name' | 'keywords' | 'category' | 'description' | 'packaging' | 'product_type' | 'confidence';

const VALIDATION_FIELDS: { key: ValidationField; label: string; icon: React.ElementType }[] = [
  { key: 'species', label: 'Species (Common Name)', icon: Fish },
  { key: 'scientific_name', label: 'Scientific Name', icon: BookOpen },
  { key: 'commercial_name', label: 'Commercial Name', icon: Tag },
  { key: 'local_names', label: 'Local Names (FR/EN/ES/PT/AR)', icon: Globe },
  { key: 'family', label: 'Family', icon: Layers },
  { key: 'genus', label: 'Genus', icon: Hash },
  { key: 'order_name', label: 'Biological Order', icon: BarChart2 },
  { key: 'keywords', label: 'Keywords', icon: Search },
  { key: 'category', label: 'Category', icon: CheckSquare },
  { key: 'description', label: 'Description', icon: MessageSquare },
  { key: 'packaging', label: 'Packaging', icon: Package },
  { key: 'product_type', label: 'Product Type', icon: Tag },
];

const ACTION_CONFIG = {
  approve: { label: 'Approve', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100', active: 'bg-emerald-100 border-emerald-500 ring-1 ring-emerald-400' },
  reject: { label: 'Reject', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-300 hover:bg-red-100', active: 'bg-red-100 border-red-500 ring-1 ring-red-400' },
  edit: { label: 'Edit', icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-300 hover:bg-blue-100', active: 'bg-blue-100 border-blue-500 ring-1 ring-blue-400' },
  unknown: { label: 'Unknown', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-300 hover:bg-gray-100', active: 'bg-gray-100 border-gray-500 ring-1 ring-gray-400' },
} as const;

const JOB_STATUS_COLORS: Record<string, string> = {
  proposals_ready: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  validated: 'bg-emerald-100 text-emerald-700',
  partially_validated: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
  queued: 'bg-violet-100 text-violet-700',
  processing: 'bg-blue-100 text-blue-600',
  failed: 'bg-red-100 text-red-600',
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  unreviewed: 'bg-gray-100 text-gray-600',
  validated: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const PROPAGATION_TARGETS = [
  { key: 'assets', label: 'Assets', icon: Fish },
  { key: 'asset_species', label: 'Asset Species', icon: Layers },
  { key: 'species_center', label: 'Species Center', icon: Layers },
  { key: 'knowledge_graph', label: 'Knowledge Graph', icon: Globe },
  { key: 'search_index', label: 'Search Index', icon: Search },
  { key: 'marketplace', label: 'Marketplace', icon: Tag },
  { key: 'library', label: 'Public Library', icon: BookOpen },
];

const PAGE_SIZE = 15;

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

// ─── Asset Preview Component ──────────────────────────────────────────────────
function AssetPreview({ preview }: { preview: AssetPreviewData | null }) {
  const [imgError, setImgError] = useState(false);
  const signedUrl = useSignedUrl(preview?.storage_bucket, preview?.storage_path);
  const hasImage = !!signedUrl && !imgError;

  return hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={signedUrl!}
      alt="Asset preview"
      className="w-full aspect-square object-cover"
      onError={() => setImgError(true)}
    />
  ) : (
    <div className="w-full aspect-square bg-muted flex items-center justify-center">
      <Fish size={48} className="text-muted-foreground" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function AIStudioValidationPageInner() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL params — source of truth for persistence
  const urlJobId = searchParams.get('job');
  const urlPosition = searchParams.get('position');

  // ── All pilot batch jobs (job selector) ───────────────────────────────────
  const [allBatchJobs, setAllBatchJobs] = useState<SIEJob[]>([]);
  const [selectedBatchJobId, setSelectedBatchJobId] = useState<string | null>(null);

  // ── Batch mode state ──────────────────────────────────────────────────────
  const [batchJob, setBatchJob] = useState<SIEJob | null>(null);
  const [batchAssets, setBatchAssets] = useState<BatchAsset[]>([]);
  // batchPosition is the index within the FULL (unfiltered) batchAssets array
  const [batchPosition, setBatchPosition] = useState(0);
  const [batchFilter, setBatchFilter] = useState<'all' | 'unreviewed' | 'validated' | 'skipped' | 'unknown'>('all');
  const [batchMode, setBatchMode] = useState(true); // default true — batch mode is primary
  const [autoAdvance, setAutoAdvance] = useState(true);

  // ── Legacy job list state (for non-batch sie_jobs) ────────────────────────
  const [jobs, setJobs] = useState<SIEJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SIEJob | null>(null);
  const [jobPage, setJobPage] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobStatusFilter, setJobStatusFilter] = useState('');

  // ── Current asset state ───────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<ValidationEntry[]>([]);
  const [assetPreview, setAssetPreview] = useState<AssetPreviewData | null>(null);
  const [assetTitle, setAssetTitle] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, FieldDecision>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [lastUndo, setLastUndo] = useState<{ jobId: string; prevStatus: string } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [propagating, setPropagating] = useState(false);
  const [propagationDone, setPropagationDone] = useState<string[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [validationStats, setValidationStats] = useState<{ total: number; validated: number; skipped: number; unknown: number }>({ total: 0, validated: 0, skipped: 0, unknown: 0 });
  const [pilotMetadata, setPilotMetadata] = useState<OpenAIPilotMetadata | null>(null);
  const [showPilotMetadata, setShowPilotMetadata] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // ── Backfill state ────────────────────────────────────────────────────────
  const [showBackfillPanel, setShowBackfillPanel] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMode, setBackfillMode] = useState<'audit' | 'backfill'>('audit');
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    job_id?: string;
    job_name?: string;
    mode?: string;
    summary?: {
      total_audited: number;
      complete: number;
      partial: number;
      none: number;
      errors?: number;
      repaired?: number;
      species_reused?: number;
      species_created?: number;
      asset_species_written?: number;
      aliases_created?: number;
      indexes_rebuilt?: number;
      repair_errors?: Array<{ asset_id: string; public_asset_id: string; errors: string[] }>;
    };
    error?: string;
  } | null>(null);

  const handleRunBackfill = async (mode: 'audit' | 'backfill') => {
    if (backfillLoading) return;
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const res = await fetch('/api/admin/backfill-propagation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, jobId: selectedBatchJobId }),
      });
      const data = await res.json();
      setBackfillResult(data);
    } catch (err) {
      setBackfillResult({ success: false, error: `Network error: ${err}` });
    } finally {
      setBackfillLoading(false);
    }
  };

  // Track if initial load has run (to avoid double-loading)
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/validation'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  // ── Update URL to persist job + position ─────────────────────────────────
  const updateUrl = useCallback((jobId: string | null, position: number) => {
    const params = new URLSearchParams();
    if (jobId) params.set('job', jobId);
    if (position > 0) params.set('position', String(position));
    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router]);

  // ── Load ALL batch jobs (job selector) — excludes superseded duplicates ───
  const loadAllBatchJobs = useCallback(async () => {
    const supabase = createClient();
    try {
      // Only load non-superseded jobs. If is_superseded column doesn't exist yet
      // (migration pending), fall back to all real_ai pilot jobs.
      let query = supabase
        .from('sie_jobs')
        .select('*')
        .not('pilot_job_name', 'is', null)
        .eq('provider_mode', 'real_ai')
        .order('created_at', { ascending: false });

      const { data: allJobs, error: allJobsError } = await query;

      if (allJobsError || !allJobs || allJobs.length === 0) return;

      // Filter out superseded jobs client-side (handles both old and new schema)
      const pilotJobs = (allJobs as SIEJob[]).filter(
        (j) => j.is_superseded !== true && !j.pilot_job_name?.includes('[superseded]')
      );

      if (pilotJobs.length === 0) {
        // Fallback: if all are marked superseded (shouldn't happen), show all
        setAllBatchJobs(allJobs as SIEJob[]);
      } else {
        setAllBatchJobs(pilotJobs);
      }

      const activePilotJobs = pilotJobs.length > 0 ? pilotJobs : (allJobs as SIEJob[]);

      // Determine which job to auto-select:
      // Priority 1: job specified in URL param (must be non-superseded)
      // Priority 2: most recent non-superseded job that still has unreviewed assets
      // Priority 3: most recent non-superseded job overall
      let targetJobId: string | null = null;

      if (urlJobId) {
        const urlJob = activePilotJobs.find((j) => j.id === urlJobId);
        if (urlJob) targetJobId = urlJob.id;
      }

      if (!targetJobId) {
        for (const job of activePilotJobs) {
          const { count: unreviewedCount } = await supabase
            .from('openai_pilot_job_assets')
            .select('*', { count: 'exact', head: true })
            .eq('batch_job_id', job.id)
            .eq('review_status', 'unreviewed');

          if ((unreviewedCount ?? 0) > 0) {
            targetJobId = job.id;
            break;
          }
        }
      }

      if (!targetJobId && activePilotJobs.length > 0) {
        targetJobId = activePilotJobs[0].id;
      }

      if (targetJobId) {
        setSelectedBatchJobId(targetJobId);
      }
    } catch (err) {
      console.error('[loadAllBatchJobs] Error:', err);
    }
  }, [urlJobId]);

  // ── Load batch assets when selected batch job changes ─────────────────────
  // CRITICAL: always uses try/catch/finally so loading never hangs forever
  const [batchLoadError, setBatchLoadError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadBatchJobAssets = useCallback(async (jobId: string) => {
    const supabase = createClient();

    const targetJob = allBatchJobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    setBatchJob(targetJob);
    setBatchMode(true);
    setBatchLoading(true);
    setBatchLoadError(null);

    try {
      // Load from openai_pilot_job_assets — the persistent source of truth
      const { data: jobAssets, error: jaError } = await supabase
        .from('openai_pilot_job_assets')
        .select('*')
        .eq('batch_job_id', jobId)
        .order('review_position', { ascending: true });

      if (jaError) {
        throw new Error(`openai_pilot_job_assets query failed: ${jaError.message} (table: openai_pilot_job_assets, job: ${jobId})`);
      }

      if (jobAssets && jobAssets.length > 0) {
        setBatchAssets(jobAssets as BatchAsset[]);

        // Restore position from URL or find first unreviewed
        const urlPos = urlPosition ? parseInt(urlPosition, 10) : null;
        if (urlPos && urlPos >= 1 && urlPos <= jobAssets.length) {
          setBatchPosition(urlPos - 1); // URL is 1-based, state is 0-based
        } else {
          const firstUnreviewedIdx = (jobAssets as BatchAsset[]).findIndex(
            (a) => a.review_status === 'unreviewed'
          );
          setBatchPosition(firstUnreviewedIdx >= 0 ? firstUnreviewedIdx : 0);
        }
        return;
      }

      // Fallback: batch was imported before openai_pilot_job_assets was populated
      // Build synthetic BatchAsset entries from openai_pilot_results and insert them
      const { data: pilotResults, error: prError } = await supabase
        .from('openai_pilot_results')
        .select('id, asset_id, public_asset_id, review_status, human_validated, requires_human_review')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (prError) {
        throw new Error(`openai_pilot_results query failed: ${prError.message} (table: openai_pilot_results, job: ${jobId})`);
      }

      if (!pilotResults || pilotResults.length === 0) {
        // Truly empty batch — show 0 assets, not infinite spinner
        setBatchAssets([]);
        setBatchPosition(0);
        return;
      }

      const newAssets: BatchAsset[] = [];
      let position = 1;

      for (const result of pilotResults) {
        const reviewStatus = result.human_validated ? 'validated' : 'unreviewed';

        // Try to insert — ignore conflicts
        const { data: inserted } = await supabase
          .from('openai_pilot_job_assets')
          .insert({
            batch_job_id: jobId,
            asset_id: result.asset_id,
            public_asset_id: result.public_asset_id,
            result_id: result.id,
            review_position: position,
            review_status: reviewStatus,
          })
          .select('*')
          .single();

        if (inserted) {
          newAssets.push(inserted as BatchAsset);
        } else {
          // Insert failed (conflict) — fetch the existing row
          const { data: existing } = await supabase
            .from('openai_pilot_job_assets')
            .select('*')
            .eq('batch_job_id', jobId)
            .eq('public_asset_id', result.public_asset_id)
            .single();

          if (existing) {
            newAssets.push(existing as BatchAsset);
          } else {
            // Last resort: synthetic entry (not persisted)
            newAssets.push({
              id: `synthetic-${result.id}`,
              batch_job_id: jobId,
              asset_job_id: null,
              asset_id: result.asset_id,
              public_asset_id: result.public_asset_id,
              result_id: result.id,
              review_position: position,
              review_status: reviewStatus,
              reviewed_at: null,
            });
          }
        }
        position++;
      }

      // Sort by review_position
      newAssets.sort((a, b) => a.review_position - b.review_position);
      setBatchAssets(newAssets);

      // Restore position from URL or find first unreviewed
      const urlPos = urlPosition ? parseInt(urlPosition, 10) : null;
      if (urlPos && urlPos >= 1 && urlPos <= newAssets.length) {
        setBatchPosition(urlPos - 1);
      } else {
        const firstUnreviewedIdx = newAssets.findIndex((a) => a.review_status === 'unreviewed');
        setBatchPosition(firstUnreviewedIdx >= 0 ? firstUnreviewedIdx : 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[loadBatchJobAssets] Error:', msg);
      setBatchLoadError(msg);
      setBatchAssets([]);
    } finally {
      // CRITICAL: always stop loading — never leave spinner running forever
      setBatchLoading(false);
    }
  }, [allBatchJobs, urlPosition]);

  // ── When selectedBatchJobId changes, load its assets ─────────────────────
  useEffect(() => {
    if (selectedBatchJobId && allBatchJobs.length > 0) {
      loadBatchJobAssets(selectedBatchJobId);
    }
  }, [selectedBatchJobId, allBatchJobs, loadBatchJobAssets]);

  // ── Fetch legacy jobs list ────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('sie_jobs')
      .select('*', { count: 'exact' })
      .is('pilot_job_name', null)
      .order('created_at', { ascending: false })
      .range(jobPage * PAGE_SIZE, (jobPage + 1) * PAGE_SIZE - 1);

    if (jobStatusFilter) {
      query = query.eq('job_status', jobStatusFilter);
    } else {
      query = query.in('job_status', ['queued', 'proposals_ready', 'under_review', 'validated', 'partially_validated', 'rejected', 'unknown', 'failed']);
    }

    const { data, count } = await query;
    const jobList = data ?? [];
    setJobs(jobList);
    setJobTotal(count ?? 0);
    setFetching(false);

    if (jobList.length > 0 && !selectedJob && !batchMode) {
      setSelectedJob(jobList[0]);
    }
  }, [profile, jobPage, selectedJob, jobStatusFilter, batchMode]);

  // ── Fetch batch stats from openai_pilot_job_assets ────────────────────────
  const fetchBatchStats = useCallback(async (assets?: BatchAsset[]) => {
    const source = assets ?? batchAssets;
    if (source.length === 0 && !batchJob) return;

    if (source.length > 0) {
      // Compute from local state (fast, always in sync)
      const total = source.length;
      const validated = source.filter((a) => a.review_status === 'validated').length;
      const skipped = source.filter((a) => a.review_status === 'skipped').length;
      const unknown = source.filter((a) => a.review_status === 'unknown').length;
      setValidationStats({ total, validated, skipped, unknown });
      return;
    }

    // Fallback: query DB
    if (!batchJob) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('openai_pilot_job_assets')
      .select('review_status')
      .eq('batch_job_id', batchJob.id);

    if (!data) return;
    const total = data.length;
    const validated = data.filter((a) => a.review_status === 'validated').length;
    const skipped = data.filter((a) => a.review_status === 'skipped').length;
    const unknown = data.filter((a) => a.review_status === 'unknown').length;
    setValidationStats({ total, validated, skipped, unknown });
  }, [batchJob, batchAssets]);

  // ── Fetch validation stats (legacy) ──────────────────────────────────────
  const fetchValidationStats = useCallback(async () => {
    if (batchJob) { fetchBatchStats(); return; }
    const supabase = createClient();
    const [totalRes, validatedRes] = await Promise.all([
      supabase.from('sie_jobs').select('id', { count: 'exact', head: true })
        .in('job_status', ['proposals_ready', 'under_review', 'validated', 'partially_validated']),
      supabase.from('sie_jobs').select('id', { count: 'exact', head: true })
        .eq('job_status', 'validated'),
    ]);
    setValidationStats({
      total: totalRes.count ?? 0,
      validated: validatedRes.count ?? 0,
      skipped: 0,
      unknown: 0,
    });
  }, [batchJob, fetchBatchStats]);

  useEffect(() => {
    if (profile && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadAllBatchJobs();
      fetchJobs();
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchValidationStats(); }, [fetchValidationStats]);

  // ── Recompute stats whenever batchAssets changes ──────────────────────────
  useEffect(() => {
    if (batchAssets.length > 0) {
      fetchBatchStats(batchAssets);
    }
  }, [batchAssets]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current batch asset (derived from full list, not filtered) ────────────
  // Navigation uses the FULL list ordered by review_position.
  // The filter tabs are for display only.
  const filteredBatchAssets = batchAssets.filter((a) => {
    if (batchFilter === 'all') return true;
    return a.review_status === batchFilter;
  });

  // Current asset is always from the FULL list by batchPosition
  const currentBatchAsset = batchMode && batchAssets.length > 0
    ? batchAssets[batchPosition] ?? null
    : null;

  // Display position within the full list (1-based)
  const batchDisplayPos = batchAssets.length > 0 ? batchPosition + 1 : 0;
  const batchTotal = batchAssets.length;

  // ── Effective "current job" — either from batch or legacy list ────────────
  const effectiveAssetId = batchMode ? currentBatchAsset?.asset_id ?? null : selectedJob?.asset_id ?? null;
  const effectiveJobId = batchMode ? currentBatchAsset?.asset_job_id ?? batchJob?.id ?? null : selectedJob?.id ?? null;
  const effectivePublicAssetId = batchMode ? currentBatchAsset?.public_asset_id ?? null : selectedJob?.public_asset_id ?? null;
  const effectiveResultId = batchMode ? currentBatchAsset?.result_id ?? null : null;

  const fetchCandidates = useCallback(async (assetId: string | null, resultId: string | null, jobId: string | null) => {
    const supabase = createClient();
    let rows: Candidate[] = [];

    // Primary: load OpenAI pilot candidates if we have a result_id
    if (resultId) {
      const { data: pilotCandidates } = await supabase
        .from('openai_pilot_candidates')
        .select('*')
        .eq('result_id', resultId)
        .order('rank', { ascending: true });

      if (pilotCandidates && pilotCandidates.length > 0) {
        rows = (pilotCandidates as OpenAIPilotCandidate[]).map((pc) => ({
          id: pc.id,
          rank: pc.rank,
          common_name: pc.common_name,
          scientific_name: pc.scientific_name,
          family: pc.family,
          genus: pc.genus,
          order_name: pc.biological_order,
          ai_score: Math.round((pc.confidence_score ?? 0) * 100),
          similarity_score: Math.round((pc.confidence_score ?? 0) * 100),
          main_reasons: pc.visual_evidence ?? [],
          product_form: null,
          commercial_name: null,
          description_candidate: null,
          category_candidate: null,
          packaging_candidate: null,
          product_candidate: null,
          keywords_candidate: null,
          is_selected: pc.is_selected,
          is_validated: pc.is_validated,
          source_provider: 'openai',
          asset_id: pc.asset_id,
          provider_mode: 'real_ai',
          confidence_score: pc.confidence_score,
          biological_order: pc.biological_order,
          visual_evidence: pc.visual_evidence,
          identification_limits: pc.identification_limits,
          is_real_ai: true,
          result_id: pc.result_id,
        }));
      }
    }

    // Fallback: load from openai_pilot_results by asset_id + job_id
    if (rows.length === 0 && assetId && jobId) {
      const { data: pilotResultData } = await supabase
        .from('openai_pilot_results')
        .select('id')
        .eq('asset_id', assetId)
        .eq('job_id', jobId)
        .eq('provider_mode', 'real_ai')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pilotResultData?.id) {
        const { data: pilotCandidates } = await supabase
          .from('openai_pilot_candidates')
          .select('*')
          .eq('result_id', pilotResultData.id)
          .order('rank', { ascending: true });

        if (pilotCandidates && pilotCandidates.length > 0) {
          rows = (pilotCandidates as OpenAIPilotCandidate[]).map((pc) => ({
            id: pc.id,
            rank: pc.rank,
            common_name: pc.common_name,
            scientific_name: pc.scientific_name,
            family: pc.family,
            genus: pc.genus,
            order_name: pc.biological_order,
            ai_score: Math.round((pc.confidence_score ?? 0) * 100),
            similarity_score: Math.round((pc.confidence_score ?? 0) * 100),
            main_reasons: pc.visual_evidence ?? [],
            product_form: null,
            commercial_name: null,
            description_candidate: null,
            category_candidate: null,
            packaging_candidate: null,
            product_candidate: null,
            keywords_candidate: null,
            is_selected: pc.is_selected,
            is_validated: pc.is_validated,
            source_provider: 'openai',
            asset_id: pc.asset_id,
            provider_mode: 'real_ai',
            confidence_score: pc.confidence_score,
            biological_order: pc.biological_order,
            visual_evidence: pc.visual_evidence,
            identification_limits: pc.identification_limits,
            is_real_ai: true,
            result_id: pc.result_id,
          }));
        }
      }
    }

    // Second fallback: load from openai_pilot_results by asset_id only
    if (rows.length === 0 && assetId) {
      const { data: pilotResultData } = await supabase
        .from('openai_pilot_results')
        .select('id')
        .eq('asset_id', assetId)
        .eq('provider_mode', 'real_ai')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pilotResultData?.id) {
        const { data: pilotCandidates } = await supabase
          .from('openai_pilot_candidates')
          .select('*')
          .eq('result_id', pilotResultData.id)
          .order('rank', { ascending: true });

        if (pilotCandidates && pilotCandidates.length > 0) {
          rows = (pilotCandidates as OpenAIPilotCandidate[]).map((pc) => ({
            id: pc.id,
            rank: pc.rank,
            common_name: pc.common_name,
            scientific_name: pc.scientific_name,
            family: pc.family,
            genus: pc.genus,
            order_name: pc.biological_order,
            ai_score: Math.round((pc.confidence_score ?? 0) * 100),
            similarity_score: Math.round((pc.confidence_score ?? 0) * 100),
            main_reasons: pc.visual_evidence ?? [],
            product_form: null,
            commercial_name: null,
            description_candidate: null,
            category_candidate: null,
            packaging_candidate: null,
            product_candidate: null,
            keywords_candidate: null,
            is_selected: pc.is_selected,
            is_validated: pc.is_validated,
            source_provider: 'openai',
            asset_id: pc.asset_id,
            provider_mode: 'real_ai',
            confidence_score: pc.confidence_score,
            biological_order: pc.biological_order,
            visual_evidence: pc.visual_evidence,
            identification_limits: pc.identification_limits,
            is_real_ai: true,
            result_id: pc.result_id,
          }));
        }
      }
    }

    // Also load sie_species_candidates (mock or legacy)
    if (jobId) {
      const { data: sieData } = await supabase
        .from('sie_species_candidates')
        .select('*')
        .eq('job_id', jobId)
        .order('rank', { ascending: true });

      const sieMapped = (sieData ?? []).map((r) => ({ ...r, is_real_ai: false, provider_mode: r.provider_mode ?? 'mock' }));
      rows = [...rows, ...sieMapped];
    } else if (assetId && rows.length === 0) {
      const { data: fallbackData } = await supabase
        .from('sie_species_candidates')
        .select('*')
        .eq('asset_id', assetId)
        .order('rank', { ascending: true })
        .limit(5);
      rows = [...rows, ...(fallbackData ?? []).map((r) => ({ ...r, is_real_ai: false, provider_mode: 'mock' }))];
    }

    setCandidates(rows);
    const rank1 = rows.find((c) => c.rank === 1);
    if (rank1) setSelectedCandidateId(rank1.id);
    else if (rows.length > 0) setSelectedCandidateId(rows[0].id);
    else setSelectedCandidateId(null);
  }, []);

  const fetchHistory = useCallback(async (jobId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sie_validation_history')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data ?? []);
  }, []);

  const fetchPilotMetadata = useCallback(async (candidateId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('openai_pilot_candidate_metadata')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    setPilotMetadata(data ?? null);
  }, []);

  const fetchAssetPreview = useCallback(async (assetId: string | null) => {
    if (!assetId) { setAssetPreview(null); setAssetTitle(null); setAssetStatus(null); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('assets')
      .select('title, review_status, asset_previews(storage_bucket, storage_path)')
      .eq('id', assetId)
      .single();
    if (data) {
      setAssetTitle(data.title ?? null);
      setAssetStatus(data.review_status ?? null);
      const preview = Array.isArray(data.asset_previews) ? data.asset_previews[0] : data.asset_previews;
      setAssetPreview(preview ? { storage_bucket: preview.storage_bucket, storage_path: preview.storage_path } : null);
    }
  }, []);

  // ── Load asset when batch position changes ────────────────────────────────
  useEffect(() => {
    if (batchMode && currentBatchAsset) {
      fetchCandidates(currentBatchAsset.asset_id, currentBatchAsset.result_id, currentBatchAsset.asset_job_id ?? batchJob?.id ?? null);
      fetchAssetPreview(currentBatchAsset.asset_id);
      if (currentBatchAsset.asset_job_id) fetchHistory(currentBatchAsset.asset_job_id);
      setFieldDecisions({});
      setEditValues({});
      setComment('');
      setPropagationDone([]);
      setConfirmDialogOpen(false);
      setConfirmSuccess(null);
      setConfirmError(null);
      // Update URL with current job + position (1-based)
      if (selectedBatchJobId) {
        updateUrl(selectedBatchJobId, batchPosition + 1);
      }
    }
  }, [batchMode, currentBatchAsset, fetchCandidates, fetchAssetPreview, fetchHistory, batchJob, selectedBatchJobId, batchPosition, updateUrl]);

  // ── Load asset when legacy job changes ────────────────────────────────────
  useEffect(() => {
    if (!batchMode && selectedJob) {
      fetchCandidates(selectedJob.asset_id, null, selectedJob.id);
      fetchHistory(selectedJob.id);
      fetchAssetPreview(selectedJob.asset_id);
      setFieldDecisions({});
      setEditValues({});
      setComment('');
      setPropagationDone([]);
      setConfirmDialogOpen(false);
      setConfirmSuccess(null);
      setConfirmError(null);
    }
  }, [selectedJob, batchMode, fetchCandidates, fetchHistory, fetchAssetPreview]);

  // ── Batch navigation — uses FULL list (not filtered) ─────────────────────
  const goToBatchPrev = useCallback(() => {
    setBatchPosition((p) => Math.max(0, p - 1));
  }, []);

  const goToBatchNext = useCallback(() => {
    setBatchPosition((p) => Math.min(batchAssets.length - 1, p + 1));
  }, [batchAssets.length]);

  // Auto-advance: find next unreviewed in FULL list after current position
  const goToNextUnreviewed = useCallback((currentPos: number, updatedAssets: BatchAsset[]) => {
    // Search forward from currentPos + 1
    const nextIdx = updatedAssets.findIndex(
      (a, i) => i > currentPos && a.review_status === 'unreviewed'
    );
    if (nextIdx >= 0) {
      setBatchPosition(nextIdx);
    } else {
      // No more unreviewed after current — try from beginning
      const firstIdx = updatedAssets.findIndex(
        (a, i) => i !== currentPos && a.review_status === 'unreviewed'
      );
      if (firstIdx >= 0) {
        setBatchPosition(firstIdx);
      } else {
        // All reviewed — stay at current position
        setBatchPosition(currentPos);
      }
    }
  }, []);

  // ── Legacy navigation ─────────────────────────────────────────────────────
  const currentJobIndex = jobs.findIndex((j) => j.id === selectedJob?.id);

  const goToPrev = useCallback(() => {
    if (batchMode) { goToBatchPrev(); return; }
    if (currentJobIndex > 0) setSelectedJob(jobs[currentJobIndex - 1]);
    else if (jobPage > 0) setJobPage((p) => p - 1);
  }, [batchMode, goToBatchPrev, currentJobIndex, jobs, jobPage]);

  const goToNext = useCallback(() => {
    if (batchMode) { goToBatchNext(); return; }
    if (currentJobIndex < jobs.length - 1) setSelectedJob(jobs[currentJobIndex + 1]);
    else if ((jobPage + 1) * PAGE_SIZE < jobTotal) setJobPage((p) => p + 1);
  }, [batchMode, goToBatchNext, currentJobIndex, jobs, jobPage, jobTotal]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); goToPrev(); break;
        case 'ArrowRight': e.preventDefault(); goToNext(); break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); } break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToPrev, goToNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Get field value from selected candidate ───────────────────────────────
  const getFieldValue = (key: ValidationField, candidate: Candidate | null): string | null => {
    if (!candidate) return null;
    switch (key) {
      case 'species': return candidate.common_name;
      case 'scientific_name': return candidate.scientific_name;
      case 'commercial_name': return candidate.commercial_name;
      case 'local_names': return null;
      case 'family': return candidate.family;
      case 'genus': return candidate.genus;
      case 'order_name': return candidate.order_name ?? candidate.biological_order ?? null;
      case 'keywords': return candidate.keywords_candidate?.slice(0, 5).join(', ') ?? null;
      case 'category': return candidate.category_candidate;
      case 'description': return candidate.description_candidate;
      case 'packaging': return candidate.packaging_candidate;
      case 'product_type': return candidate.product_candidate ?? candidate.product_form;
      default: return null;
    }
  };

  // ── CONFIRM IDENTIFICATION (calls server-side transactional API) ──────────
  const handleConfirmIdentification = async () => {
    if (actionLoading) return;
    const candidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];
    if (!candidate) return;

    const jobId = effectiveJobId ?? batchJob?.id;
    if (!jobId) return;

    // Capture current position before any state updates
    const currentPos = batchPosition;
    const currentAsset = currentBatchAsset;

    setActionLoading(true);
    setConfirmDialogOpen(false);
    setConfirmSuccess(null);
    setConfirmError(null);
    setPropagating(true);
    setPropagationDone([]);

    let meta: OpenAIPilotMetadata | null = pilotMetadata;
    if (candidate.is_real_ai && candidate.id && !meta) {
      const supabase = createClient();
      const { data } = await supabase
        .from('openai_pilot_candidate_metadata')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();
      meta = data ?? null;
    }

    const payload = {
      jobId,
      assetId: effectiveAssetId,
      publicAssetId: effectivePublicAssetId,
      candidateId: candidate.id,
      candidateSource: candidate.is_real_ai ? 'openai_pilot' : 'sie',
      resultId: candidate.result_id ?? effectiveResultId,
      batchJobId: batchMode ? batchJob?.id ?? null : null,
      fieldDecisions,
      editValues,
      comment,
      commonName: candidate.common_name,
      scientificName: candidate.scientific_name,
      family: candidate.family,
      genus: candidate.genus,
      biologicalOrder: candidate.order_name ?? candidate.biological_order ?? null,
      confidenceScore: candidate.confidence_score ?? (candidate.ai_score / 100),
      commercialNames: meta?.commercial_names ?? [],
      localNamesFr: meta?.local_names_fr ?? [],
      localNamesEn: meta?.local_names_en ?? [],
      localNamesEs: meta?.local_names_es ?? [],
      localNamesPt: meta?.local_names_pt ?? [],
      localNamesAr: meta?.local_names_ar ?? [],
      synonyms: meta?.synonyms ?? [],
    };

    try {
      const res = await fetch('/api/admin/validate-identification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success || (result.steps && result.steps.length > 0 && !result.critical_failure)) {
        const stepMap: Record<string, string> = {
          candidate_validated: 'assets',
          asset_species_written: 'asset_species',
          species_created: 'species_center',
          species_reused: 'species_center',
          asset_updated_with_aliases: 'search_index',
          species_names_written: 'knowledge_graph',
          job_validated: 'library',
          job_asset_updated: 'marketplace',
        };
        const done: string[] = [];
        for (const step of (result.steps ?? [])) {
          const target = stepMap[step];
          if (target && !done.includes(target)) done.push(target);
        }
        // All 7 propagation targets are confirmed by the server
        const allTargets = ['assets', 'asset_species', 'species_center', 'knowledge_graph', 'search_index', 'marketplace', 'library'];
        const finalDone = result.propagationTargets
          ? allTargets.filter((t) => (result.propagationTargets as string[]).includes(t))
          : done;
        setPropagationDone(finalDone.length > 0 ? finalDone : done);
        setConfirmSuccess(result.message ?? 'Identification confirmed');

        // Update batch asset status locally — mark current asset as validated
        let updatedAssets = batchAssets;
        if (batchMode && currentAsset) {
          updatedAssets = batchAssets.map((a) =>
            a.id === currentAsset.id
              ? { ...a, review_status: 'validated', reviewed_at: new Date().toISOString() }
              : a
          );
          setBatchAssets(updatedAssets);

          // Also update openai_pilot_results human_validated flag
          if (currentAsset.result_id) {
            const supabase = createClient();
            await supabase
              .from('openai_pilot_results')
              .update({ human_validated: true, review_status: 'validated' })
              .eq('id', currentAsset.result_id);

            // Also update openai_pilot_job_assets in DB
            if (!currentAsset.id.startsWith('synthetic-')) {
              await supabase
                .from('openai_pilot_job_assets')
                .update({ review_status: 'validated', reviewed_at: new Date().toISOString() })
                .eq('id', currentAsset.id);
            }
          }
        }

        setLastUndo({ jobId, prevStatus: 'proposals_ready' });
        const t = setTimeout(() => setLastUndo(null), 8000);
        setUndoTimer(t);
        setComment('');
        setFieldDecisions({});
        setEditValues({});

        if (effectiveJobId) fetchHistory(effectiveJobId);

        // Auto-advance ONLY after successful commit — never on failure
        if (autoAdvance) {
          setTimeout(() => {
            if (batchMode) {
              goToNextUnreviewed(currentPos, updatedAssets);
            } else {
              goToNext();
            }
          }, 1200);
        }
      } else {
        // Critical failure — keep asset open, show exact error, do NOT advance
        const errorMsg = result.message ?? result.error ?? result.errors?.join('; ') ?? 'Confirmation failed';
        setConfirmError(
          result.critical_failure
            ? `⚠ Critical failure — asset NOT validated. ${errorMsg}`
            : errorMsg
        );
        // Do NOT advance, do NOT mark as validated
      }
    } catch (e) {
      setConfirmError(`Network error: ${e}`);
    } finally {
      setActionLoading(false);
      setPropagating(false);
    }
  };

  // ── Skip ──────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    if (batchMode && currentBatchAsset) {
      const supabase = createClient();
      if (!currentBatchAsset.id.startsWith('synthetic-')) {
        await supabase
          .from('openai_pilot_job_assets')
          .update({ review_status: 'skipped', reviewed_at: new Date().toISOString() })
          .eq('id', currentBatchAsset.id);
      }
      let updatedAssets = batchAssets.map((a) =>
        a.id === currentBatchAsset.id ? { ...a, review_status: 'skipped' } : a
      );
      setBatchAssets(updatedAssets);
    }
    goToNext();
  };

  // ── Mark Unknown ──────────────────────────────────────────────────────────
  const handleMarkUnknown = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const supabase = createClient();
    const jobId = effectiveJobId ?? batchJob?.id;

    if (jobId) {
      await supabase.from('sie_jobs').update({
        job_status: 'unknown',
        reviewed_at: new Date().toISOString(),
        reviewer_id: profile?.id,
      }).eq('id', jobId);
      await supabase.from('sie_validation_history').insert({
        job_id: jobId,
        action: 'unknown',
        comment: comment || 'Marked as unknown by reviewer',
        previous_status: 'proposals_ready',
        new_status: 'unknown',
        reviewer_id: profile?.id,
        reviewer_name: profile?.display_name ?? profile?.email ?? null,
      });
    }

    if (batchMode && currentBatchAsset) {
      if (!currentBatchAsset.id.startsWith('synthetic-')) {
        await supabase
          .from('openai_pilot_job_assets')
          .update({ review_status: 'unknown', reviewed_at: new Date().toISOString() })
          .eq('id', currentBatchAsset.id);
      }
      let updatedAssets = batchAssets.map((a) =>
        a.id === currentBatchAsset.id ? { ...a, review_status: 'unknown' } : a
      );
      setBatchAssets(updatedAssets);
    }

    setActionLoading(false);
    goToNext();
  };

  // ── Reject candidate ──────────────────────────────────────────────────────
  const handleRejectCandidate = async (candidateId: string) => {
    const supabase = createClient();
    await supabase.from('sie_species_candidates').update({ is_selected: false }).eq('id', candidateId);
    const jobId = effectiveJobId;
    if (jobId) {
      await supabase.from('sie_validation_history').insert({
        job_id: jobId,
        candidate_id: candidateId,
        action: 'reject',
        field_name: 'candidate',
        comment: 'Candidate rejected by reviewer',
        reviewer_id: profile?.id,
        reviewer_name: profile?.display_name ?? profile?.email ?? null,
      });
    }
    fetchCandidates(effectiveAssetId, effectiveResultId, effectiveJobId);
  };

  // ── Undo ──────────────────────────────────────────────────────────────────
  const handleUndo = async () => {
    if (!lastUndo || !profile) return;
    if (undoTimer) clearTimeout(undoTimer);
    const supabase = createClient();
    await supabase.from('sie_jobs').update({ job_status: lastUndo.prevStatus }).eq('id', lastUndo.jobId);
    await supabase.from('sie_validation_history').insert({
      job_id: lastUndo.jobId,
      action: 'undo',
      comment: 'Undo last action',
      reviewer_id: profile.id,
      reviewer_name: profile.display_name ?? profile.email ?? null,
    });
    setLastUndo(null);
    fetchJobs();
    fetchValidationStats();
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const confidenceColor = (score: number) =>
    score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';

  const totalPages = Math.ceil(jobTotal / PAGE_SIZE);
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0] ?? null;
  const isMockEngine = !selectedCandidate?.is_real_ai;

  // Batch navigation state
  const isFirstBatch = batchPosition === 0;
  const isLastBatch = batchPosition >= batchTotal - 1;

  // Legacy navigation state
  const isFirstLegacy = currentJobIndex === 0 && jobPage === 0;
  const isLastLegacy = currentJobIndex === jobs.length - 1 && (jobPage + 1) * PAGE_SIZE >= jobTotal;

  const isPrevDisabled = batchMode ? isFirstBatch : isFirstLegacy;
  const isNextDisabled = batchMode ? isLastBatch : isLastLegacy;

  const hasActiveAsset = batchMode ? !!currentBatchAsset : !!selectedJob;
  const currentAssetTitle = batchMode
    ? (assetTitle ?? currentBatchAsset?.public_asset_id ?? '—')
    : (assetTitle ?? selectedJob?.current_name ?? selectedJob?.public_asset_id ?? '—');
  const currentPublicId = batchMode
    ? currentBatchAsset?.public_asset_id ?? '—' : selectedJob?.public_asset_id ?? '—';
  const currentReviewStatus = batchMode
    ? currentBatchAsset?.review_status ?? 'unreviewed' : selectedJob?.job_status ?? '—';

  // Stats derived from batchAssets (always in sync)
  const pendingCount = batchAssets.filter((a) => a.review_status === 'unreviewed').length;
  const isJobComplete = batchJob && pendingCount === 0 && batchAssets.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Target size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Human Validation Workspace</h1>
                <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">Step 4</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Preview left · AI proposals right · Per-field Approve/Edit/Reject/Unknown · CONFIRM IDENTIFICATION
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="text-sm font-bold text-foreground">
                {validationStats.validated} / {validationStats.total}
                <span className="text-xs font-normal text-muted-foreground ml-1">validated</span>
              </p>
            </div>
            <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
          </div>
        </div>

        {/* ── Job Selector ── */}
        {allBatchJobs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-violet-500" />
                <span className="text-sm font-semibold text-foreground">Import Batch:</span>
              </div>
              <div className="relative flex-1 min-w-[220px] max-w-xs">
                <select
                  value={selectedBatchJobId ?? ''}
                  onChange={(e) => {
                    const newJobId = e.target.value;
                    setSelectedBatchJobId(newJobId);
                    setBatchPosition(0);
                    setBatchFilter('all');
                    setBatchAssets([]);
                    updateUrl(newJobId, 1);
                  }}
                  className="w-full appearance-none bg-muted/40 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                >
                  {allBatchJobs.map((job) => {
                    const assetCount = job.total_assets ?? 0;
                    const label = job.pilot_job_name ?? `Batch (${assetCount} assets)`;
                    return (
                      <option key={job.id} value={job.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              {batchJob && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="bg-muted/60 border border-border px-2 py-0.5 rounded-full font-mono">
                    {validationStats.total} assets total
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium border ${pendingCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                    {pendingCount > 0 ? `${pendingCount} pending review` : '✓ All reviewed'}
                  </span>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    {validationStats.validated} validated
                  </span>
                  {validationStats.skipped > 0 && (
                    <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      {validationStats.skipped} skipped
                    </span>
                  )}
                  {isJobComplete && (
                    <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Job complete — consultable only
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Batch Job Banner ── */}
        {batchJob && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">{batchJob.pilot_job_name ?? 'OpenAI Vision Pilot'}</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  REAL AI — OPENAI VISION
                </span>
                <span className="text-xs text-emerald-700 font-mono">
                  {validationStats.total} assets · {batchJob.ai_model ?? 'gpt-5-mini-2025-08-07'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-emerald-700">
                <span>{validationStats.validated} validated</span>
                <span>{validationStats.skipped} skipped</span>
                <span>{pendingCount} remaining</span>
                <button
                  onClick={() => setBatchMode((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${batchMode ? 'bg-emerald-200 border-emerald-400 text-emerald-800' : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}>
                  <List size={11} />{batchMode ? 'Batch Mode ON' : 'Switch to Batch Mode'}
                </button>
              </div>
            </div>

            {/* Batch filter tabs */}
            {batchMode && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {(['all', 'unreviewed', 'validated', 'skipped', 'unknown'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setBatchFilter(f); }}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all capitalize ${batchFilter === f ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                    {f} {f === 'all' ? `(${batchAssets.length})` :
                         f === 'unreviewed' ? `(${pendingCount})` :
                         f === 'validated' ? `(${validationStats.validated})` :
                         f === 'skipped' ? `(${validationStats.skipped})` :
                         `(${validationStats.unknown})`}
                  </button>
                ))}
                <label className="flex items-center gap-1.5 ml-auto text-xs text-emerald-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600"
                  />
                  Auto-advance after confirmation
                </label>
              </div>
            )}
          </div>
        )}

        {/* ── Undo banner ── */}
        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">Identification confirmed.</p>
            <button onClick={handleUndo}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors">
              <RotateCcw size={14} />Undo (Ctrl+Z)
            </button>
          </div>
        )}

        {/* ── Backfill Propagation Panel ── */}
        {batchJob && (profile?.role === 'administrator' || profile?.role === 'super_admin') && (
          <div className="mb-4">
            <button
              onClick={() => setShowBackfillPanel((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors">
              <Zap size={12} />
              {showBackfillPanel ? 'Hide' : 'Show'} Backfill Propagation Panel
              <span className="text-[10px] bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>
            </button>

            {showBackfillPanel && (
              <div className="mt-2 bg-violet-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Zap size={16} className="text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-violet-900">Backfill Validated Asset Propagation</h3>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Audits all validated assets in the current batch and repairs missing propagation
                      (asset_species, species, search aliases, species_names, Library visibility).
                      Idempotent — safe to run multiple times.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => handleRunBackfill('audit')}
                    disabled={backfillLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors">
                    {backfillLoading && backfillMode === 'audit' ? (
                      <><Loader2 size={12} className="animate-spin" />Auditing...</>
                    ) : (
                      <><Eye size={12} />Audit Only (Read-only)</>
                    )}
                  </button>
                  <button
                    onClick={() => { setBackfillMode('backfill'); handleRunBackfill('backfill'); }}
                    disabled={backfillLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    {backfillLoading && backfillMode === 'backfill' ? (
                      <><Loader2 size={12} className="animate-spin" />Repairing...</>
                    ) : (
                      <><Zap size={12} />Run Backfill (Repair Missing)</>
                    )}
                  </button>
                </div>

                {backfillResult && (
                  <div className={`rounded-lg border p-3 text-xs ${backfillResult.success ? 'bg-white border-violet-200' : 'bg-red-50 border-red-200'}`}>
                    {!backfillResult.success && (
                      <p className="text-red-700 font-semibold mb-1">Error: {backfillResult.error}</p>
                    )}
                    {backfillResult.summary && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-violet-900">
                            {backfillResult.mode === 'audit' ? 'Audit Report' : 'Backfill Report'}
                          </span>
                          <span className="text-violet-600 font-mono">{backfillResult.job_name}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          <div className="bg-violet-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-violet-900">{backfillResult.summary.total_audited}</p>
                            <p className="text-[10px] text-violet-600">Audited</p>
                          </div>
                          <div className="bg-emerald-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-emerald-700">{backfillResult.summary.complete}</p>
                            <p className="text-[10px] text-emerald-600">Complete</p>
                          </div>
                          <div className="bg-amber-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-amber-700">{backfillResult.summary.partial}</p>
                            <p className="text-[10px] text-amber-600">Partial</p>
                          </div>
                          <div className="bg-red-50 rounded p-2 text-center">
                            <p className="text-lg font-bold text-red-700">{backfillResult.summary.none}</p>
                            <p className="text-[10px] text-red-600">No Propagation</p>
                          </div>
                        </div>
                        {backfillResult.mode === 'backfill' && backfillResult.summary.repaired !== undefined && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px] text-violet-700 mt-1">
                            <span>✓ {backfillResult.summary.repaired} repaired</span>
                            <span>✓ {backfillResult.summary.species_reused ?? 0} species reused</span>
                            <span>✓ {backfillResult.summary.species_created ?? 0} species created</span>
                            <span>✓ {backfillResult.summary.asset_species_written ?? 0} asset_species written</span>
                            <span>✓ {backfillResult.summary.aliases_created ?? 0} aliases created</span>
                            <span>✓ {backfillResult.summary.indexes_rebuilt ?? 0} indexes rebuilt</span>
                          </div>
                        )}
                        {backfillResult.summary.repair_errors && backfillResult.summary.repair_errors.length > 0 && (
                          <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                            <p className="font-semibold text-red-700 mb-1">Repair errors ({backfillResult.summary.repair_errors.length}):</p>
                            {backfillResult.summary.repair_errors.slice(0, 5).map((e, i) => (
                              <p key={i} className="text-red-600 font-mono text-[10px]">
                                {e.public_asset_id}: {e.errors.join(', ')}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Confirm Success Banner ── */}
        {confirmSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">{confirmSuccess}</p>
          </div>
        )}

        {/* ── Confirm Error Banner ── */}
        {confirmError && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-800">{confirmError}</p>
          </div>
        )}

        {/* ── CONFIRM IDENTIFICATION Dialog ── */}
        {confirmDialogOpen && hasActiveAsset && selectedCandidate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Confirm Identification</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will write a real transactional commit to asset_species, species table, search aliases, and species_names.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Selected species:</p>
                <p className="text-base font-bold text-foreground">{selectedCandidate.common_name}</p>
                {selectedCandidate.scientific_name && (
                  <p className="text-sm text-muted-foreground italic">{selectedCandidate.scientific_name}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedCandidate.family && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{selectedCandidate.family}</span>
                  )}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">
                    {selectedCandidate.ai_score}% confidence
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${selectedCandidate.is_real_ai ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedCandidate.is_real_ai ? 'REAL AI — OPENAI VISION' : 'Mock Engine'}
                  </span>
                </div>
              </div>

              {Object.keys(fieldDecisions).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Field decisions:</p>
                  <div className="space-y-1">
                    {Object.entries(fieldDecisions).map(([field, decision]) => (
                      <div key={field} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          decision.action === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                          decision.action === 'reject' ? 'bg-red-100 text-red-700' :
                          decision.action === 'edit' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {decision.action === 'edit' && editValues[field] ? `Edit: "${editValues[field]}"` : decision.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground mb-4">
                Writes: <strong>asset_species</strong> · <strong>species</strong> (dedup by scientific_name) ·
                <strong> species_names</strong> · <strong>search_aliases</strong> · <strong>validated_metadata</strong> ·
                job status → <strong>validated</strong>.
                Asset will be immediately findable in Library by common name, scientific name, and aliases.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmIdentification}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {actionLoading ? (
                    <><Loader2 size={14} className="animate-spin" />Confirming...</>
                  ) : (
                    <><CheckCircle2 size={14} />CONFIRM IDENTIFICATION</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Left panel: batch asset list OR legacy job list ── */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                {batchMode && batchJob ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">
                        Batch ({validationStats.total})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {batchDisplayPos}/{batchTotal}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{batchJob.pilot_job_name}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">Jobs ({jobTotal})</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setJobPage((p) => Math.max(0, p - 1))} disabled={jobPage === 0}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs text-muted-foreground">{jobPage + 1}/{totalPages || 1}</span>
                        <button onClick={() => setJobPage((p) => p + 1)} disabled={(jobPage + 1) * PAGE_SIZE >= jobTotal}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <select value={jobStatusFilter} onChange={(e) => { setJobStatusFilter(e.target.value); setJobPage(0); }}
                      className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="">All statuses</option>
                      <option value="proposals_ready">Proposals Ready</option>
                      <option value="under_review">Under Review</option>
                      <option value="validated">Validated</option>
                      <option value="partially_validated">Partially Validated</option>
                      <option value="rejected">Rejected</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </>
                )}
              </div>

              {fetching && !batchMode ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : batchMode && batchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : batchMode ? (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {filteredBatchAssets.map((ba) => {
                    // Find the index in the FULL list for correct navigation
                    const fullIdx = batchAssets.findIndex((a) => a.id === ba.id);
                    const isActive = fullIdx === batchPosition;
                    return (
                      <div key={ba.id}
                        className={`flex items-start gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer ${isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                        onClick={() => setBatchPosition(fullIdx)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {ba.public_asset_id}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${REVIEW_STATUS_COLORS[ba.review_status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {ba.review_status}
                            </span>
                            <span className="text-[10px] text-muted-foreground">#{ba.review_position}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-8 text-center px-4">
                  <p className="text-sm text-muted-foreground">No jobs found</p>
                  <Link href="/admin/ai-studio/identify" className="text-xs text-blue-600 underline mt-1 block">
                    Launch identification
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {jobs.map((job) => (
                    <div key={job.id}
                      className={`flex items-start gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer ${selectedJob?.id === job.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                      onClick={() => setSelectedJob(job)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {job.current_name ?? job.public_asset_id ?? job.id.slice(0, 8)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${JOB_STATUS_COLORS[job.job_status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {job.job_status}
                          </span>
                          {job.global_confidence && (
                            <span className={`text-[10px] font-mono font-semibold ${confidenceColor(job.global_confidence)}`}>
                              {job.global_confidence}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Main validation panel ── */}
          <div className="lg:col-span-3">
            {/* Batch load error — shown instead of infinite spinner */}
            {batchLoadError && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800 mb-1">Failed to load batch assets</p>
                    <p className="text-xs text-red-700 font-mono break-all">{batchLoadError}</p>
                  </div>
                  <button
                    onClick={() => {
                      setBatchLoadError(null);
                      if (selectedBatchJobId) loadBatchJobAssets(selectedBatchJobId);
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!hasActiveAsset ? (
              <div className="bg-card border border-border rounded-xl flex items-center justify-center py-24 text-center">
                <div>
                  {batchLoading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Loading batch assets...</p>
                    </>
                  ) : (
                    <>
                      <Target size={32} className="text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {batchMode
                          ? (batchFilter !== 'all' && filteredBatchAssets.length === 0 && batchAssets.length > 0
                              ? `No assets with status "${batchFilter}"`
                              : batchAssets.length === 0
                              ? 'No assets found in this batch' :'All assets in this batch have been reviewed!')
                          : 'Select a job to start validation'}
                      </p>
                      {batchMode && batchAssets.length > 0 && pendingCount === 0 && (
                        <button
                          onClick={() => setBatchFilter('all')}
                          className="text-xs text-blue-600 underline mt-2 block mx-auto">
                          View all assets (including validated)
                        </button>
                      )}
                      {!batchMode && (
                        <Link href="/admin/ai-studio/identify" className="text-xs text-blue-600 underline mt-2 block">
                          Launch AI identification first
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* Navigation bar */}
                <div className="flex items-center justify-between mb-4 bg-card border border-border rounded-xl px-4 py-2.5">
                  <button onClick={goToPrev} disabled={isPrevDisabled}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />Previous
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">
                      {batchMode
                        ? `${batchDisplayPos} / ${batchTotal}`
                        : `${currentJobIndex + 1 + jobPage * PAGE_SIZE} / ${jobTotal}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">← → keys to navigate</p>
                  </div>
                  <button onClick={goToNext} disabled={isNextDisabled}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    Next<ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                  {/* ── LEFT: Asset preview + info + field decisions ── */}
                  <div className="space-y-4">

                    {/* Asset preview card */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{currentAssetTitle}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{currentPublicId}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REVIEW_STATUS_COLORS[currentReviewStatus] ?? JOB_STATUS_COLORS[currentReviewStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                              {currentReviewStatus}
                            </span>
                            {assetStatus && (
                              <span className="text-[10px] text-muted-foreground">Asset: {assetStatus}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <AssetPreview preview={assetPreview} />

                      {/* Provider mode indicator */}
                      <div className="px-4 py-3">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isMockEngine ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                          provider_mode = {isMockEngine ? 'mock' : 'real_ai'}
                        </span>
                      </div>
                    </div>

                    {/* Per-field decisions */}
                    {selectedCandidate && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                          <Target size={12} />Per-Field Decisions
                          <span className="text-[10px] text-muted-foreground ml-auto">Approve · Edit · Reject · Unknown</span>
                        </h4>
                        <div className="space-y-2">
                          {VALIDATION_FIELDS.map(({ key, label, icon: FieldIcon }) => {
                            const fieldValue = getFieldValue(key, selectedCandidate);
                            if (!fieldValue) return null;
                            const decision = fieldDecisions[key];
                            const FieldIconComponent = FieldIcon as React.ElementType;

                            return (
                              <div key={key} className="border border-border rounded-lg p-2.5">
                                <div className="flex items-start justify-between mb-1.5 gap-2">
                                  <span className="text-xs font-medium text-foreground flex items-center gap-1 shrink-0">
                                    <FieldIconComponent size={10} className="text-muted-foreground" />{label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground text-right truncate max-w-[140px]">
                                    {decision?.action === 'edit' && editValues[key] ? editValues[key] : fieldValue}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  {(['approve', 'edit', 'reject', 'unknown'] as const).map((a) => {
                                    const cfg = ACTION_CONFIG[a];
                                    const AIcon = cfg.icon;
                                    const isActive = decision?.action === a;
                                    return (
                                      <button key={a}
                                        onClick={() => setFieldDecisions((prev) => ({ ...prev, [key]: { action: a } }))}
                                        title={cfg.label}
                                        className={`flex-1 flex items-center justify-center py-1 rounded border text-[10px] font-medium transition-all ${isActive ? cfg.active : cfg.bg} ${cfg.color}`}>
                                        <AIcon size={9} />
                                      </button>
                                    );
                                  })}
                                </div>
                                {decision?.action === 'edit' && (
                                  <input type="text"
                                    placeholder={`Edit ${label}...`}
                                    value={editValues[key] ?? ''}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                                    className="mt-1.5 w-full text-xs bg-muted/40 border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Comment */}
                    <div className="bg-card border border-border rounded-xl p-4">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                        <MessageSquare size={12} />Reviewer Comment
                      </label>
                      <textarea ref={commentRef}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        placeholder="Add a comment..."
                        className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={actionLoading || !selectedCandidate || currentReviewStatus === 'validated'}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold px-6 py-3.5 rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm text-sm">
                        {actionLoading ? (
                          <><Loader2 size={16} className="animate-spin" />Confirming...</>
                        ) : currentReviewStatus === 'validated' ? (
                          <><CheckCircle2 size={16} />Already Validated</>
                        ) : (
                          <><CheckCircle2 size={16} />CONFIRM IDENTIFICATION</>
                        )}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleSkip}
                          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-muted/40 border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                          <ChevronRight size={13} />Skip
                        </button>
                        <button onClick={handleMarkUnknown}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-gray-50 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50">
                          <HelpCircle size={13} />Mark Unknown
                        </button>
                      </div>
                    </div>

                    {/* Propagation status */}
                    {(propagating || propagationDone.length > 0) && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                          <Zap size={12} className="text-violet-500" />Propagation
                          {propagating && <span className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin ml-1" />}
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PROPAGATION_TARGETS.map(({ key, label, icon: PIcon }) => {
                            const done = propagationDone.includes(key);
                            const PIconComponent = PIcon as React.ElementType;
                            return (
                              <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border transition-all ${done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted/30 border-border text-muted-foreground'}`}>
                                <PIconComponent size={10} />
                                <span>{label}</span>
                                {done && <CheckCircle2 size={10} className="ml-auto text-emerald-500" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* History */}
                    {history.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
                          <Clock size={12} />Validation History
                        </h4>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {history.map((h) => (
                            <div key={h.id} className="flex items-start gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                h.action === 'human_validated' || h.action === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                                h.action === 'reject' ? 'bg-red-100 text-red-700' :
                                h.action === 'undo' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {h.action}
                              </span>
                              {h.field_name && <span className="text-violet-600 font-medium">{h.field_name}</span>}
                              <span className="text-muted-foreground">{h.reviewer_name ?? 'Reviewer'}</span>
                              {h.comment && <span className="text-foreground italic truncate">{h.comment}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── RIGHT: Top AI Proposals ── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-foreground">Top AI Proposals</h3>
                      {candidates.some((c) => c.is_real_ai) ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full ml-auto font-semibold">
                          REAL AI — OPENAI VISION
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full ml-auto font-medium">
                          Mock Engine v2
                        </span>
                      )}
                    </div>

                    {selectedCandidate && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        selectedCandidate.ai_score < 40
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : selectedCandidate.ai_score < 70
                          ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        <AlertTriangle size={12} className="shrink-0" />
                        {selectedCandidate.ai_score < 40
                          ? 'Low confidence — identification uncertain'
                          : selectedCandidate.ai_score < 70
                          ? 'Medium confidence — review carefully' : 'Higher confidence — human review still required'}
                      </div>
                    )}

                    {candidates.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-6 text-center">
                        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-foreground mb-2">No proposals found</p>
                        <div className="text-left bg-muted/40 border border-border rounded-lg p-3 text-xs space-y-1.5">
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">asset_id:</span> {effectiveAssetId ?? '— (null)'}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">result_id:</span> {effectiveResultId ?? '— (null)'}
                          </p>
                          <p className="text-muted-foreground">
                            Import the OpenAI pilot CSV files to generate proposals.
                          </p>
                        </div>
                        <Link href="/admin/ai-studio/import-real-ai"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 underline mt-3">
                          Import Real AI Results →
                        </Link>
                      </div>
                    ) : (
                      candidates.map((c) => {
                        const isSelected = c.id === selectedCandidateId;
                        return (
                          <div key={c.id}
                            className={`bg-card border rounded-xl p-4 transition-all cursor-pointer ${
                              c.is_validated ? 'border-emerald-400 bg-emerald-50/30' : isSelected ? 'border-violet-400 bg-violet-50/20 ring-1 ring-violet-300' :
                              c.rank === 1 ? 'border-violet-200' : 'border-border'
                            }`}
                            onClick={() => setSelectedCandidateId(c.id)}>

                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isSelected ? 'bg-violet-600 text-white' :
                                  c.rank === 1 ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {c.rank}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{c.common_name}</p>
                                  {c.scientific_name && (
                                    <p className="text-xs text-muted-foreground italic">{c.scientific_name}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold font-mono ${confidenceColor(c.ai_score)}`}>{c.ai_score}%</p>
                                <p className="text-[10px] text-muted-foreground">confidence</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {c.is_real_ai ? (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">
                                  ✓ REAL AI — OPENAI VISION
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-mono">
                                  ⚠ Mock Engine
                                </span>
                              )}
                              {c.family && (
                                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Fish size={9} />Family: {c.family}
                                </span>
                              )}
                              {c.genus && (
                                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                                  Genus: {c.genus}
                                </span>
                              )}
                              {(c.order_name || c.biological_order) && (
                                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  Order: {c.order_name ?? c.biological_order}
                                </span>
                              )}
                            </div>

                            {c.is_real_ai && c.visual_evidence && c.visual_evidence.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Visual evidence:</p>
                                <ul className="space-y-0.5">
                                  {c.visual_evidence.slice(0, 3).map((ev, i) => (
                                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                      <Eye size={9} className="text-emerald-500 shrink-0 mt-0.5" />{ev}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {c.is_real_ai && c.identification_limits && c.identification_limits.length > 0 && (
                              <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-700 font-medium mb-1">Identification limits:</p>
                                <ul className="space-y-0.5">
                                  {c.identification_limits.slice(0, 2).map((lim, i) => (
                                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                      <AlertTriangle size={9} className="shrink-0 mt-0.5" />{lim}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {c.main_reasons && c.main_reasons.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Why this proposal:</p>
                                <ul className="space-y-0.5">
                                  {c.main_reasons.slice(0, 3).map((r, i) => (
                                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                      <Star size={9} className="text-violet-400 shrink-0 mt-0.5" />{r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs text-muted-foreground shrink-0">Similarity:</span>
                              <div className="flex-1 bg-muted rounded-full h-1.5">
                                <div className="bg-gradient-to-r from-violet-400 to-blue-400 h-1.5 rounded-full"
                                  style={{ width: `${c.similarity_score}%` }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground shrink-0">{c.similarity_score}%</span>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCandidateId(c.id);
                                  if (c.is_real_ai) { fetchPilotMetadata(c.id); setShowPilotMetadata(true); }
                                }}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                  isSelected
                                    ? 'bg-violet-100 border-violet-400 text-violet-700 ring-1 ring-violet-300'
                                    : 'bg-muted/40 border-border text-muted-foreground hover:border-violet-300 hover:bg-violet-50'
                                }`}>
                                <Eye size={11} />
                                {isSelected ? 'Selected' : 'Select this species'}
                              </button>
                              {c.is_real_ai && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchPilotMetadata(c.id); setShowPilotMetadata(true); }}
                                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-all">
                                  <Tag size={11} />Metadata
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRejectCandidate(c.id); }}
                                className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-all">
                                <XCircle size={11} />Reject
                              </button>
                            </div>

                            {c.is_validated && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                <CheckCircle2 size={12} />Validated — propagated to all targets
                              </div>
                            )}
                            {isSelected && !c.is_validated && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 font-medium">
                                <Target size={12} />Selected for confirmation
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Propagation info */}
                    <div className="bg-muted/30 border border-border rounded-xl p-3">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <ArrowRight size={11} className="text-violet-500" />After CONFIRM — writes to:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {['asset_species', 'species (dedup)', 'species_names', 'search_aliases', 'validated_metadata', 'Library'].map((t) => (
                          <span key={t} className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Only approved fields are propagated. Asset immediately findable in Library by common name, scientific name, and aliases.
                      </p>
                    </div>

                    {/* OpenAI Pilot Candidate Metadata Panel */}
                    {showPilotMetadata && pilotMetadata && (
                      <div className="bg-card border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Tag size={14} className="text-emerald-500" />
                            CANDIDATE METADATA
                            <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                              REAL AI — OPENAI VISION
                            </span>
                          </h4>
                          <button onClick={() => setShowPilotMetadata(false)} className="text-muted-foreground hover:text-foreground">
                            <XCircle size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 text-xs">
                          {[
                            { label: 'Species', value: pilotMetadata.species_name },
                            { label: 'Scientific Name', value: pilotMetadata.scientific_name },
                            { label: 'Family', value: pilotMetadata.family },
                            { label: 'Genus', value: pilotMetadata.genus },
                            { label: 'Biological Order', value: pilotMetadata.biological_order },
                            { label: 'Commercial Names', value: pilotMetadata.commercial_names?.join(', ') },
                            { label: 'Local Names — French', value: pilotMetadata.local_names_fr?.join(', ') },
                            { label: 'Local Names — English', value: pilotMetadata.local_names_en?.join(', ') },
                            { label: 'Local Names — Spanish', value: pilotMetadata.local_names_es?.join(', ') },
                            { label: 'Local Names — Portuguese', value: pilotMetadata.local_names_pt?.join(', ') },
                            { label: 'Local Names — Arabic', value: pilotMetadata.local_names_ar?.join(', ') },
                            { label: 'Synonyms', value: pilotMetadata.synonyms?.join(', ') },
                            { label: 'Category', value: pilotMetadata.category },
                            { label: 'Product Form', value: pilotMetadata.product_form },
                            { label: 'Conservation Method', value: pilotMetadata.conservation_method },
                            { label: 'Packaging', value: pilotMetadata.packaging },
                            { label: 'Keywords', value: pilotMetadata.keywords?.join(', ') },
                            { label: 'Description', value: pilotMetadata.short_description },
                          ].filter((f) => f.value).map((field) => (
                            <div key={field.label} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                              <span className="font-medium text-foreground shrink-0 w-36">{field.label}</span>
                              <span className="text-muted-foreground flex-1">{field.value}</span>
                            </div>
                          ))}

                          <div className="pt-2 border-t border-border">
                            <p className="font-semibold text-foreground mb-2">Confidence Scores</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { label: 'Vision', value: pilotMetadata.vision_confidence },
                                { label: 'Species', value: pilotMetadata.species_confidence },
                                { label: 'Commercial', value: pilotMetadata.commercial_confidence },
                                { label: 'Metadata', value: pilotMetadata.metadata_confidence },
                                { label: 'Global', value: pilotMetadata.global_confidence },
                              ].filter((s) => s.value != null).map((score) => (
                                <div key={score.label} className="flex items-center justify-between p-1.5 rounded bg-muted/40">
                                  <span className="text-muted-foreground">{score.label}</span>
                                  <span className={`font-mono font-bold ${confidenceColor(Math.round((score.value ?? 0) * 100))}`}>
                                    {Math.round((score.value ?? 0) * 100)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {pilotMetadata.warnings && pilotMetadata.warnings.length > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="font-semibold text-amber-800 mb-1">Warnings</p>
                              {pilotMetadata.warnings.map((w, i) => (
                                <p key={i} className="text-amber-700 flex items-start gap-1.5">
                                  <AlertTriangle size={10} className="shrink-0 mt-0.5" />{w}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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

export default function AIStudioValidationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    }>
      <AIStudioValidationPageInner />
    </Suspense>
  );
}
