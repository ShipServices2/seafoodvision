'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminAssets, updateAssetStatus } from '@/lib/supabase/queries';
import type { Asset } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const REVIEW_STATUSES = [
  'draft', 'imported', 'under_review', 'approved', 'preview_only',
  'editorial', 'commercial', 'restricted', 'rejected', 'archived',
];

// Promotion targets — only these are allowed via the promote button
const PROMOTION_TARGETS = [
  { value: 'approved', label: 'Approved', description: 'Approved for preview display', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'preview_only', label: 'Preview Only', description: 'Visible as watermarked preview', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'editorial', label: 'Editorial', description: 'Available for editorial use', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'commercial', label: 'Commercial', description: 'Available for commercial licensing', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'under_review', label: 'Under Review', description: 'Return to review queue', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'rejected', label: 'Rejected', description: 'Reject this asset', color: 'bg-red-100 text-red-700 border-red-200' },
];

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

interface PromoteModalProps {
  asset: Asset;
  onClose: () => void;
  onPromote: (assetId: string, newStatus: string, reason: string) => Promise<void>;
}

function PromoteModal({ asset, onClose, onPromote }: PromoteModalProps) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePromote = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    await onPromote(asset.id, selectedStatus, reason);
    setSuccess(true);
    setLoading(false);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Promote Asset Status</h2>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{asset.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Current:</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[asset.review_status] || 'bg-gray-100 text-gray-600'}`}>
              {asset.review_status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 size={20} />
              <span className="font-medium">Status updated successfully</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                  Promote to
                </label>
                <div className="space-y-2">
                  {PROMOTION_TARGETS.map((target) => (
                    <label
                      key={target.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedStatus === target.value
                          ? `${target.color} border-current`
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={target.value}
                        checked={selectedStatus === target.value}
                        onChange={() => setSelectedStatus(target.value)}
                        className="mt-0.5 shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{target.label}</p>
                        <p className="text-xs text-muted-foreground">{target.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Add a note for the audit log…"
                  rows={2}
                  className="input-base w-full text-sm resize-none"
                />
              </div>

              {selectedStatus === 'commercial' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Setting to <strong>commercial</strong> makes this asset available for licensing. Ensure rights have been verified.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!success && (
          <div className="p-6 border-t border-border flex gap-3">
            <button onClick={onClose} className="btn-outline flex-1 justify-center">
              Cancel
            </button>
            <button
              onClick={handlePromote}
              disabled={!selectedStatus || loading}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Confirm Promotion'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminAssetsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [demoFilter, setDemoFilter] = useState<'all' | 'real' | 'demo'>('all');
  const [promoteAsset, setPromoteAsset] = useState<Asset | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assets');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAssets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const { assets: rows, total: t } = await fetchAdminAssets(page, 20, statusFilter || undefined, query || undefined);
    // Apply demo filter client-side
    const filtered = demoFilter === 'all' ? rows :
      demoFilter === 'real' ? rows.filter(a => !a.is_demo) :
      rows.filter(a => a.is_demo);
    setAssets(filtered);
    setTotal(t);
    setFetching(false);
  }, [page, statusFilter, query, profile, demoFilter]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

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

  const handlePromote = async (assetId: string, newStatus: string, reason: string) => {
    if (!user) return;
    const ok = await updateAssetStatus(assetId, newStatus, user.id, reason);
    if (ok) {
      showToast(`Asset promoted to ${newStatus}`, 'success');
      loadAssets();
    } else {
      showToast('Failed to promote asset', 'error');
    }
  };

  if (loading || !user || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
    </div>;
  }

  const totalPages = Math.ceil(total / 20);
  const isAdmin = ['administrator', 'super_admin'].includes(profile.role);

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

      {/* Promote modal */}
      {promoteAsset && (
        <PromoteModal
          asset={promoteAsset}
          onClose={() => setPromoteAsset(null)}
          onPromote={handlePromote}
        />
      )}

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Assets</h1>
            <p className="text-sm text-muted-foreground">{total} total assets</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
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
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-base w-auto"
          >
            <option value="">All statuses</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={demoFilter}
            onChange={(e) => { setDemoFilter(e.target.value as 'all' | 'real' | 'demo'); setPage(1); }}
            className="input-base w-auto"
          >
            <option value="all">All (real + demo)</option>
            <option value="real">Real only</option>
            <option value="demo">Demo only</option>
          </select>
          <button onClick={() => { setQuery(searchInput); setPage(1); }} className="btn-outline">
            <Filter size={14} />
            Apply
          </button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Category</th>
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
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/3" /></td>
                      <td className="px-4 py-3"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-8" /></td>
                    </tr>
                  ))
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/asset-detail?slug=${asset.slug}`}
                          className="font-medium text-foreground hover:text-secondary transition-colors line-clamp-1"
                        >
                          {asset.title}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono-data mt-0.5">{asset.public_asset_id || asset.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{asset.category || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground capitalize">{asset.media_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[asset.review_status] || 'bg-gray-100 text-gray-600'}`}>
                          {asset.review_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${asset.is_demo ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {asset.is_demo ? 'Demo' : 'Real'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPromoteAsset(asset)}
                              className="text-xs bg-secondary/10 text-secondary border border-secondary/20 px-2.5 py-1 rounded-lg hover:bg-secondary/20 transition-colors font-medium"
                            >
                              Promote
                            </button>
                            <select
                              value={asset.review_status}
                              onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                              className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              {REVIEW_STATUSES.map((s) => (
                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Next
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
