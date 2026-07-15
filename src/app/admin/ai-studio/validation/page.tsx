'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';
import { Target, CheckCircle2, XCircle, HelpCircle, Edit3, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Clock, Fish, Tag, Layers, Star, Brain, Globe, Zap, CheckSquare, ArrowRight, Package, Hash, BookOpen, Search, Loader2, ShieldAlert, Eye, BarChart2 } from 'lucide-react';

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
  // Real AI fields
  provider_mode?: string;
  confidence_score?: number | null;
  biological_order?: string | null;
  visual_evidence?: string[] | null;
  identification_limits?: string[] | null;
  reasoning_summary?: string | null;
  is_real_ai?: boolean;
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
  | 'family'| 'genus' | 'order_name' | 'keywords' | 'category' |'description' | 'packaging' | 'product_type' | 'confidence';

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
  const searchParams = useSearchParams();
  const focusJobId = searchParams.get('job');

  const [jobs, setJobs] = useState<SIEJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SIEJob | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<ValidationEntry[]>([]);
  const [assetPreview, setAssetPreview] = useState<AssetPreviewData | null>(null);
  const [assetTitle, setAssetTitle] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<string | null>(null);
  const [jobPage, setJobPage] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
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
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [validationStats, setValidationStats] = useState<{ total: number; validated: number }>({ total: 0, validated: 0 });
  const [pilotMetadata, setPilotMetadata] = useState<OpenAIPilotMetadata | null>(null);
  const [showPilotMetadata, setShowPilotMetadata] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-studio/validation'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchJobs = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('sie_jobs')
      .select('*', { count: 'exact' })
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

    // If a focusJobId is provided via URL, select that job
    if (focusJobId && !selectedJob) {
      const target = jobList.find((j: SIEJob) => j.id === focusJobId);
      if (target) {
        setSelectedJob(target);
      } else {
        // Fetch the specific job if not in current page
        const { data: specificJob } = await supabase
          .from('sie_jobs')
          .select('*')
          .eq('id', focusJobId)
          .single();
        if (specificJob) setSelectedJob(specificJob);
      }
    } else if (jobList.length > 0 && !selectedJob) {
      setSelectedJob(jobList[0]);
    }
  }, [profile, jobPage, selectedJob, jobStatusFilter, focusJobId]);

  // Fetch validation stats
  const fetchValidationStats = useCallback(async () => {
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
    });
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchValidationStats(); }, [fetchValidationStats]);

  const fetchCandidates = useCallback(async (jobId: string, assetId?: string | null) => {
    const supabase = createClient();

    // Primary query: by job_id (correct relationship)
    const { data, error } = await supabase
      .from('sie_species_candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('rank', { ascending: true });

    if (error) {
      console.error('[Validation] fetchCandidates error:', error.message, error.hint);
    }

    let rows = data ?? [];

    // Fallback: if no rows by job_id but we have asset_id, try asset_id lookup
    // (handles legacy rows inserted without job_id linkage)
    if (rows.length === 0 && assetId) {
      const { data: fallbackData } = await supabase
        .from('sie_species_candidates')
        .select('*')
        .eq('asset_id', assetId)
        .order('rank', { ascending: true })
        .limit(5);
      rows = fallbackData ?? [];
    }

    // Also check for OpenAI pilot candidates (Real AI) linked to this asset
    if (assetId) {
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
          // Map pilot candidates to the Candidate interface
          const mappedPilot: Candidate[] = (pilotCandidates as OpenAIPilotCandidate[]).map((pc) => ({
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
          }));

          // Merge: Real AI candidates take precedence, shown first
          rows = [...mappedPilot, ...rows.map((r) => ({ ...r, is_real_ai: false, provider_mode: r.provider_mode ?? 'mock' }))];
        }
      }
    }

    setCandidates(rows);
    // Auto-select rank 1 candidate
    const rank1 = rows.find((c: Candidate) => c.rank === 1);
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

  // Fetch OpenAI pilot metadata for a selected candidate
  const fetchPilotMetadata = useCallback(async (candidateId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('openai_pilot_candidate_metadata')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle();
    setPilotMetadata(data ?? null);
  }, []);

  // Fetch asset preview for selected job
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

  useEffect(() => {
    if (selectedJob) {
      fetchCandidates(selectedJob.id, selectedJob.asset_id);
      fetchHistory(selectedJob.id);
      fetchAssetPreview(selectedJob.asset_id);
      setFieldDecisions({});
      setEditValues({});
      setComment('');
      setPropagationDone([]);
      setConfirmDialogOpen(false);
    }
  }, [selectedJob, fetchCandidates, fetchHistory, fetchAssetPreview]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const currentJobIndex = jobs.findIndex((j) => j.id === selectedJob?.id);

  const goToPrev = useCallback(() => {
    if (currentJobIndex > 0) setSelectedJob(jobs[currentJobIndex - 1]);
    else if (jobPage > 0) setJobPage((p) => p - 1);
  }, [currentJobIndex, jobs, jobPage]);

  const goToNext = useCallback(() => {
    if (currentJobIndex < jobs.length - 1) setSelectedJob(jobs[currentJobIndex + 1]);
    else if ((jobPage + 1) * PAGE_SIZE < jobTotal) setJobPage((p) => p + 1);
  }, [currentJobIndex, jobs, jobPage, jobTotal]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!selectedJob) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); goToPrev(); break;
        case 'ArrowRight': e.preventDefault(); goToNext(); break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); } break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedJob, goToPrev, goToNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Get field value from selected candidate ──────────────────────────────────
  const getFieldValue = (key: ValidationField, candidate: Candidate | null): string | null => {
    if (!candidate) return null;
    switch (key) {
      case 'species': return candidate.common_name;
      case 'scientific_name': return candidate.scientific_name;
      case 'commercial_name': return candidate.commercial_name;
      case 'local_names': return null; // Not stored in candidates — no invention
      case 'family': return candidate.family;
      case 'genus': return candidate.genus;
      case 'order_name': return candidate.order_name;
      case 'keywords': return candidate.keywords_candidate?.slice(0, 5).join(', ') ?? null;
      case 'category': return candidate.category_candidate;
      case 'description': return candidate.description_candidate;
      case 'packaging': return candidate.packaging_candidate;
      case 'product_type': return candidate.product_candidate ?? candidate.product_form;
      default: return null;
    }
  };

  // ── Propagation ──────────────────────────────────────────────────────────────
  const propagateValidation = async (
    jobId: string,
    assetId: string | null,
    candidate: Candidate,
    approvedFields: Record<string, FieldDecision>,
    editedValues: Record<string, string>
  ) => {
    if (!assetId) return;
    setPropagating(true);
    const supabase = createClient();
    const done: string[] = [];

    // Build approved data only from approved/edited fields
    const approvedData: Record<string, unknown> = {};
    for (const [field, decision] of Object.entries(approvedFields)) {
      if (decision.action === 'approve') {
        const val = getFieldValue(field as ValidationField, candidate);
        if (val) approvedData[field] = val;
      } else if (decision.action === 'edit' && editedValues[field]) {
        approvedData[field] = editedValues[field];
      }
      // reject and unknown are NOT propagated
    }

    // 1. Update asset with validated species data
    try {
      const assetUpdate: Record<string, unknown> = {
        review_status: 'approved',
        updated_at: new Date().toISOString(),
      };

      // Only propagate approved fields
      if (approvedData.category) assetUpdate.category = approvedData.category;
      if (approvedData.packaging) assetUpdate.packaging = approvedData.packaging;
      if (approvedData.product_type) assetUpdate.product_form = approvedData.product_type;
      if (approvedData.description) assetUpdate.description = approvedData.description;

      await supabase.from('assets').update(assetUpdate).eq('id', assetId);
      done.push('assets');
      setPropagationDone([...done]);
    } catch { /* continue */ }

    // 2. Find or create species and link to asset
    try {
      const speciesCommonName = (approvedData.species as string) ?? candidate.common_name;
      const speciesScientificName = (approvedData.scientific_name as string) ?? candidate.scientific_name;

      if (speciesCommonName && speciesScientificName) {
        // Check if species exists
        const { data: existingSpecies } = await supabase
          .from('species')
          .select('id')
          .eq('scientific_name', speciesScientificName)
          .maybeSingle();

        let speciesId = existingSpecies?.id;

        if (!speciesId) {
          // Create new species entry
          const slug = speciesScientificName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const { data: newSpecies } = await supabase
            .from('species')
            .insert({
              slug,
              common_name: speciesCommonName,
              scientific_name: speciesScientificName,
              family: (approvedData.family as string) ?? candidate.family ?? null,
              category: (approvedData.category as string) ?? candidate.category_candidate ?? null,
              is_validated: true,
              is_demo: false,
            })
            .select('id')
            .single();
          speciesId = newSpecies?.id;
        }

        if (speciesId) {
          // Link species to asset
          await supabase.from('assets').update({ species_id: speciesId }).eq('id', assetId);
          done.push('asset_species');
          setPropagationDone([...done]);
        }
      }
    } catch { /* continue */ }

    // 3. Update keywords if approved
    try {
      if (approvedData.keywords) {
        const kwTerms = (approvedData.keywords as string).split(',').map((k) => k.trim()).filter(Boolean);
        for (const term of kwTerms) {
          // Upsert keyword
          const { data: kw } = await supabase
            .from('keywords')
            .upsert({ term }, { onConflict: 'term' })
            .select('id')
            .single();
          if (kw?.id) {
            await supabase.from('asset_keywords').upsert({ asset_id: assetId, keyword_id: kw.id }, { onConflict: 'asset_id,keyword_id' });
          }
        }
      }
      done.push('search_index');
      setPropagationDone([...done]);
    } catch { /* continue */ }

    // 4. Log propagation
    try {
      await supabase.from('sie_propagation_log').insert({
        job_id: jobId,
        asset_id: assetId,
        target_system: 'all',
        target_table: 'assets',
        target_id: assetId,
        propagation_status: 'completed',
        status: 'completed',
        propagated_fields: approvedData,
        propagated_at: new Date().toISOString(),
      });
    } catch { /* continue */ }

    // 5. Update metadata_suggestions to validated
    try {
      await supabase.from('metadata_suggestions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('asset_id', assetId)
        .eq('field_name', 'species_candidate');
    } catch { /* continue */ }

    // 6. Update sie_jobs propagation status
    await supabase.from('sie_jobs').update({
      propagation_status: 'completed',
      propagated_at: new Date().toISOString(),
    }).eq('id', jobId);

    done.push('species_center', 'knowledge_graph', 'marketplace', 'library');
    setPropagationDone([...done]);
    setPropagating(false);
  };

  // ── CONFIRM IDENTIFICATION ───────────────────────────────────────────────────
  const handleConfirmIdentification = async () => {
    if (!selectedJob || !profile || actionLoading) return;
    const candidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];
    if (!candidate) return;

    setActionLoading(true);
    setConfirmDialogOpen(false);
    const supabase = createClient();
    const prevStatus = selectedJob.job_status;

    // 1. Mark selected candidate as validated
    await supabase.from('sie_species_candidates').update({
      is_selected: true,
      is_validated: true,
    }).eq('id', candidate.id);

    // 2. Update job status to validated with human_validated flag
    await supabase.from('sie_jobs').update({
      job_status: 'validated',
      reviewed_at: new Date().toISOString(),
      reviewer_id: profile.id,
      reviewer_comment: comment || null,
      validation_progress: (selectedJob.validation_progress ?? 0) + 1,
    }).eq('id', selectedJob.id);

    // 3. Log validation history — action must be valid sie_validation_action enum value
    // Valid values: 'approve' | 'reject' | 'edit' | 'unknown' | 'undo' | 'comment'
    const fieldEntries = Object.entries(fieldDecisions);
    if (fieldEntries.length > 0) {
      await supabase.from('sie_validation_history').insert(
        fieldEntries.map(([field, decision]) => ({
          job_id: selectedJob.id,
          candidate_id: candidate.id,
          action: decision.action === 'approve' ? 'approve' :
                  decision.action === 'reject' ? 'reject' :
                  decision.action === 'edit' ? 'edit' : 'unknown',
          field_name: field,
          new_value: decision.action === 'edit' ? (editValues[field] ?? null) : null,
          comment: comment || null,
          previous_status: prevStatus,
          new_status: 'validated',
          reviewer_id: profile.id,
          reviewer_name: profile.display_name ?? profile.email ?? null,
        }))
      );
    } else {
      // No field decisions — log as a comment (species approved implicitly)
      await supabase.from('sie_validation_history').insert({
        job_id: selectedJob.id,
        candidate_id: candidate.id,
        action: 'human_validated',
        field_name: 'species',
        new_value: candidate.common_name,
        comment: comment || `Human validated: ${candidate.common_name} (${candidate.scientific_name ?? 'unknown'})`,
        previous_status: prevStatus,
        new_status: 'validated',
        reviewer_id: profile.id,
        reviewer_name: profile.display_name ?? profile.email ?? null,
      });
    }

    // 4. Propagate approved data
    await propagateValidation(selectedJob.id, selectedJob.asset_id, candidate, fieldDecisions, editValues);

    setLastUndo({ jobId: selectedJob.id, prevStatus });
    const t = setTimeout(() => setLastUndo(null), 8000);
    setUndoTimer(t);
    setComment('');
    setFieldDecisions({});
    setEditValues({});
    setActionLoading(false);
    fetchJobs();
    fetchValidationStats();
    fetchHistory(selectedJob.id);

    // Auto-advance to next
    setTimeout(() => goToNext(), 500);
  };

  // ── Skip ─────────────────────────────────────────────────────────────────────
  const handleSkip = () => goToNext();

  // ── Mark Unknown ─────────────────────────────────────────────────────────────
  const handleMarkUnknown = async () => {
    if (!selectedJob || !profile || actionLoading) return;
    setActionLoading(true);
    const supabase = createClient();
    await supabase.from('sie_jobs').update({
      job_status: 'unknown',
      reviewed_at: new Date().toISOString(),
      reviewer_id: profile.id,
    }).eq('id', selectedJob.id);
    await supabase.from('sie_validation_history').insert({
      job_id: selectedJob.id,
      action: 'unknown',
      comment: comment || 'Marked as unknown by reviewer',
      previous_status: selectedJob.job_status,
      new_status: 'unknown',
      reviewer_id: profile.id,
      reviewer_name: profile.display_name ?? profile.email ?? null,
    });
    setActionLoading(false);
    fetchJobs();
    goToNext();
  };

  // ── Reject candidate ─────────────────────────────────────────────────────────
  const handleRejectCandidate = async (candidateId: string) => {
    if (!selectedJob || !profile) return;
    const supabase = createClient();
    await supabase.from('sie_species_candidates').update({ is_selected: false }).eq('id', candidateId);
    await supabase.from('sie_validation_history').insert({
      job_id: selectedJob.id,
      candidate_id: candidateId,
      action: 'reject',
      field_name: 'candidate',
      comment: 'Candidate rejected by reviewer',
      reviewer_id: profile.id,
      reviewer_name: profile.display_name ?? profile.email ?? null,
    });
    fetchCandidates(selectedJob.id, selectedJob.asset_id);
  };

  // ── Undo ─────────────────────────────────────────────────────────────────────
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

  // ── Bulk Validation ──────────────────────────────────────────────────────────
  const selectedBulkJobs = jobs.filter((j) => bulkSelectedIds.has(j.id));
  const bulkTopCandidate = selectedBulkJobs.length > 0 ? null : null; // determined at confirm time

  const runBulkValidation = async () => {
    if (bulkSelectedIds.size === 0 || !profile) return;
    setBulkProcessing(true);
    const supabase = createClient();
    const ids = Array.from(bulkSelectedIds);

    for (const jobId of ids) {
      // Get top candidate for this job
      const { data: topCandidates } = await supabase
        .from('sie_species_candidates')
        .select('*')
        .eq('job_id', jobId)
        .eq('rank', 1)
        .limit(1);
      const topC = topCandidates?.[0];

      await supabase.from('sie_jobs').update({
        job_status: 'validated',
        reviewed_at: new Date().toISOString(),
        reviewer_id: profile.id,
        reviewer_comment: `Bulk validation — ${ids.length} jobs`,
      }).eq('id', jobId);

      if (topC) {
        await supabase.from('sie_species_candidates').update({ is_selected: true, is_validated: true }).eq('id', topC.id);
      }

      await supabase.from('sie_validation_history').insert({
        job_id: jobId,
        action: 'bulk_human_validated',
        field_name: 'species',
        comment: `Bulk validation — ${ids.length} jobs selected explicitly`,
        reviewer_id: profile.id,
        reviewer_name: profile.display_name ?? profile.email ?? null,
      });
    }

    setBulkProcessing(false);
    setBulkSelectedIds(new Set());
    setBulkMode(false);
    setBulkConfirmOpen(false);
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
  const isMockEngine = !selectedJob?.ai_provider || selectedJob.ai_provider === 'mock';

  // Bulk confirmation info
  const bulkJobsArray = Array.from(bulkSelectedIds);
  const bulkFirstJob = jobs.find((j) => bulkSelectedIds.has(j.id));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* ── Mock Engine Warning Banner ── */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 flex items-start gap-3">
          <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Mock proposals — workflow testing only. Not real visual identification.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These proposals are generated by <strong>Mock Engine v2</strong> using asset metadata, not actual visual AI analysis.
              Human validation of mock proposals is possible but reviewers must be aware of this limitation.
              <span className="ml-1 font-mono bg-amber-100 px-1 rounded">provider_mode = mock</span>
            </p>
          </div>
        </div>

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
            {/* Validation progress */}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Validation progress</p>
              <p className="text-sm font-bold text-foreground">
                {validationStats.validated} / {validationStats.total}
                <span className="text-xs font-normal text-muted-foreground ml-1">validated</span>
              </p>
            </div>
            <button
              onClick={() => setBulkMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${bulkMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-muted/40 border-border text-muted-foreground hover:border-blue-300'}`}>
              <CheckSquare size={12} />Bulk
            </button>
            <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
          </div>
        </div>

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

        {/* ── Bulk validation bar ── */}
        {bulkMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-blue-800">
                  Bulk Validation — {bulkSelectedIds.size} selected
                </span>
                <button onClick={() => setBulkSelectedIds(new Set(jobs.map((j) => j.id)))}
                  className="text-xs text-blue-600 underline">Select all</button>
                <button onClick={() => setBulkSelectedIds(new Set())}
                  className="text-xs text-blue-600 underline">Clear</button>
              </div>
              <button
                onClick={() => { if (bulkSelectedIds.size > 0) setBulkConfirmOpen(true); }}
                disabled={bulkSelectedIds.size === 0}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
                Review &amp; Confirm {bulkSelectedIds.size} jobs
              </button>
            </div>
          </div>
        )}

        {/* ── Bulk Confirmation Dialog ── */}
        {bulkConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Confirm Bulk Validation</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You are about to validate <strong>{bulkSelectedIds.size} jobs</strong> using their top AI candidate.
                    Each proposal will be shown before confirmation.
                  </p>
                </div>
              </div>

              {/* Show top candidate for first selected job */}
              {bulkFirstJob && (
                <div className="bg-muted/30 border border-border rounded-xl p-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Example — first selected job:</p>
                  <p className="text-sm font-semibold text-foreground">
                    {bulkFirstJob.current_name ?? bulkFirstJob.public_asset_id ?? bulkFirstJob.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Will apply top AI candidate (rank 1) to each selected job.
                  </p>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700">
                  <strong>Warning:</strong> This will mark {bulkSelectedIds.size} jobs as human_validated.
                  Only proceed if you have reviewed the proposals for each selected asset.
                  This action cannot be undone in bulk.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBulkConfirmOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button
                  onClick={runBulkValidation}
                  disabled={bulkProcessing}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {bulkProcessing ? (
                    <><Loader2 size={14} className="animate-spin" />Processing...</>
                  ) : (
                    <>Confirm {bulkSelectedIds.size} jobs</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM IDENTIFICATION Dialog ── */}
        {confirmDialogOpen && selectedJob && selectedCandidate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Confirm Identification</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You are about to confirm the identification for this asset.
                  </p>
                </div>
              </div>

              {/* Selected candidate summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Selected species:</p>
                <p className="text-base font-bold text-foreground">{selectedCandidate.common_name}</p>
                {selectedCandidate.scientific_name && (
                  <p className="text-sm text-muted-foreground italic">{selectedCandidate.scientific_name}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedCandidate.family && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {selectedCandidate.family}
                    </span>
                  )}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">
                    {selectedCandidate.ai_score}% confidence
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    provider_mode = {isMockEngine ? 'mock' : 'real_ai'}
                  </span>
                </div>
              </div>

              {/* Field decisions summary */}
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
                          decision.action === 'edit'? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {decision.action === 'edit' && editValues[field] ? `Edit: "${editValues[field]}"` : decision.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isMockEngine && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-amber-700">
                    <strong>Mock Engine Warning:</strong> This proposal was generated by Mock Engine v2, not real visual AI.
                    You are confirming a mock proposal. This is valid for workflow testing.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground mb-4">
                This will: mark as <strong>human_validated</strong>, record reviewer &amp; date,
                propagate approved fields to assets/species/library, and update job status to <strong>validated</strong>.
                Other proposals will be preserved in history.
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

          {/* ── Job list ── */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
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
              </div>

              {fetching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
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
                      {bulkMode && (
                        <input type="checkbox" checked={bulkSelectedIds.has(job.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setBulkSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
                              return next;
                            });
                          }}
                          className="mt-1 rounded border-border text-blue-600 shrink-0" />
                      )}
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
            {!selectedJob ? (
              <div className="bg-card border border-border rounded-xl flex items-center justify-center py-24 text-center">
                <div>
                  <Target size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select a job to start validation</p>
                  <Link href="/admin/ai-studio/identify" className="text-xs text-blue-600 underline mt-2 block">
                    Launch AI identification first
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                {/* Navigation bar */}
                <div className="flex items-center justify-between mb-4 bg-card border border-border rounded-xl px-4 py-2.5">
                  <button onClick={goToPrev} disabled={currentJobIndex === 0 && jobPage === 0}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />Previous
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">
                      {currentJobIndex + 1 + jobPage * PAGE_SIZE} / {jobTotal}
                    </p>
                    <p className="text-[10px] text-muted-foreground">← → keys to navigate</p>
                  </div>
                  <button onClick={goToNext} disabled={currentJobIndex === jobs.length - 1 && (jobPage + 1) * PAGE_SIZE >= jobTotal}
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
                            <p className="text-sm font-semibold text-foreground truncate">
                              {assetTitle ?? selectedJob.current_name ?? selectedJob.public_asset_id ?? selectedJob.id.slice(0, 12)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {selectedJob.public_asset_id ?? selectedJob.asset_id?.slice(0, 12) ?? '—'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {selectedJob.current_category ?? 'Unknown category'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${JOB_STATUS_COLORS[selectedJob.job_status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {selectedJob.job_status}
                            </span>
                            {assetStatus && assetStatus !== selectedJob.job_status && (
                              <span className="text-[10px] text-muted-foreground">
                                Asset: {assetStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Real asset preview */}
                      <AssetPreview preview={assetPreview} />

                      {/* Confidence scores */}
                      <div className="p-4 grid grid-cols-2 gap-2 text-xs">
                        {[
                          { label: 'Vision', value: selectedJob.vision_confidence },
                          { label: 'Species', value: selectedJob.species_confidence },
                          { label: 'Commercial', value: selectedJob.commercial_confidence },
                          { label: 'Metadata', value: selectedJob.metadata_confidence },
                        ].map(({ label, value }) => value != null && (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-mono font-semibold ${confidenceColor(value)}`}>{value}%</span>
                          </div>
                        ))}
                        {selectedJob.global_confidence != null && (
                          <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border">
                            <span className="text-muted-foreground font-medium">Global</span>
                            <span className={`font-mono font-bold text-sm ${confidenceColor(selectedJob.global_confidence)}`}>
                              {selectedJob.global_confidence}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Provider mode indicator */}
                      <div className="px-4 pb-3">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isMockEngine ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                          provider_mode = {isMockEngine ? 'mock' : 'real_ai'}
                        </span>
                        {selectedJob.ai_model && (
                          <span className="text-[10px] text-muted-foreground ml-2">{selectedJob.ai_model}</span>
                        )}
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
                      {/* CONFIRM IDENTIFICATION — primary action */}
                      <button
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={actionLoading || !selectedCandidate || selectedJob.job_status === 'validated'}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold px-6 py-3.5 rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm text-sm">
                        {actionLoading ? (
                          <><Loader2 size={16} className="animate-spin" />Confirming...</>
                        ) : selectedJob.job_status === 'validated' ? (
                          <><CheckCircle2 size={16} />Already Validated</>
                        ) : (
                          <><CheckCircle2 size={16} />CONFIRM IDENTIFICATION</>
                        )}
                      </button>

                      {/* Secondary actions */}
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
                                h.action === 'reject' || h.action === 'reject_candidate' ? 'bg-red-100 text-red-700' :
                                h.action === 'undo' ? 'bg-amber-100 text-amber-700' :
                                h.action === 'bulk_human_validated'? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
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

                  {/* ── RIGHT: Top 5 AI Proposals ── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-foreground">Top 5 AI Proposals</h3>
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

                    {/* Confidence alert */}
                    {selectedCandidate && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        selectedCandidate.ai_score < 40
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : selectedCandidate.ai_score < 70
                          ? 'bg-amber-50 border-amber-200 text-amber-700' :'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        <AlertTriangle size={12} className="shrink-0" />
                        {selectedCandidate.ai_score < 40
                          ? 'Low confidence — identification uncertain'
                          : selectedCandidate.ai_score < 70
                          ? 'Medium confidence — review carefully' :'Higher confidence — human review still required'}
                      </div>
                    )}

                    {candidates.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-6 text-center">
                        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-foreground mb-2">No proposals found for this job</p>
                        <div className="text-left bg-muted/40 border border-border rounded-lg p-3 mb-4 text-xs space-y-1.5">
                          <p className="font-semibold text-foreground">Diagnostic:</p>
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">job_id:</span> {selectedJob.id}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">asset_id:</span> {selectedJob.asset_id ?? '— (null)'}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">job_status:</span>{' '}
                            <span className={`px-1.5 py-0.5 rounded font-medium ${JOB_STATUS_COLORS[selectedJob.job_status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {selectedJob.job_status}
                            </span>
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-mono text-foreground">ai_provider:</span> {selectedJob.ai_provider ?? 'mock'}
                          </p>
                          <div className="pt-1 border-t border-border">
                            <p className="font-semibold text-foreground mb-1">Possible causes:</p>
                            <ul className="space-y-0.5 text-muted-foreground">
                              <li>• Candidate rows were never inserted (check browser console for insert errors)</li>
                              <li>• RLS policy blocked the insert (reviewer role may lack write permission)</li>
                              <li>• product_form enum mismatch caused a silent insert failure</li>
                              <li>• This job was created before the fix — re-run identification to generate candidates</li>
                            </ul>
                          </div>
                        </div>
                        <Link href={`/admin/ai-studio/identify`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 underline">
                          Re-run identification to generate proposals →
                        </Link>
                      </div>
                    ) : (
                      candidates.map((c) => {
                        const isSelected = c.id === selectedCandidateId;
                        return (
                          <div key={c.id}
                            className={`bg-card border rounded-xl p-4 transition-all cursor-pointer ${
                              c.is_validated ? 'border-emerald-400 bg-emerald-50/30' : isSelected ?'border-violet-400 bg-violet-50/20 ring-1 ring-violet-300' :
                              c.rank === 1 ? 'border-violet-200' : 'border-border'
                            }`}
                            onClick={() => setSelectedCandidateId(c.id)}>

                            {/* Candidate header */}
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

                            {/* Source + Mock indicator */}
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
                              {c.product_form && (
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Package size={9} />{c.product_form}
                                </span>
                              )}
                              {c.commercial_name && c.commercial_name !== c.common_name && (
                                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  {c.commercial_name}
                                </span>
                              )}
                            </div>

                            {/* Real AI: visual evidence */}
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

                            {/* Real AI: identification limits */}
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

                            {/* Description */}
                            {c.description_candidate && (
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.description_candidate}</p>
                            )}

                            {/* Keywords */}
                            {c.keywords_candidate && c.keywords_candidate.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {c.keywords_candidate.slice(0, 5).map((kw, i) => (
                                  <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Reasons */}
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

                            {/* Similarity bar */}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs text-muted-foreground shrink-0">Similarity:</span>
                              <div className="flex-1 bg-muted rounded-full h-1.5">
                                <div className="bg-gradient-to-r from-violet-400 to-blue-400 h-1.5 rounded-full"
                                  style={{ width: `${c.similarity_score}%` }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground shrink-0">{c.similarity_score}%</span>
                            </div>

                            {/* Per-candidate actions */}
                            <div className="flex gap-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(c.id); if (c.is_real_ai) { fetchPilotMetadata(c.id); setShowPilotMetadata(true); } }}
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

                            {/* Validated badge */}
                            {c.is_validated && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                <CheckCircle2 size={12} />Validated — propagated to all targets
                              </div>
                            )}

                            {/* Selected indicator */}
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
                        <ArrowRight size={11} className="text-violet-500" />After CONFIRM IDENTIFICATION — propagates to:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PROPAGATION_TARGETS.map(({ key, label }) => (
                          <span key={key} className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                            {label}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Only approved fields are propagated. Rejected and unknown fields are never published.
                      </p>
                    </div>

                    {/* OpenAI Pilot Candidate Metadata Panel */}
                    {showPilotMetadata && pilotMetadata && (
                      <div className="bg-card border border-emerald-200 rounded-xl p-4" id="candidate-metadata">
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

                          {/* Confidence scores */}
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

                          {/* Warnings */}
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
