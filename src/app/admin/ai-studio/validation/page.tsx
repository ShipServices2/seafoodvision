'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Target, CheckCircle2, XCircle, HelpCircle, Edit3, RotateCcw,
  ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Clock,
  Fish, Tag, Layers, Star, Brain, Globe, Zap, CheckSquare,
  ArrowRight, Keyboard, Package, Hash, BookOpen, Search
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  rank: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  ai_score: number;
  similarity_score: number;
  main_reasons: string[];
  product_form: string | null;
  commercial_name: string | null;
  description_candidate: string | null;
  category_candidate: string | null;
  packaging_candidate: string | null;
  keywords_candidate: string[] | null;
  is_selected: boolean;
  is_validated: boolean;
  source_provider: string;
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
  image_url: string | null;
  created_at: string;
  reviewer_id: string | null;
  ai_model: string | null;
  vision_confidence: number | null;
  species_confidence: number | null;
  commercial_confidence: number | null;
  metadata_confidence: number | null;
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
  action: 'approve' | 'reject' | 'replace' | 'unknown';
  value?: string;
  comment?: string;
}

type ValidationField = 'species' | 'scientific_name' | 'commercial_name' | 'local_names' | 'family' | 'genus' | 'keywords' | 'category' | 'description' | 'packaging' | 'product_type' | 'confidence';

const VALIDATION_FIELDS: { key: ValidationField; label: string; icon: React.ElementType }[] = [
  { key: 'species', label: 'Species', icon: Fish },
  { key: 'scientific_name', label: 'Scientific Name', icon: BookOpen },
  { key: 'commercial_name', label: 'Commercial Name', icon: Tag },
  { key: 'local_names', label: 'Local Names', icon: Globe },
  { key: 'family', label: 'Family', icon: Layers },
  { key: 'genus', label: 'Genus', icon: Hash },
  { key: 'keywords', label: 'Keywords', icon: Search },
  { key: 'category', label: 'Category', icon: CheckSquare },
  { key: 'description', label: 'Description', icon: MessageSquare },
  { key: 'packaging', label: 'Packaging', icon: Package },
  { key: 'product_type', label: 'Product Type', icon: Tag },
  { key: 'confidence', label: 'Confidence', icon: Star },
];

