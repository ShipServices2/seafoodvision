'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Layers, Zap, CircleCheck as CheckCircle2, Circle as XCircle, Circle as HelpCircle, TriangleAlert as AlertTriangle } from 'lucide-react';

type BatchSize = 50 | 100 | 250 | 500;
type BulkAction = 'approve' | 'reject' | 'mark_unknown';

interface BulkJob {
  id: string;
  batch_size: number;
  status: string;
  total_assets: number;
  processed: number;
  approved: number;
  rejected: number;
  unknown: number;
  skipped: number;
  created_at: string;
  completed_at: string | null;
}

interface PendingJob {
  id: string;
  current_name: string | null;
  current_category: string | null;
  global_confidence: number | null;
  status: string;
  public_asset_id: string | null;
}

export default function AIBulkPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [batchSize, setBatchSize] = useState<BatchSize>(50);
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [bulkHistory, setBulkHistory] = useState<BulkJob[]>([]);
  const [fetching, setFetching] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [lastUndo, setLastUndo] = useState<{ jobIds: string[]; prevStatus: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [bulkAction, setBulkAction] = useState<BulkAction>('approve');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/ai-identification/bulk'); return; }
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const supabase = createClient();
    const [jobsRes, historyRes] = await Promise.all([
      supabase
        .from('ai_identification_jobs')
        .select('id, current_name, current_category, global_confidence, status, public_asset_id')
        .in('status', ['pending', 'candidates_ready'])
        .order('queued_at', { ascending: true })
        .limit(batchSize),
      supabase
        .from('ai_bulk_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setPendingJobs(jobsRes.data ?? []);
    setBulkHistory(historyRes.data ?? []);
    setFetching(false);
  }, [profile, batchSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleJob = (id: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedJobs(new Set(pendingJobs.map((j) => j.id)));
  const clearAll = () => setSelectedJobs(new Set());

  const handleBulkIdentify = async () => {
    if (selectedJobs.size === 0) return;
    setProcessing(true);
    setProgress(0);
    setProgressTotal(selectedJobs.size);

    const supabase = createClient();

    // Create bulk job record
    const { data: bulkJob } = await supabase
      .from('ai_bulk_jobs')
      .insert({
        batch_size: selectedJobs.size,
        status: 'processing',
        total_assets: selectedJobs.size,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    let done = 0;
    for (const jobId of selectedJobs) {
      try {
        await fetch('/api/ai/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
      } catch {
        // Continue on error
      }
      done++;
      setProgress(done);
    }

    // Update bulk job
    if (bulkJob) {
      await supabase
        .from('ai_bulk_jobs')
        .update({ status: 'completed', processed: done, completed_at: new Date().toISOString() })
        .eq('id', bulkJob.id);
    }

    setProcessing(false);
    setPreviewMode(false);
    await fetchData();
  };

  const handleBulkValidate = async () => {
    if (selectedJobs.size === 0) return;
    setProcessing(true);
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const jobIds = [...selectedJobs];
    const statusMap: Record<BulkAction, string> = {
      approve: 'approved',
      reject: 'rejected',
      mark_unknown: 'unknown',
    };
    const newStatus = statusMap[bulkAction];

    // Batch update
    await supabase
      .from('ai_identification_jobs')
      .update({ status: newStatus, reviewer_id: currentUser?.id, reviewed_at: new Date().toISOString() })
      .in('id', jobIds);

    // Log history for each
    const historyInserts = jobIds.map((id) => ({
      job_id: id,
      action: bulkAction,
      reviewer_id: currentUser?.id,
      new_status: newStatus,
      comment: `Bulk action: ${bulkAction} (${jobIds.length} assets)`,
    }));
    await supabase.from('ai_validation_history').insert(historyInserts);

    setLastUndo({ jobIds, prevStatus: 'candidates_ready' });
    setSelectedJobs(new Set());
    setProcessing(false);
    await fetchData();
    setTimeout(() => setLastUndo(null), 10000);
  };

  const handleUndo = async () => {
    if (!lastUndo) return;
    const supabase = createClient();
    await supabase
      .from('ai_identification_jobs')
      .update({ status: lastUndo.prevStatus })
      .in('id', lastUndo.jobIds);
    setLastUndo(null);
    await fetchData();
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const BATCH_SIZES: BatchSize[] = [50, 100, 250, 500];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/admin/ai-identification" className="hover:text-foreground transition-colors">AI Identification</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Bulk Identification</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Layers size={16} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Bulk Identification</h1>
              <p className="text-sm text-muted-foreground">Process 50 / 100 / 250 / 500 assets — mass validation</p>
            </div>
          </div>
        </div>

        {lastUndo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-amber-800">Bulk action applied to {lastUndo.jobIds.length} assets.</span>
            <button onClick={handleUndo} className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline">
              Undo All
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Batch size selector */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Batch Size</p>
              <div className="grid grid-cols-2 gap-2">
                {BATCH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setBatchSize(size)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      batchSize === size
                        ? 'bg-secondary text-white border-secondary' :'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk identify */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Step 1 — Identify</p>
              <p className="text-xs text-muted-foreground mb-3">
                Run AI identification on selected assets. Results are Top 5 candidates — never automatic.
              </p>
              <button
                onClick={handleBulkIdentify}
                disabled={selectedJobs.size === 0 || processing}
                className="w-full flex items-center justify-center gap-2 text-sm bg-secondary text-white py-2.5 rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition-colors font-medium"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing {progress}/{progressTotal}…
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Identify {selectedJobs.size > 0 ? `${selectedJobs.size} assets` : 'selected'}
                  </>
                )}
              </button>
              {processing && (
                <div className="mt-3">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-secondary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressTotal > 0 ? (progress / progressTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bulk validate */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Step 2 — Validate</p>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as BulkAction)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-secondary mb-3"
              >
                <option value="approve">Approve All Selected</option>
                <option value="reject">Reject All Selected</option>
                <option value="mark_unknown">Mark Unknown</option>
              </select>
              <button
                onClick={handleBulkValidate}
                disabled={selectedJobs.size === 0 || processing}
                className={`w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg disabled:opacity-50 transition-colors font-medium ${
                  bulkAction === 'approve' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                  bulkAction === 'reject'? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {bulkAction === 'approve' ? <CheckCircle2 size={14} /> :
                 bulkAction === 'reject' ? <XCircle size={14} /> :
                 <HelpCircle size={14} />}
                {bulkAction === 'approve' ? 'Approve' : bulkAction === 'reject' ? 'Reject' : 'Mark Unknown'} {selectedJobs.size > 0 ? `(${selectedJobs.size})` : ''}
              </button>
            </div>

            {/* Bulk history */}
            {bulkHistory.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Bulk Jobs</p>
                <div className="space-y-2">
                  {bulkHistory.slice(0, 5).map((bj) => (
                    <div key={bj.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-foreground">{bj.batch_size} assets</span>
                        <span className="text-muted-foreground ml-2">{new Date(bj.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border font-medium ${
                        bj.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        bj.status === 'processing'? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {bj.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Asset list */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Preview — {pendingJobs.length} assets (batch of {batchSize})
                </p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-secondary hover:underline">Select All</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </div>
              </div>

              {fetching ? (
                <div className="p-12 text-center">
                  <div className="w-6 h-6 border-2 border-border border-t-secondary rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading…</p>
                </div>
              ) : pendingJobs.length === 0 ? (
                <div className="p-12 text-center">
                  <Layers size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No pending assets found.</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {pendingJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => toggleJob(job.id)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        selectedJobs.has(job.id) ? 'bg-secondary/5' : 'hover:bg-muted/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(job.id)}
                        onChange={() => toggleJob(job.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-secondary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {job.current_name ?? 'Unnamed'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{job.current_category ?? '—'}</span>
                          {job.public_asset_id && (
                            <span className="text-xs font-mono-data text-muted-foreground">{job.public_asset_id}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {job.global_confidence != null ? (
                          <span className="text-xs font-mono-data font-semibold text-secondary">{job.global_confidence}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <p className="text-xs text-muted-foreground capitalize">{job.status.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{selectedJobs.size} selected</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle size={11} className="text-amber-500" />
                  Preview before applying bulk actions
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
