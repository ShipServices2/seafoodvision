'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Target, CircleCheck as CheckCircle2, Circle as XCircle, Circle as HelpCircle, RefreshCw, ChevronLeft, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react';

interface Candidate {
  id: string;
  rank: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  confidence: number;
  similarity: number;
  main_reasons: string[];
  product_form: string | null;
  is_selected: boolean;
  source_provider: string;
}

interface Job {
  id: string;
  asset_id: string | null;
  public_asset_id: string | null;
  current_name: string | null;
  current_category: string | null;
  status: string;
  global_confidence: number | null;
  reviewer_comment: string | null;
  original_filename: string | null;
  import_batch: string | null;
}

interface ValidationHistory {
  id: string;
  action: string;
  comment: string | null;
  created_at: string;
  previous_status: string | null;
  new_status: string | null;
}

function ReviewContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [history, setHistory] = useState<ValidationHistory[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUndo, setLastUndo] = useState<{ jobId: string; prevStatus: string } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobPage, setJobPage] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const JOB_PAGE_SIZE = 10;

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-identification/review'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchJobList = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const { data, count } = await supabase
      .from('ai_identification_jobs')
      .select('*', { count: 'exact' })
      .in('status', ['candidates_ready', 'under_review'])
      .order('queued_at', { ascending: true })
      .range(jobPage * JOB_PAGE_SIZE, (jobPage + 1) * JOB_PAGE_SIZE - 1);
    setJobs(data ?? []);
    setJobTotal(count ?? 0);
  }, [profile, jobPage]);

  const fetchJobDetail = useCallback(async (id: string) => {
    setFetching(true);
    const supabase = createClient();
    const [jobRes, candidatesRes, historyRes] = await Promise.all([
      supabase.from('ai_identification_jobs').select('*').eq('id', id).single(),
      supabase.from('ai_species_candidates').select('*').eq('job_id', id).order('rank', { ascending: true }),
      supabase.from('ai_validation_history').select('*').eq('job_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
    setJob(jobRes.data);
    setCandidates(candidatesRes.data ?? []);
    setHistory(historyRes.data ?? []);
    setFetching(false);
  }, []);

  useEffect(() => { fetchJobList(); }, [fetchJobList]);
  useEffect(() => { if (jobId) fetchJobDetail(jobId); }, [jobId, fetchJobDetail]);

  const handleValidate = async (action: 'approve' | 'reject' | 'replace' | 'mark_unknown') => {
    if (!job) return;
    setActionLoading(action);
    try {
      const res = await fetch('/api/ai/species', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          action,
          candidateId: selectedCandidate,
          comment,
        }),
      });
      if (res.ok) {
        setLastUndo({ jobId: job.id, prevStatus: job.status });
        await fetchJobDetail(job.id);
        await fetchJobList();
        setComment('');
        setTimeout(() => setLastUndo(null), 8000);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndo = async () => {
    if (!lastUndo) return;
    const supabase = createClient();
    await supabase.from('ai_identification_jobs').update({ status: lastUndo.prevStatus }).eq('id', lastUndo.jobId);
    setLastUndo(null);
    if (job) await fetchJobDetail(job.id);
    await fetchJobList();
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const confidenceColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 45) return 'text-blue-600';
    if (score >= 25) return 'text-amber-600';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin/ai-identification" className="hover:text-foreground transition-colors">AI Identification</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Identification Review</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Target size={16} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Identification Review</h1>
              <p className="text-sm text-muted-foreground">Top 5 candidates per asset — select and validate</p>
            </div>
          </div>
        </div>

        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-amber-800">Validation applied.</span>
            <button onClick={handleUndo} className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline">
              Undo
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Job list */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ready for Review ({jobTotal})
                </p>
              </div>
              <div className="divide-y divide-border">
                {jobs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No jobs ready for review.
                  </div>
                ) : (
                  jobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/admin/ai-identification/review?jobId=${j.id}`}
                      className={`block px-4 py-3 hover:bg-muted/30 transition-colors ${j.id === jobId ? 'bg-secondary/5 border-l-2 border-l-secondary' : ''}`}
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {j.current_name ?? j.original_filename ?? 'Unnamed'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{j.current_category ?? '—'}</span>
                        {j.global_confidence != null && (
                          <span className={`text-xs font-mono-data font-semibold ${confidenceColor(j.global_confidence)}`}>
                            {j.global_confidence}%
                          </span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
              {jobTotal > JOB_PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                  <button onClick={() => setJobPage((p) => Math.max(0, p - 1))} disabled={jobPage === 0} className="p-1 disabled:opacity-40">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-muted-foreground">{jobPage + 1} / {Math.ceil(jobTotal / JOB_PAGE_SIZE)}</span>
                  <button onClick={() => setJobPage((p) => p + 1)} disabled={(jobPage + 1) * JOB_PAGE_SIZE >= jobTotal} className="p-1 disabled:opacity-40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Candidates panel */}
          <div className="lg:col-span-2">
            {!jobId ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Target size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a job from the list to review its Top 5 candidates.</p>
              </div>
            ) : fetching ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <div className="w-6 h-6 border-2 border-border border-t-secondary rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading candidates…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Job context */}
                {job && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{job.current_name ?? 'Unnamed asset'}</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                          {job.current_category && <span>Category: {job.current_category}</span>}
                          {job.original_filename && <span>File: {job.original_filename}</span>}
                          {job.import_batch && <span>Batch: {job.import_batch}</span>}
                          {job.public_asset_id && <span className="font-mono-data">{job.public_asset_id}</span>}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        job.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        job.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                        job.status === 'unknown'? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Safety notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Top 5 suggestions — never a single automatic result. Select the best candidate and validate.
                    Ambiguity detected: multiple species possible.
                  </p>
                </div>

                {/* Top 5 candidates */}
                {candidates.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">No candidates yet. Run identification first.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidates.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCandidate(c.id === selectedCandidate ? null : c.id)}
                        className={`bg-card border rounded-xl p-4 cursor-pointer transition-all duration-150 ${
                          selectedCandidate === c.id
                            ? 'border-secondary shadow-sm bg-secondary/5'
                            : 'border-border hover:border-secondary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              c.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              c.rank === 2 ? 'bg-gray-100 text-gray-600': 'bg-muted text-muted-foreground'
                            }`}>
                              {c.rank}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground text-sm">{c.common_name}</p>
                                {c.is_selected && (
                                  <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">Selected</span>
                                )}
                              </div>
                              {c.scientific_name && (
                                <p className="text-xs text-muted-foreground italic">{c.scientific_name}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                {c.family && <span>Family: {c.family}</span>}
                                {c.genus && <span>Genus: {c.genus}</span>}
                                {c.product_form && <span>Form: {c.product_form}</span>}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {c.main_reasons.slice(0, 3).map((r, i) => (
                                  <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-lg font-bold font-mono-data ${confidenceColor(c.confidence)}`}>
                              {c.confidence}%
                            </p>
                            <p className="text-xs text-muted-foreground">confidence</p>
                            <p className="text-xs font-mono-data text-muted-foreground mt-0.5">{c.similarity}% sim.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation actions */}
                {candidates.length > 0 && job?.status !== 'approved' && job?.status !== 'rejected' && (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validation</p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Reviewer comment (optional)…"
                      rows={2}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleValidate('approve')}
                        disabled={!selectedCandidate || !!actionLoading}
                        className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
                      >
                        <CheckCircle2 size={14} />
                        {actionLoading === 'approve' ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleValidate('reject')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                      >
                        <XCircle size={14} />
                        {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleValidate('replace')}
                        disabled={!selectedCandidate || !!actionLoading}
                        className="flex items-center gap-1.5 text-sm border border-border text-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors font-medium"
                      >
                        <RefreshCw size={14} />
                        Replace
                      </button>
                      <button
                        onClick={() => handleValidate('mark_unknown')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 text-sm border border-border text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted transition-colors font-medium"
                      >
                        <HelpCircle size={14} />
                        Unknown
                      </button>
                    </div>
                    {!selectedCandidate && (
                      <p className="text-xs text-amber-600">Select a candidate above to approve or replace.</p>
                    )}
                  </div>
                )}

                {/* History */}
                {history.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Validation History</p>
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div key={h.id} className="flex items-start gap-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full border font-medium capitalize ${
                            h.action === 'approve' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            h.action === 'reject'? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {h.action}
                          </span>
                          <span className="text-muted-foreground">{h.previous_status} → {h.new_status}</span>
                          {h.comment && <span className="text-foreground italic">"{h.comment}"</span>}
                          <span className="text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function AIReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