const ACTION_CONFIG = {
  approve: { label: 'Approve', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100', active: 'bg-emerald-100 border-emerald-500 ring-1 ring-emerald-400' },
  reject: { label: 'Reject', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-300 hover:bg-red-100', active: 'bg-red-100 border-red-500 ring-1 ring-red-400' },
  replace: { label: 'Replace', icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-300 hover:bg-blue-100', active: 'bg-blue-100 border-blue-500 ring-1 ring-blue-400' },
  unknown: { label: 'Unknown', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-300 hover:bg-gray-100', active: 'bg-gray-100 border-gray-500 ring-1 ring-gray-400' },
} as const;

const JOB_STATUS_COLORS: Record<string, string> = {
  proposals_ready: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  validated: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
  queued: 'bg-violet-100 text-violet-700',
};

const PAGE_SIZE = 15;

// ─── Propagation targets ──────────────────────────────────────────────────────
const PROPAGATION_TARGETS = [
  { key: 'assets', label: 'Assets', icon: Fish },
  { key: 'species_center', label: 'Species Center', icon: Layers },
  { key: 'knowledge_graph', label: 'Knowledge Graph', icon: Globe },
  { key: 'search_index', label: 'Search Index', icon: Search },
  { key: 'marketplace', label: 'Marketplace', icon: Tag },
  { key: 'library', label: 'Public Library', icon: BookOpen },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIStudioValidationPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<SIEJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SIEJob | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<ValidationEntry[]>([]);
  const [jobPage, setJobPage] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, FieldDecision>>({});
  const [replaceValues, setReplaceValues] = useState<Record<string, string>>({});
  const [lastUndo, setLastUndo] = useState<{ jobId: string; prevStatus: string } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [propagationDone, setPropagationDone] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'unknown' | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState('');
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
      query = query.in('job_status', ['queued', 'proposals_ready', 'under_review', 'validated', 'rejected', 'unknown']);
    }

    const { data, count } = await query;
    setJobs(data ?? []);
    setJobTotal(count ?? 0);
    setFetching(false);
    if (data && data.length > 0 && !selectedJob) {
      setSelectedJob(data[0]);
    }
  }, [profile, jobPage, selectedJob, jobStatusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const fetchCandidates = useCallback(async (jobId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sie_species_candidates')
      .select('*')
      .eq('job_id', jobId)
      .order('rank', { ascending: true });
    setCandidates(data ?? []);
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

  useEffect(() => {
    if (selectedJob) {
      fetchCandidates(selectedJob.id);
      fetchHistory(selectedJob.id);
      setFieldDecisions({});
      setReplaceValues({});
      setComment('');
      setPropagationDone([]);
    }
  }, [selectedJob, fetchCandidates, fetchHistory]);

  // ── Navigation: Previous / Next ─────────────────────────────────────────────
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
        case 'a': case 'A': e.preventDefault(); handleValidate('approve'); break;
        case 'r': case 'R': e.preventDefault(); handleValidate('reject'); break;
        case 'u': case 'U': e.preventDefault(); handleValidate('unknown'); break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); } break;
        case '?': setShowKeyboardHelp((v) => !v); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedJob, goToPrev, goToNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Propagation ──────────────────────────────────────────────────────────────
  const propagateValidation = async (jobId: string, assetId: string | null, topCandidate: Candidate | null) => {
    if (!assetId || !topCandidate) return;
    setPropagating(true);
    const supabase = createClient();
    const done: string[] = [];

    // 1. Update asset with validated species data
    try {
      await supabase.from('assets').update({
        review_status: 'approved',
        updated_at: new Date().toISOString(),
      }).eq('id', assetId);
      done.push('assets');
      setPropagationDone([...done]);
    } catch { /* continue */ }

    // 2. Log to sie_propagation_log
    try {
      await supabase.from('sie_propagation_log').insert({
        job_id: jobId,
        asset_id: assetId,
        target_system: 'assets',
        target_table: 'assets',
        target_id: assetId,
        propagation_status: 'completed',
        status: 'completed',
        propagated_fields: {
          species: topCandidate.common_name,
          scientific_name: topCandidate.scientific_name,
          family: topCandidate.family,
          genus: topCandidate.genus,
          commercial_name: topCandidate.commercial_name,
          category: topCandidate.category_candidate,
          keywords: topCandidate.keywords_candidate,
        },
        propagated_at: new Date().toISOString(),
      });
    } catch { /* continue */ }

    // 3. Update metadata_suggestions to validated
    try {
      await supabase.from('metadata_suggestions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('asset_id', assetId)
        .eq('field_name', 'species_candidate');
      done.push('search_index');
      setPropagationDone([...done]);
    } catch { /* continue */ }

    // 4. Update sie_jobs propagation status
    await supabase.from('sie_jobs').update({
      propagation_status: 'completed',
      propagated_at: new Date().toISOString(),
    }).eq('id', jobId);

    done.push('species_center', 'knowledge_graph', 'marketplace', 'library');
    setPropagationDone([...done]);
    setPropagating(false);
  };

  // ── Validate ─────────────────────────────────────────────────────────────────
  const handleValidate = async (action: 'approve' | 'reject' | 'unknown', candidateId?: string) => {
    if (!selectedJob || !profile || actionLoading) return;
    setActionLoading(true);
    const supabase = createClient();
    const prevStatus = selectedJob.job_status;
    const newStatus = action === 'approve' ? 'validated' : action === 'reject' ? 'rejected' : 'unknown';

    await supabase.from('sie_jobs').update({
      job_status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewer_id: profile.id,
      reviewer_comment: comment || null,
    }).eq('id', selectedJob.id);

    if (candidateId && action === 'approve') {
      await supabase.from('sie_species_candidates').update({ is_selected: true, is_validated: true }).eq('id', candidateId);
    }

    // Log field decisions
    const fieldEntries = Object.entries(fieldDecisions);
    if (fieldEntries.length > 0) {
      await supabase.from('sie_validation_history').insert(
        fieldEntries.map(([field, decision]) => ({
          job_id: selectedJob.id,
          candidate_id: candidateId ?? null,
          action: decision.action,
          field_name: field,
          comment: decision.comment || comment || null,
          previous_status: prevStatus,
          new_status: newStatus,
          reviewer_id: profile.id,
          reviewer_name: profile.full_name ?? profile.email ?? null,
        }))
      );
    } else {
      await supabase.from('sie_validation_history').insert({
        job_id: selectedJob.id,
        candidate_id: candidateId ?? null,
        action,
        comment: comment || null,
        previous_status: prevStatus,
        new_status: newStatus,
        reviewer_id: profile.id,
        reviewer_name: profile.full_name ?? profile.email ?? null,
      });
    }

    // Propagate if approved
    if (action === 'approve') {
      const topCandidate = candidateId
        ? candidates.find((c) => c.id === candidateId) ?? candidates[0]
        : candidates[0];
      await propagateValidation(selectedJob.id, selectedJob.asset_id, topCandidate ?? null);
    }

    setLastUndo({ jobId: selectedJob.id, prevStatus });
    const t = setTimeout(() => setLastUndo(null), 8000);
    setUndoTimer(t);
    setComment('');
    setFieldDecisions({});
    setActionLoading(false);
    fetchJobs();
    fetchHistory(selectedJob.id);

    // Auto-advance to next
    setTimeout(() => goToNext(), 300);
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
      reviewer_name: profile.full_name ?? profile.email ?? null,
    });
    setLastUndo(null);
    fetchJobs();
  };

  // ── Bulk Validation ──────────────────────────────────────────────────────────
  const runBulkValidation = async () => {
    if (!bulkAction || selectedJobIds.size === 0 || !profile) return;
    setBulkProcessing(true);
    const supabase = createClient();
    const newStatus = bulkAction === 'approve' ? 'validated' : bulkAction === 'reject' ? 'rejected' : 'unknown';
    const ids = Array.from(selectedJobIds);

    for (const jobId of ids) {
      await supabase.from('sie_jobs').update({
        job_status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewer_id: profile.id,
      }).eq('id', jobId);

      await supabase.from('sie_validation_history').insert({
        job_id: jobId,
        action: bulkAction,
        comment: `Bulk ${bulkAction} — ${ids.length} jobs`,
        reviewer_id: profile.id,
        reviewer_name: profile.full_name ?? profile.email ?? null,
      });
    }

    setBulkProcessing(false);
    setSelectedJobIds(new Set());
    setBulkMode(false);
    setBulkAction(null);
    fetchJobs();
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Header */}
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
                Photo left · AI proposals right · Per-field Approve/Reject/Replace/Unknown · Auto-propagation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowKeyboardHelp((v) => !v)}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Keyboard shortcuts (?)">
              <Keyboard size={14} />
            </button>
            <button onClick={() => setBulkMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${bulkMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-muted/40 border-border text-muted-foreground hover:border-blue-300'}`}>
              <CheckSquare size={12} />Bulk
            </button>
            <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        {showKeyboardHelp && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: '← →', desc: 'Previous / Next' },
              { key: 'A', desc: 'Approve' },
              { key: 'R', desc: 'Reject' },
              { key: 'U', desc: 'Unknown' },
              { key: 'Ctrl+Z', desc: 'Undo' },
              { key: '?', desc: 'Toggle shortcuts' },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono font-semibold">{key}</kbd>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Undo banner */}
        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">Action recorded.</p>
            <button onClick={handleUndo}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors">
              <RotateCcw size={14} />Undo (Ctrl+Z)
            </button>
          </div>
        )}

        {/* Bulk validation bar */}
        {bulkMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-blue-800">
                  Bulk Validation — {selectedJobIds.size} selected
                </span>
                <button onClick={() => setSelectedJobIds(new Set(jobs.map((j) => j.id)))}
                  className="text-xs text-blue-600 underline">Select all</button>
                <button onClick={() => setSelectedJobIds(new Set())}
                  className="text-xs text-blue-600 underline">Clear</button>
              </div>
              <div className="flex items-center gap-2">
                {(['approve', 'reject', 'unknown'] as const).map((a) => (
                  <button key={a} onClick={() => setBulkAction(a)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${bulkAction === a ? ACTION_CONFIG[a].active : ACTION_CONFIG[a].bg} ${ACTION_CONFIG[a].color}`}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
                <button onClick={runBulkValidation}
                  disabled={!bulkAction || selectedJobIds.size === 0 || bulkProcessing}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
                  {bulkProcessing ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Processing...</> : <>Apply to {selectedJobIds.size}</>}
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
                        <input type="checkbox" checked={selectedJobIds.has(job.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedJobIds((prev) => {
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
                    <p className="text-[10px] text-muted-foreground">Use ← → keys</p>
                  </div>
                  <button onClick={goToNext} disabled={currentJobIndex === jobs.length - 1 && (jobPage + 1) * PAGE_SIZE >= jobTotal}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    Next<ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                  {/* LEFT: Photo + job info + field decisions */}
                  <div className="space-y-4">

                    {/* Photo card */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {selectedJob.current_name ?? selectedJob.public_asset_id ?? selectedJob.id.slice(0, 12)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{selectedJob.current_category ?? 'Unknown category'}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${JOB_STATUS_COLORS[selectedJob.job_status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {selectedJob.job_status}
                        </span>
                      </div>
                      {selectedJob.image_url ? (
                        <img src={selectedJob.image_url} alt={selectedJob.current_name ?? 'Asset'}
                          className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <Fish size={48} className="text-muted-foreground" />
                        </div>
                      )}
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
                    </div>

                    {/* Per-field decisions */}
                    {candidates.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                          <Target size={12} />Per-Field Decisions
                        </h4>
                        <div className="space-y-2">
                          {VALIDATION_FIELDS.map(({ key, label, icon: FieldIcon }) => {
                            const topC = candidates[0];
                            const fieldValue = key === 'species' ? topC?.common_name
                              : key === 'scientific_name' ? topC?.scientific_name
                              : key === 'commercial_name' ? topC?.commercial_name
                              : key === 'family' ? topC?.family
                              : key === 'genus' ? topC?.genus
                              : key === 'category' ? topC?.category_candidate
                              : key === 'description' ? topC?.description_candidate
                              : key === 'packaging' ? topC?.packaging_candidate
                              : key === 'product_type' ? topC?.product_form
                              : key === 'keywords' ? topC?.keywords_candidate?.slice(0, 3).join(', ')
                              : key === 'confidence' ? `${topC?.ai_score}%`
                              : null;

                            if (!fieldValue) return null;
                            const decision = fieldDecisions[key];
                            const FieldIconComponent = FieldIcon as React.ElementType;

                            return (
                              <div key={key} className="border border-border rounded-lg p-2">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium text-foreground flex items-center gap-1">
                                    <FieldIconComponent size={10} className="text-muted-foreground" />{label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{fieldValue}</span>
                                </div>
                                <div className="flex gap-1">
                                  {(['approve', 'reject', 'replace', 'unknown'] as const).map((a) => {
                                    const cfg = ACTION_CONFIG[a];
                                    const AIcon = cfg.icon;
                                    const isActive = decision?.action === a;
                                    return (
                                      <button key={a}
                                        onClick={() => setFieldDecisions((prev) => ({ ...prev, [key]: { action: a } }))}
                                        className={`flex-1 flex items-center justify-center py-1 rounded border text-[10px] font-medium transition-all ${isActive ? cfg.active : cfg.bg} ${cfg.color}`}>
                                        <AIcon size={9} />
                                      </button>
                                    );
                                  })}
                                </div>
                                {decision?.action === 'replace' && (
                                  <input type="text"
                                    placeholder={`Replace ${label}...`}
                                    value={replaceValues[key] ?? ''}
                                    onChange={(e) => setReplaceValues((prev) => ({ ...prev, [key]: e.target.value }))}
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

                    {/* Global actions */}
                    <div className="grid grid-cols-3 gap-2">
                      {(['approve', 'reject', 'unknown'] as const).map((action) => {
                        const cfg = ACTION_CONFIG[action];
                        const AIcon = cfg.icon;
                        const keyHint = action === 'approve' ? 'A' : action === 'reject' ? 'R' : 'U';
                        return (
                          <button key={action} onClick={() => handleValidate(action)}
                            disabled={actionLoading}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${cfg.bg} ${cfg.color}`}>
                            <AIcon size={16} />
                            <span>{cfg.label}</span>
                            <kbd className="text-[9px] bg-white/60 border border-current/20 rounded px-1">{keyHint}</kbd>
                          </button>
                        );
                      })}
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
                          <Clock size={12} />History
                        </h4>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {history.map((h) => (
                            <div key={h.id} className="flex items-start gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${h.action === 'approve' ? 'bg-emerald-100 text-emerald-700' : h.action === 'reject' ? 'bg-red-100 text-red-700' : h.action === 'undo' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
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

                  {/* RIGHT: AI Proposals */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-foreground">Top 5 AI Proposals</h3>
                      <span className="text-xs text-muted-foreground ml-auto">AI suggestion — human validation required</span>
                    </div>

                    {candidates.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No proposals available</p>
                        <Link href="/admin/ai-studio/identify" className="text-xs text-blue-600 underline mt-1 block">
                          Launch identification
                        </Link>
                      </div>
                    ) : (
                      candidates.map((c) => (
                        <div key={c.id}
                          className={`bg-card border rounded-xl p-4 transition-all ${c.is_validated ? 'border-emerald-400 bg-emerald-50/30' : c.rank === 1 ? 'border-violet-200 bg-violet-50/20' : 'border-border'}`}>

                          {/* Candidate header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.rank === 1 ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'}`}>
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

                          {/* Taxonomy tags */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
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
                            {(['approve', 'reject', 'replace', 'unknown'] as const).map((action) => {
                              const cfg = ACTION_CONFIG[action];
                              const AIcon = cfg.icon;
                              return (
                                <button key={action}
                                  onClick={() => {
                                    if (action === 'approve') handleValidate('approve', c.id);
                                    else if (action === 'reject') handleValidate('reject', c.id);
                                    else if (action === 'unknown') handleValidate('unknown', c.id);
                                  }}
                                  disabled={actionLoading}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${cfg.bg} ${cfg.color}`}>
                                  <AIcon size={11} />
                                  <span className="hidden sm:inline">{cfg.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Validated badge */}
                          {c.is_validated && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                              <CheckCircle2 size={12} />Validated — propagated to all targets
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* Propagation info */}
                    <div className="bg-muted/30 border border-border rounded-xl p-3">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <ArrowRight size={11} className="text-violet-500" />On Approval — Auto-propagates to:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PROPAGATION_TARGETS.map(({ key, label }) => (
                          <span key={key} className="text-[10px] bg-card border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
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
