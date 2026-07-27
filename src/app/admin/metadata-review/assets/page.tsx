'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Search, CircleCheck as CheckCircle2, Circle as XCircle, Circle as HelpCircle, RotateCcw, Loader as Loader2, RefreshCw, Eye, Star, Fish, Zap } from 'lucide-react';

interface ReviewAsset {
  id: string;
  slug: string;
  title: string;
  review_status: string;
  is_real_photo: boolean;
  created_at: string;
  species?: { common_name: string; scientific_name: string; family?: string } | null;
  preview_url?: string;
  metadata_review?: {
    review_status: string;
    quality_score: number;
    confidence_score: number;
  } | null;
  suggestions_count?: number;
}

const BULK_ACTIONS = [
  { value: 'approve_metadata', label: 'Approve Metadata' },
  { value: 'reject_metadata', label: 'Reject Metadata' },
  { value: 'mark_unknown', label: 'Mark Unknown' },
  { value: 'assign_species', label: 'Assign Species' },
  { value: 'assign_category', label: 'Assign Category' },
  { value: 'assign_product_form', label: 'Assign Product Form' },
  { value: 'assign_packaging', label: 'Assign Packaging' },
  { value: 'assign_fao_area', label: 'Assign FAO Area' },
  { value: 'assign_country', label: 'Assign Country' },
  { value: 'merge_keywords', label: 'Merge Keywords' },
  { value: 'delete_keywords', label: 'Delete Keywords' },
  { value: 'replace_keywords', label: 'Replace Keywords' },
  { value: 'merge_synonyms', label: 'Merge Synonyms' },
  { value: 'replace_scientific_name', label: 'Replace Scientific Name' },
  { value: 'replace_common_name', label: 'Replace Common Name' },
  // Phase 7.16 additional bulk actions
  { value: 'approve_enrichment', label: 'Approve Enrichment (7.16)' },
  { value: 'reject_enrichment', label: 'Reject Enrichment (7.16)' },
  { value: 'assign_commercial_category', label: 'Assign Commercial Category' },
  { value: 'undo_enrichment', label: 'Undo Enrichment Import' },
];

const BATCH_SIZES = [50, 100, 250, 500];

const STATUS_COLORS: Record<string, string> = {
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suggested: 'bg-gray-100 text-gray-600',
  published: 'bg-indigo-100 text-indigo-700',
};

