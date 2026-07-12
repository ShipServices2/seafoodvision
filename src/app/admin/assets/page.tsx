'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminAssets, updateAssetStatus } from '@/lib/supabase/queries';
import type { Asset } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const REVIEW_STATUSES = [
  'draft', 'imported', 'under_review', 'approved', 'preview_only',
  'editorial', 'commercial', 'restricted', 'rejected', 'archived',
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

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assets');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  const loadAssets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const { assets: rows, total: t } = await fetchAdminAssets(page, 20, statusFilter || undefined, query || undefined);
    setAssets(rows);
    setTotal(t);
    setFetching(false);
  }, [page, statusFilter, query, profile]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleStatusChange = async (assetId: string, newStatus: string) => {
    if (!user) return;
    const ok = await updateAssetStatus(assetId, newStatus, user.id);
    if (ok) {
      toast.success(`Status updated to ${newStatus}`);
      loadAssets();
    } else {
      toast.error('Failed to update status');
    }
  };

  if (loading || !user || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
    </div>;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-background">
      <Header />
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
                  {['administrator', 'super_admin'].includes(profile.role) && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change Status</th>
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
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                        {asset.is_demo ? 'Yes' : 'No'}
                      </td>
                      {['administrator', 'super_admin'].includes(profile.role) && (
                        <td className="px-4 py-3">
                          <select
                            value={asset.review_status}
                            onChange={(e) => handleStatusChange(asset.id, e.target.value)}
                            className="text-xs border border-border rounded-lg px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {REVIEW_STATUSES.map((s) => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
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
