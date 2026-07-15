'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Target, CheckCircle2, XCircle, HelpCircle, Edit3, RotateCcw,
  ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Clock,
  Fish, Tag, Layers, Star
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


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
  is_selected: boolean;
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
  original_filename: string | null;
  image_url: string | null;
}

interface ValidationEntry {
  id: string;
  action: string;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  field_name: string | null;
  previous_status: string | null;
  new_status: string | null;
}

const FIELD_ACTIONS = ['approve', 'reject', 'edit', 'unknown'] as const;
type FieldAction = typeof FIELD_ACTIONS[number];

const ACTION_CONFIG: Record<FieldAction, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  approve: { label: 'Approve', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100' },
  reject: { label: 'Reject', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-300 hover:bg-red-100' },
  edit: { label: 'Edit', icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-300 hover:bg-blue-100' },
  unknown: { label: 'Unknown', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-300 hover:bg-gray-100' },
};

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [fieldActions, setFieldActions] = useState<Record<string, FieldAction>>({});
  const [lastUndo, setLastUndo] = useState<{ jobId: string; prevStatus: string } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 10;

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
    const { data, count } = await supabase
      .from('sie_jobs')
      .select('*', { count: 'exact' })
      .in('job_status', ['queued', 'proposals_ready', 'under_review'])
      .order('created_at', { ascending: false })
      .range(jobPage * PAGE_SIZE, (jobPage + 1) * PAGE_SIZE - 1);
    setJobs(data ?? []);
    setJobTotal(count ?? 0);
    setFetching(false);
    if (data && data.length > 0 && !selectedJob) {
      setSelectedJob(data[0]);
    }
  }, [profile, jobPage, selectedJob]);

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
      setFieldActions({});
      setComment('');
    }
  }, [selectedJob, fetchCandidates, fetchHistory]);

  const handleValidate = async (action: 'approve' | 'reject' | 'unknown', candidateId?: string) => {
    if (!selectedJob || !profile) return;
    setActionLoading(action);
    const supabase = createClient();
    const prevStatus = selectedJob.job_status;
    const newStatus = action === 'approve' ? 'validated' : action === 'reject' ? 'rejected' : 'unknown';

    await supabase.from('sie_jobs').update({ job_status: newStatus, reviewed_at: new Date().toISOString() }).eq('id', selectedJob.id);
    if (candidateId && action === 'approve') {
      await supabase.from('sie_species_candidates').update({ is_selected: true, is_validated: true }).eq('id', candidateId);
    }
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

    setLastUndo({ jobId: selectedJob.id, prevStatus });
    const t = setTimeout(() => setLastUndo(null), 8000);
    setUndoTimer(t);
    setComment('');
    setActionLoading(null);
    fetchJobs();
    fetchHistory(selectedJob.id);
  };

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

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const confidenceColor = (score: number) =>
    score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Target size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">Human Validation</h1>
                <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">SIE</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Photo gauche · Propositions IA droite · Approve / Reject / Edit / Unknown</p>
            </div>
          </div>
          <Link href="/admin/ai-studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← AI Studio</Link>
        </div>

        {/* Undo banner */}
        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">Action enregistrée.</p>
            <button onClick={handleUndo}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors">
              <RotateCcw size={14} />Annuler
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Job list */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Jobs ({jobTotal})</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setJobPage((p) => Math.max(0, p - 1))} disabled={jobPage === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-muted-foreground">{jobPage + 1}</span>
                  <button onClick={() => setJobPage((p) => p + 1)} disabled={(jobPage + 1) * PAGE_SIZE >= jobTotal}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              {fetching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-8 text-center px-4">
                  <p className="text-sm text-muted-foreground">Aucun job en attente</p>
                  <Link href="/admin/ai-studio/identify" className="text-xs text-blue-600 underline mt-1 block">
                    Lancer une identification
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {jobs.map((job) => (
                    <button key={job.id} onClick={() => setSelectedJob(job)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selectedJob?.id === job.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                      <p className="text-xs font-medium text-foreground truncate">
                        {job.current_name ?? job.public_asset_id ?? job.id.slice(0, 8)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${job.job_status === 'proposals_ready' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {job.job_status}
                        </span>
                        {job.global_confidence && (
                          <span className={`text-xs font-mono-data ${confidenceColor(job.global_confidence)}`}>
                            {job.global_confidence}%
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main validation panel */}
          <div className="lg:col-span-3">
            {!selectedJob ? (
              <div className="bg-card border border-border rounded-xl flex items-center justify-center py-24 text-center">
                <div>
                  <Target size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Sélectionnez un job pour commencer la validation</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* LEFT: Photo + job info */}
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedJob.current_name ?? selectedJob.public_asset_id ?? selectedJob.id.slice(0, 12)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedJob.current_category ?? 'Catégorie inconnue'}</p>
                    </div>
                    {selectedJob.image_url ? (
                      <img src={selectedJob.image_url} alt={selectedJob.current_name ?? 'Asset'}
                        className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        <Fish size={48} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Statut</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${selectedJob.job_status === 'proposals_ready' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedJob.job_status}
                        </span>
                      </div>
                      {selectedJob.global_confidence && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Confiance globale</span>
                          <span className={`font-mono-data font-semibold ${confidenceColor(selectedJob.global_confidence)}`}>
                            {selectedJob.global_confidence}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                      <MessageSquare size={12} />Commentaire reviewer
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Ajouter un commentaire..."
                      className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  {/* Global actions */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['approve', 'reject', 'unknown'] as const).map((action) => {
                      const cfg = ACTION_CONFIG[action];
                      const Icon = cfg.icon;
                      return (
                        <button key={action} onClick={() => handleValidate(action)}
                          disabled={!!actionLoading}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 ${cfg.bg} ${cfg.color}`}>
                          <Icon size={16} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* History */}
                  {history.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
                        <Clock size={12} />Historique
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {history.map((h) => (
                          <div key={h.id} className="flex items-start gap-2 text-xs">
                            <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${h.action === 'approve' ? 'bg-emerald-100 text-emerald-700' : h.action === 'reject' ? 'bg-red-100 text-red-700' : h.action === 'undo' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {h.action}
                            </span>
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
                    <Layers size={14} className="text-violet-500" />
                    <h3 className="text-sm font-semibold text-foreground">Top 5 Propositions IA</h3>
                    <span className="text-xs text-muted-foreground ml-auto">Suggestion IA — validation requise</span>
                  </div>

                  {candidates.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Aucune proposition disponible</p>
                      <p className="text-xs text-muted-foreground mt-1">Lancez l&apos;identification depuis le module Identify</p>
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <div key={c.id}
                        className={`bg-card border rounded-xl p-4 transition-all ${c.is_selected ? 'border-emerald-400 bg-emerald-50/30' : c.rank === 1 ? 'border-violet-200' : 'border-border'}`}>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.rank === 1 ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground'}`}>
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
                            <p className={`text-sm font-bold font-mono-data ${confidenceColor(c.ai_score)}`}>{c.ai_score}%</p>
                            <p className="text-xs text-muted-foreground">IA score</p>
                          </div>
                        </div>

                        {/* Taxonomy */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {c.family && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Fish size={10} />Famille: {c.family}
                            </span>
                          )}
                          {c.genus && (
                            <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                              Genre: {c.genus}
                            </span>
                          )}
                          {c.product_form && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Tag size={10} />{c.product_form}
                            </span>
                          )}
                        </div>

                        {/* Reasons */}
                        {c.main_reasons && c.main_reasons.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Raisons principales :</p>
                            <ul className="space-y-0.5">
                              {c.main_reasons.slice(0, 3).map((r, i) => (
                                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                  <Star size={9} className="text-violet-400 shrink-0 mt-0.5" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Similarity */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-muted-foreground">Similarité catalogue:</span>
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div className="bg-gradient-to-r from-violet-400 to-blue-400 h-1.5 rounded-full"
                              style={{ width: `${c.similarity_score}%` }} />
                          </div>
                          <span className="text-xs font-mono-data text-muted-foreground">{c.similarity_score}%</span>
                        </div>

                        {/* Per-candidate actions */}
                        <div className="flex gap-1.5">
                          {(['approve', 'reject', 'edit', 'unknown'] as const).map((action) => {
                            const cfg = ACTION_CONFIG[action];
                            const Icon = cfg.icon;
                            const isActive = fieldActions[c.id] === action;
                            return (
                              <button key={action}
                                onClick={() => {
                                  setFieldActions((prev) => ({ ...prev, [c.id]: action }));
                                  if (action === 'approve') handleValidate('approve', c.id);
                                  if (action === 'reject') handleValidate('reject', c.id);
                                  if (action === 'unknown') handleValidate('unknown', c.id);
                                }}
                                disabled={!!actionLoading}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${isActive ? `${cfg.bg} ${cfg.color} ring-1 ring-offset-1` : `bg-muted/40 border-border text-muted-foreground hover:${cfg.bg}`}`}>
                                <Icon size={11} />
                                <span className="hidden sm:inline">{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
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
