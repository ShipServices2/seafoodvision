'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter, CheckCircle2, AlertCircle, Zap, History, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminAssets, updateAssetStatus } from '@/lib/supabase/queries';
import type { Asset } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BulkActionBar from './components/BulkActionBar';
import ReviewMode from './components/ReviewMode';
import BulkHistoryLog from './components/BulkHistoryLog';

const REVIEW_STATUSES = [
  'draft', 'imported', 'under_review', 'approved', 'preview_only',
  'editorial', 'commercial', 'restricted', 'rejected', 'archived',
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500, 1000];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  imported: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  preview_only: 'bg-teal-100 text-teal-700',
  editorial: 'bg-purple-100 text-purple-700',
  commercial: 'bg-indigo-100 text-indigo-700',
  restricted: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
};

export default function AdminAssetsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Pagination & filters
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [demoFilter, setDemoFilter] = useState<'all' | 'real' | 'demo'>('all');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [selectAllResults, setSelectAllResults] = useState(false);

  // UI state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reviewModeActive, setReviewModeActive] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Undo state
  const [undoId, setUndoId] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assets');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAssets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const { assets: rows, total: t } = await fetchAdminAssets(page, pageSize, statusFilter || undefined, query || undefined);
    const filtered = demoFilter === 'all' ? rows :
      demoFilter === 'real' ? rows.filter((a) => !a.is_demo) :
      rows.filter((a) => a.is_demo);
    setAssets(filtered);
    setTotal(t);
    setFetching(false);
    // Clear selection on reload unless selectAllResults
    if (!selectAllResults) {
      setSelectedIds(new Set());
    }
  }, [page, pageSize, statusFilter, query, profile, demoFilter, selectAllResults]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (reviewModeActive) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      // Ctrl+A = select all on page
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set(assets.map((a) => a.id));
        setSelectedIds(allIds);
        return;
      }

      if (selectedIds.size === 0) return;

      if (e.key === 'a' || e.key === 'A') {
        handleBulkAction('approve');
      } else if (e.key === 'r' || e.key === 'R') {
        handleBulkAction('reject');
      } else if (e.key === 'p' || e.key === 'P') {
        handleBulkAction('promote', { status: 'approved' });
      } else if (e.key === 'u' || e.key === 'U') {
        handleBulkAction('under_review');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, selectedIds, reviewModeActive]);

  // Undo countdown
  const startUndoCountdown = useCallback((id: string) => {
    setUndoId(id);
    setUndoCountdown(600); // 10 minutes in seconds
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((c) => {
        if (c <= 1) {
          clearInterval(undoTimerRef.current!);
          setUndoId(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleBulkAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!user) return;
    const ids = selectAllResults
      ? assets.map((a) => a.id) // In a real scenario, fetch all IDs matching filter
      : Array.from(selectedIds);

    if (ids.length === 0) return;

    // Export handled client-side
    if (action === 'export') {
      const csv = [
        'id,public_asset_id,title,category,review_status,is_demo,created_at',
        ...assets
          .filter((a) => ids.includes(a.id))
          .map((a) => `${a.id},${a.public_asset_id || ''},${JSON.stringify(a.title)},${a.category || ''},${a.review_status},${a.is_demo},${a.created_at}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assets_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${ids.length} assets`, 'success');
      return;
    }

    try {
      const res = await fetch('/api/admin/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, assetIds: ids, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Bulk action failed', 'error');
        return;
      }
      showToast(`${data.successCount} assets updated`, 'success');
      if (data.undoId) startUndoCountdown(data.undoId);
      setSelectedIds(new Set());
      setSelectAllResults(false);
      loadAssets();
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleUndo = async () => {
    if (!undoId) return;
    try {
      const res = await fetch('/api/admin/bulk-undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undoId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Undone: ${data.restoredCount} assets restored`, 'success');
        setUndoId(null);
        setUndoCountdown(0);
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        loadAssets();
      } else {
        showToast(data.error || 'Undo failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const handleCheckbox = (assetId: string, index: number, e: React.MouseEvent) => {
    const newSelected = new Set(selectedIds);

    if (e.shiftKey && lastClickedIndex !== null) {
      // Shift+click: range selection
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        if (assets[i]) newSelected.add(assets[i].id);
      }
    } else {
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId);
      } else {
        newSelected.add(assetId);
      }
    }

    setSelectedIds(newSelected);
    setLastClickedIndex(index);
    setSelectAllResults(false);
  };

  const handleSelectAllPage = () => {
    const allIds = new Set(assets.map((a) => a.id));
    setSelectedIds(allIds);
    setSelectAllResults(false);
  };

  const handleSelectAllResults = () => {
    const allIds = new Set(assets.map((a) => a.id));
    setSelectedIds(allIds);
    setSelectAllResults(true);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllResults(false);
    setLastClickedIndex(null);
  };

  const handleStatusChange = async (assetId: string, newStatus: string) => {
    if (!user) return;
    const ok = await updateAssetStatus(assetId, newStatus, user.id);
    if (ok) {
      showToast(`Status updated to ${newStatus}`, 'success');
      loadAssets();
    } else {
      showToast('Failed to update status', 'error');
    }
  };

  // Review mode handlers
  const handleReviewApprove = async (assetId: string) => {
    if (!user) return;
    await updateAssetStatus(assetId, 'approved', user.id, 'Review mode approval');
  };

  const handleReviewReject = async (assetId: string) => {
    if (!user) return;
    await updateAssetStatus(assetId, 'rejected', user.id, 'Review mode rejection');
  };

  const handleReviewNext = () => {
    setReviewIndex((i) => {
      const totalPages = Math.ceil(total / pageSize);
      if (i + 1 >= assets.length) {
        // Load next page
        if (page < totalPages) {
          setPage((p) => p + 1);
          return 0;
        }
        return i;
      }
      return i + 1;
    });
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = ['administrator', 'super_admin'].includes(profile.role);
  const isSuperAdmin = profile.role === 'super_admin';
  const totalSelected = selectAllResults ? total : selectedIds.size;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* Review Mode */}
      {reviewModeActive && (
        <ReviewMode
          assets={assets}
          currentIndex={reviewIndex}
          onApprove={handleReviewApprove}
          onReject={handleReviewReject}
          onNext={handleReviewNext}
          onClose={() => { setReviewModeActive(false); setReviewIndex(0); loadAssets(); }}
          totalCount={assets.length}
        />
      )}

      {/* Bulk History */}
      {showHistory && <BulkHistoryLog onClose={() => setShowHistory(false)} />}

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-32">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to admin
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Assets</h1>
            <p className="text-sm text-muted-foreground">{total} total assets</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => { setReviewModeActive(true); setReviewIndex(0); }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-secondary text-white hover:bg-secondary/90 transition-colors"
              >
                <Zap size={13} />
                Review Mode
              </button>
            )}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors"
            >
              <History size={13} />
              Bulk History
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(searchInput); setPage(1); } }}
                placeholder="Search assets…"
                className="input-base pl-9 w-full"
              />
            </div>

            {/* Review Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input-base w-auto"
            >
              <option value="">All statuses</option>
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {/* Demo filter */}
            <select
              value={demoFilter}
              onChange={(e) => { setDemoFilter(e.target.value as 'all' | 'real' | 'demo'); setPage(1); }}
              className="input-base w-auto"
            >
              <option value="all">All (real + demo)</option>
              <option value="real">Real only</option>
              <option value="demo">Demo only</option>
            </select>

            <button
              onClick={() => { setQuery(searchInput); setPage(1); }}
              className="btn-outline flex items-center gap-1.5"
            >
              <Filter size={14} />
              Apply
            </button>

            {/* Clear filters */}
            {(statusFilter || query || demoFilter !== 'all') && (
              <button
                onClick={() => { setStatusFilter(''); setQuery(''); setSearchInput(''); setDemoFilter('all'); setPage(1); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Selection controls */}
        {isAdmin && (
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button
              onClick={handleSelectAllPage}
              className="text-xs text-secondary hover:underline font-medium"
            >
              Select All ({assets.length} on page)
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={handleSelectAllResults}
              className="text-xs text-secondary hover:underline font-medium"
            >
              Select All Results ({total})
            </button>
            {selectedIds.size > 0 && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear Selection
                </button>
              </>
            )}
            {totalSelected > 0 && (
              <span className="ml-auto text-xs font-bold text-foreground bg-secondary/10 text-secondary px-2.5 py-1 rounded-full">
                {totalSelected} asset{totalSelected !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={assets.length > 0 && assets.every((a) => selectedIds.has(a.id))}
                        onChange={(e) => e.target.checked ? handleSelectAllPage() : handleClearSelection()}
                        className="rounded border-border"
                        title="Select all on page"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Species</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Demo</th>
                  {isAdmin && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-border">
                      {isAdmin && <td className="px-4 py-3 w-10"><div className="h-4 w-4 bg-muted rounded animate-pulse" /></td>}
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/3" /></td>
                      <td className="px-4 py-3"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-8" /></td>
                    </tr>
                  ))
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset, index) => {
                    const isSelected = selectedIds.has(asset.id);
                    return (
                      <tr
                        key={asset.id}
                        className={`border-b border-border transition-colors ${
                          isSelected ? 'bg-secondary/5 hover:bg-secondary/10' : 'hover:bg-muted/30'
                        }`}
                      >
                        {isAdmin && (
                          <td className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => handleCheckbox(asset.id, index, e)}
                              className="rounded border-border cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Link
                            href={`/asset-detail?slug=${asset.slug}`}
                            className="font-medium text-foreground hover:text-secondary transition-colors line-clamp-1"
                          >
                            {asset.title}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{asset.public_asset_id || asset.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                          {asset.species?.common_name || '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{asset.category || '—'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs capitalize">{asset.media_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[asset.review_status] || 'bg-gray-100 text-gray-600'}`}>
                            {asset.review_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${asset.is_demo ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {asset.is_demo ? 'Demo' : 'Real'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <select
                              value={asset.review_status}
                              onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                              className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              {REVIEW_STATUSES.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(total / pageSize)} · {total} total
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))}
                disabled={page === Math.ceil(total / pageSize) || total === 0}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Next
              </button>
              <button
                onClick={() => setPage(Math.ceil(total / pageSize))}
                disabled={page === Math.ceil(total / pageSize) || total === 0}
                className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        {isAdmin && selectedIds.size === 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Ctrl+A = Select all · Shift+click = Range select · A = Approve · R = Reject · P = Promote · U = Under Review
          </p>
        )}
      </main>

      {/* Bulk Action Bar */}
      {isAdmin && (
        <BulkActionBar
          selectedIds={Array.from(selectedIds)}
          totalSelected={totalSelected}
          isSuperAdmin={isSuperAdmin}
          onAction={handleBulkAction}
          onUndo={handleUndo}
          undoId={undoId}
          undoCountdown={undoCountdown}
          onClearSelection={handleClearSelection}
        />
      )}

      <Footer />
    </div>
  );
}
