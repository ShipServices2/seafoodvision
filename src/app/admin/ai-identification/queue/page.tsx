'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Clock, Brain, Flag, EyeOff, RefreshCw, ChevronLeft, ChevronRight, Search, Zap } from 'lucide-react';

interface PendingJob {
  id: string;
  asset_id: string | null;
  public_asset_id: string | null;
  current_name: string | null;
  current_category: string | null;
  global_confidence: number | null;
  status: string;
  queued_at: string;
  reviewer_id: string | null;
  original_filename: string | null;
  import_batch: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  candidates_ready: 'bg-violet-100 text-violet-700 border-violet-200',
  under_review: 'bg-orange-100 text-orange-700 border-orange-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  ignored: 'bg-gray-50 text-gray-400 border-gray-200',
  reported: 'bg-orange-100 text-orange-600 border-orange-200',
};

export default function AIQueuePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUndo, setLastUndo] = useState<{ jobId: string; prevStatus: string } | null>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-identification/queue'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchJobs = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('ai_identification_jobs')
      .select('*', { count: 'exact' })
      .order('queued_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search.trim()) {
      query = query.or(`current_name.ilike.%${search}%,current_category.ilike.%${search}%,original_filename.ilike.%${search}%`);
    }

    const { data, count } = await query;
    setJobs(data ?? []);
    setTotal(count ?? 0);
    setFetching(false);
  }, [profile, page, statusFilter, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleIdentify = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch('/api/ai/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) {
        await fetchJobs();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (jobId: string, action: 'reported' | 'ignored', prevStatus: string) => {
    setActionLoading(jobId);
    const supabase = createClient();
    await supabase.from('ai_identification_jobs').update({ status: action }).eq('id', jobId);
    setLastUndo({ jobId, prevStatus });
    await fetchJobs();
    setActionLoading(null);
    setTimeout(() => setLastUndo(null), 8000);
  };

  const handleUndo = async () => {
    if (!lastUndo) return;
    const supabase = createClient();
    await supabase.from('ai_identification_jobs').update({ status: lastUndo.prevStatus }).eq('id', lastUndo.jobId);
    setLastUndo(null);
    await fetchJobs();
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin/ai-identification" className="hover:text-foreground transition-colors">AI Identification</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Pending Queue</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Pending Identification</h1>
              <p className="text-sm text-muted-foreground">{total} jobs — Identify, Report, or Ignore</p>
            </div>
          </div>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Undo bar */}
        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-amber-800">Action applied.</span>
            <button onClick={handleUndo} className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline">
              Undo
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, category, filename…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-secondary"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="candidates_ready">Candidates Ready</option>
            <option value="under_review">Under Review</option>
            <option value="reported">Reported</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Asset / Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Confidence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Queued</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      <div className="w-6 h-6 border-2 border-border border-t-secondary rounded-full animate-spin mx-auto mb-2" />
                      Loading…
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      No jobs found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm truncate max-w-48">
                          {job.current_name ?? job.original_filename ?? '—'}
                        </p>
                        {job.public_asset_id && (
                          <p className="text-xs text-muted-foreground font-mono-data">{job.public_asset_id}</p>
                        )}
                        {job.import_batch && (
                          <p className="text-xs text-muted-foreground">Batch: {job.import_batch}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{job.current_category ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {job.global_confidence != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-secondary h-1.5 rounded-full"
                                style={{ width: `${job.global_confidence}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono-data text-foreground">{job.global_confidence}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.queued_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {job.status === 'candidates_ready' ? (
                            <Link
                              href={`/admin/ai-identification/review?jobId=${job.id}`}
                              className="flex items-center gap-1 text-xs bg-secondary text-white px-2.5 py-1.5 rounded-lg hover:bg-secondary/90 transition-colors font-medium"
                            >
                              <Brain size={11} />
                              Review
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleIdentify(job.id)}
                              disabled={actionLoading === job.id || job.status === 'processing'}
                              className="flex items-center gap-1 text-xs bg-secondary text-white px-2.5 py-1.5 rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors font-medium"
                            >
                              {actionLoading === job.id ? (
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Zap size={11} />
                              )}
                              Identify
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(job.id, 'reported', job.status)}
                            disabled={actionLoading === job.id}
                            className="flex items-center gap-1 text-xs border border-border text-muted-foreground px-2.5 py-1.5 rounded-lg hover:border-orange-300 hover:text-orange-600 transition-colors"
                          >
                            <Flag size={11} />
                            Report
                          </button>
                          <button
                            onClick={() => handleAction(job.id, 'ignored', job.status)}
                            disabled={actionLoading === job.id}
                            className="flex items-center gap-1 text-xs border border-border text-muted-foreground px-2.5 py-1.5 rounded-lg hover:border-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <EyeOff size={11} />
                            Ignore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