export default function AssetReviewPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<ReviewAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkParam, setBulkParam] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [lastBulkActionId, setLastBulkActionId] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<ReviewAsset | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/assets');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  const loadAssets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    setFetching(true);
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('assets')
      .select(`
        id, slug, title, review_status, is_real_photo, created_at,
        species!fk_assets_species(common_name, scientific_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);
    if (statusFilter) query = query.eq('review_status', statusFilter);

    const { data, count } = await query;
    setTotal(count ?? 0);

    if (!data) { setFetching(false); return; }

    // Fetch metadata reviews for these assets
    const assetIds = data.map((a) => a.id);
    const { data: reviews } = await supabase
      .from('asset_metadata_reviews')
      .select('asset_id, review_status, quality_score, confidence_score')
      .in('asset_id', assetIds);

    const { data: suggCounts } = await supabase
      .from('metadata_suggestions')
      .select('asset_id')
      .in('asset_id', assetIds)
      .eq('status', 'under_review');

    const reviewMap = new Map((reviews ?? []).map((r) => [r.asset_id, r]));
    const suggMap = new Map<string, number>();
    (suggCounts ?? []).forEach((s) => {
      suggMap.set(s.asset_id, (suggMap.get(s.asset_id) ?? 0) + 1);
    });

    const enriched: ReviewAsset[] = data.map((a) => ({
      ...a,
      species: Array.isArray(a.species) ? a.species[0] ?? null : (a.species as ReviewAsset['species']),
      metadata_review: reviewMap.get(a.id) ?? null,
      suggestions_count: suggMap.get(a.id) ?? 0,
    }));

    setAssets(enriched);
    setFetching(false);
  }, [profile, page, pageSize, search, statusFilter]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const executeBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setProcessing(true);
    setShowConfirm(false);
    const supabase = createClient();
    const ids = Array.from(selectedIds);

    try {
      // Save bulk action for undo
      const { data: actionRow } = await supabase
        .from('metadata_bulk_actions')
        .insert({
          action_type: bulkAction,
          asset_ids: ids,
          parameters: { param: bulkParam },
          performed_by: user?.id,
        })
        .select('id')
        .single();

      if (actionRow) setLastBulkActionId(actionRow.id);

      // Apply action
      if (bulkAction === 'approve_metadata') {
        await supabase
          .from('metadata_suggestions')
          .update({ status: 'approved', reviewer_id: user?.id, reviewed_at: new Date().toISOString() })
          .in('asset_id', ids)
          .eq('status', 'under_review');

        // Upsert review records
        for (const assetId of ids) {
          await supabase.from('asset_metadata_reviews').upsert({
            asset_id: assetId,
            review_status: 'approved',
            reviewer_id: user?.id,
            reviewed_at: new Date().toISOString(),
          }, { onConflict: 'asset_id' });
        }
      } else if (bulkAction === 'reject_metadata') {
        await supabase
          .from('metadata_suggestions')
          .update({ status: 'rejected', reviewer_id: user?.id, reviewed_at: new Date().toISOString() })
          .in('asset_id', ids)
          .eq('status', 'under_review');
      } else if (bulkAction === 'mark_unknown') {
        for (const assetId of ids) {
          await supabase.from('asset_metadata_reviews').upsert({
            asset_id: assetId,
            review_status: 'under_review',
            notes: 'Marked as unknown by reviewer',
            reviewer_id: user?.id,
          }, { onConflict: 'asset_id' });
        }
      } else if (bulkAction === 'approve_enrichment') {
        // Phase 7.16: approve enrichment records
        await supabase
          .from('metadata_enrichment_records')
          .update({ review_status: 'approved', validation_status: 'approved' })
          .in('asset_id', ids)
          .eq('review_status', 'under_review');
        await supabase
          .from('metadata_suggestions')
          .update({ status: 'approved', reviewer_id: user?.id, reviewed_at: new Date().toISOString() })
          .in('asset_id', ids)
          .eq('status', 'under_review');
        for (const assetId of ids) {
          await supabase.from('asset_metadata_reviews').upsert({
            asset_id: assetId,
            review_status: 'approved',
            reviewer_id: user?.id,
            reviewed_at: new Date().toISOString(),
          }, { onConflict: 'asset_id' });
        }
      } else if (bulkAction === 'reject_enrichment') {
        // Phase 7.16: reject enrichment records
        await supabase
          .from('metadata_enrichment_records')
          .update({ review_status: 'rejected', validation_status: 'rejected' })
          .in('asset_id', ids)
          .eq('review_status', 'under_review');
        await supabase
          .from('metadata_suggestions')
          .update({ status: 'rejected', reviewer_id: user?.id, reviewed_at: new Date().toISOString() })
          .in('asset_id', ids)
          .eq('status', 'under_review');
      } else if (bulkAction === 'assign_commercial_category') {
        // Phase 7.16: assign commercial category candidate
        if (bulkParam) {
          await supabase
            .from('metadata_enrichment_records')
            .update({ commercial_category_candidate: bulkParam })
            .in('asset_id', ids);
        }
      } else if (bulkAction === 'undo_enrichment') {
        // Phase 7.16: revert enrichment records back to under_review
        await supabase
          .from('metadata_enrichment_records')
          .update({ review_status: 'under_review', validation_status: 'suggested' })
          .in('asset_id', ids);
        await supabase
          .from('metadata_suggestions')
          .update({ status: 'under_review', reviewer_id: null, reviewed_at: null })
          .in('asset_id', ids);
      }

      // Log to history
      await supabase.from('metadata_history').insert(
        ids.map((assetId) => ({
          entity_type: 'asset',
          entity_id: assetId,
          action: 'bulk_action',
          new_value: bulkAction,
          performed_by: user?.id,
          reason: bulkParam || bulkAction,
          source: 'manual',
          batch_id: actionRow?.id,
        }))
      );

      showToast(`Bulk action "${bulkAction}" applied to ${ids.length} assets.`, 'success');
      setSelectedIds(new Set());
      setBulkAction('');
      setBulkParam('');

      // Start undo countdown
      setUndoCountdown(10);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      undoTimerRef.current = setInterval(() => {
        setUndoCountdown((c) => {
          if (c <= 1) {
            clearInterval(undoTimerRef.current!);
            setLastBulkActionId(null);
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      loadAssets();
    } catch {
      showToast('Bulk action failed. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const undoBulkAction = async () => {
    if (!lastBulkActionId) return;
    const supabase = createClient();
    await supabase
      .from('metadata_bulk_actions')
      .update({ is_undone: true, undone_at: new Date().toISOString(), undone_by: user?.id })
      .eq('id', lastBulkActionId);
    setLastBulkActionId(null);
    setUndoCountdown(0);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    showToast('Bulk action undone.', 'success');
    loadAssets();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <span>/</span>
            <Link href="/admin/metadata-review" className="hover:text-gray-700">Metadata Review</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Asset Review</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Asset Review</h1>
                <p className="text-xs text-gray-500">{total} assets · {selectedIds.size} selected</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              >
                {BATCH_SIZES.map((s) => <option key={s} value={s}>{s} per page</option>)}
              </select>
              <button onClick={loadAssets} className="p-2 rounded-lg hover:bg-gray-100">
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                placeholder="Search assets…"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All statuses</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="imported">Imported</option>
            </select>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Choose action…</option>
                {BULK_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {['assign_species', 'assign_category', 'assign_product_form', 'assign_packaging',
                'assign_fao_area', 'assign_country', 'replace_scientific_name', 'replace_common_name',
                'replace_keywords'].includes(bulkAction) && (
                <input
                  type="text"
                  value={bulkParam}
                  onChange={(e) => setBulkParam(e.target.value)}
                  placeholder="Enter value…"
                  className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
              )}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!bulkAction || processing}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-sm text-blue-600 hover:underline">
                Clear
              </button>
            </div>
          )}

          {/* Undo bar */}
          {undoCountdown > 0 && lastBulkActionId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-800">Action applied. Undo available for {undoCountdown}s</span>
              <button
                onClick={undoBulkAction}
                className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Undo
              </button>
            </div>
          )}

          {/* Confirm Modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Bulk Action</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Apply <strong>{bulkAction}</strong> to <strong>{selectedIds.size}</strong> assets?
                  {bulkParam && <span> Value: <strong>{bulkParam}</strong></span>}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={executeBulkAction}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Asset Detail Panel */}
          {selectedAsset && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg h-full max-h-screen overflow-y-auto shadow-2xl">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Asset Review Card</h3>
                  <button onClick={() => setSelectedAsset(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">{selectedAsset.title}</h4>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedAsset.review_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {selectedAsset.review_status}
                    </span>
                  </div>

                  {selectedAsset.species && (
                    <div className="bg-teal-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-teal-700 font-medium text-sm">
                        <Fish className="w-4 h-4" /> Species
                      </div>
                      <div className="text-sm text-gray-800">{selectedAsset.species.common_name}</div>
                      <div className="text-xs text-gray-500 italic">{selectedAsset.species.scientific_name}</div>
                      {selectedAsset.species.family && (
                        <div className="text-xs text-gray-500">Family: {selectedAsset.species.family}</div>
                      )}
                    </div>
                  )}

                  {selectedAsset.metadata_review && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                        <Star className="w-4 h-4 text-amber-500" /> Quality Score
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">
                            {Math.round(selectedAsset.metadata_review.quality_score)}
                          </div>
                          <div className="text-xs text-gray-500">Quality</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">
                            {Math.round(selectedAsset.metadata_review.confidence_score * 100)}%
                          </div>
                          <div className="text-xs text-gray-500">AI Confidence</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    {selectedAsset.suggestions_count ?? 0} pending suggestions
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from('asset_metadata_reviews').upsert({
                          asset_id: selectedAsset.id,
                          review_status: 'approved',
                          reviewer_id: user?.id,
                          reviewed_at: new Date().toISOString(),
                        }, { onConflict: 'asset_id' });
                        showToast('Metadata approved.', 'success');
                        setSelectedAsset(null);
                        loadAssets();
                      }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from('asset_metadata_reviews').upsert({
                          asset_id: selectedAsset.id,
                          review_status: 'rejected',
                          reviewer_id: user?.id,
                          reviewed_at: new Date().toISOString(),
                        }, { onConflict: 'asset_id' });
                        showToast('Metadata rejected.', 'success');
                        setSelectedAsset(null);
                        loadAssets();
                      }}
                      className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selectedIds.size === assets.length && assets.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Species</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Suggestions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No assets found.</td>
                  </tr>
                ) : assets.map((asset) => (
                  <tr key={asset.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedIds.has(asset.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(asset.id)} onChange={() => toggleSelect(asset.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm truncate max-w-48">{asset.title}</div>
                      <div className="text-xs text-gray-400 font-mono">{asset.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      {asset.species ? (
                        <div>
                          <div className="text-xs font-medium text-gray-700">{asset.species.common_name}</div>
                          <div className="text-xs text-gray-400 italic">{asset.species.scientific_name}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[asset.metadata_review?.review_status ?? asset.review_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {asset.metadata_review?.review_status ?? asset.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(asset.suggestions_count ?? 0) > 0 ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          {asset.suggestions_count} pending
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {asset.metadata_review?.confidence_score != null ? (
                        <span className="text-xs font-medium text-blue-600">
                          {Math.round(asset.metadata_review.confidence_score * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedAsset(asset)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <Footer />
    </div>
  );
}
