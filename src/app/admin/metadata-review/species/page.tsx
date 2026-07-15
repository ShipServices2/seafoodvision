'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Search, CheckCircle2, XCircle, GitMerge, Plus, Loader2, RefreshCw } from 'lucide-react';

interface SpeciesReview {
  id: string;
  species_id: string;
  review_status: string;
  proposed_common_name: string | null;
  proposed_scientific_name: string | null;
  proposed_family: string | null;
  confidence_score: number;
  source: string;
  created_at: string;
  species?: { common_name: string; scientific_name: string; family?: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  under_review: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suggested: 'bg-gray-100 text-gray-600',
  merged: 'bg-blue-100 text-blue-700',
  conflicted: 'bg-orange-100 text-orange-700',
};

export default function SpeciesReviewPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<SpeciesReview[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSpecies, setNewSpecies] = useState({ common_name: '', scientific_name: '', family: '', genus: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/species');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  const loadReviews = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('species_reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter) query = query.eq('review_status', statusFilter);

    const { data, count } = await query;
    setTotal(count ?? 0);

    if (!data) { setFetching(false); return; }

    // Enrich with species data
    const speciesIds = data.map((r) => r.species_id).filter(Boolean);
    const { data: speciesData } = await supabase
      .from('species')
      .select('id, common_name, scientific_name, family')
      .in('id', speciesIds);

    const speciesMap = new Map((speciesData ?? []).map((s) => [s.id, s]));
    const enriched = data.map((r) => ({
      ...r,
      species: speciesMap.get(r.species_id) ?? null,
    }));

    let filtered = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = enriched.filter((r) =>
        r.proposed_common_name?.toLowerCase().includes(q) ||
        r.proposed_scientific_name?.toLowerCase().includes(q) ||
        r.species?.common_name?.toLowerCase().includes(q)
      );
    }

    setReviews(filtered);
    setFetching(false);
  }, [profile, search, statusFilter]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateStatus = async (reviewId: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('species_reviews')
      .update({ review_status: status, reviewer_id: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', reviewId);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(`Species review ${status}.`, 'success');
    loadReviews();
  };

  const createSpecies = async () => {
    if (!newSpecies.scientific_name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data: sp, error: spErr } = await supabase
      .from('species')
      .insert({
        common_name: newSpecies.common_name,
        scientific_name: newSpecies.scientific_name,
        family: newSpecies.family || null,
        genus: newSpecies.genus || null,
      })
      .select('id')
      .single();

    if (spErr) { showToast('Failed to create species: ' + spErr.message, 'error'); setCreating(false); return; }

    // Create a review record
    await supabase.from('species_reviews').insert({
      species_id: sp.id,
      review_status: 'under_review',
      proposed_common_name: newSpecies.common_name,
      proposed_scientific_name: newSpecies.scientific_name,
      proposed_family: newSpecies.family || null,
      source: 'manual',
      confidence_score: 1.0,
    });

    await supabase.from('metadata_history').insert({
      entity_type: 'species',
      entity_id: sp.id,
      action: 'created',
      new_value: newSpecies.scientific_name,
      performed_by: user?.id,
      source: 'manual',
    });

    showToast('Species created and placed under review.', 'success');
    setShowCreate(false);
    setNewSpecies({ common_name: '', scientific_name: '', family: '', genus: '' });
    setCreating(false);
    loadReviews();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <span>/</span>
            <Link href="/admin/metadata-review" className="hover:text-gray-700">Metadata Review</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Species Review Center</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Species Review Center</h1>
                <p className="text-xs text-gray-500">{total} reviews · No species becomes validated without human approval</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
              >
                <Plus className="w-4 h-4" /> New Species
              </button>
              <button onClick={loadReviews} className="p-2 rounded-lg hover:bg-gray-100">
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search species…"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All statuses</option>
              <option value="under_review">Under Review</option>
              <option value="validated">Validated</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
              <option value="conflicted">Conflicted</option>
            </select>
          </div>

          {/* Create Species Modal */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Create New Species</h3>
                <div className="space-y-3">
                  {[
                    { key: 'common_name', label: 'Common Name', placeholder: 'e.g. Atlantic Salmon' },
                    { key: 'scientific_name', label: 'Scientific Name *', placeholder: 'e.g. Salmo salar' },
                    { key: 'family', label: 'Family', placeholder: 'e.g. Salmonidae' },
                    { key: 'genus', label: 'Genus', placeholder: 'e.g. Salmo' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                      <input
                        type="text"
                        value={newSpecies[f.key as keyof typeof newSpecies]}
                        onChange={(e) => setNewSpecies((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={createSpecies}
                    disabled={creating || !newSpecies.scientific_name.trim()}
                    className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Species</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Proposed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
                ) : reviews.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No species reviews found.</td></tr>
                ) : reviews.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{r.species?.common_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 italic">{r.species?.scientific_name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.proposed_common_name && (
                        <div className="text-xs text-blue-700 font-medium">{r.proposed_common_name}</div>
                      )}
                      {r.proposed_scientific_name && (
                        <div className="text-xs text-gray-500 italic">{r.proposed_scientific_name}</div>
                      )}
                      {r.proposed_family && (
                        <div className="text-xs text-gray-400">Family: {r.proposed_family}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.review_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-blue-600">{Math.round(r.confidence_score * 100)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 capitalize">{r.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.review_status === 'under_review' && (
                          <>
                            <button
                              onClick={() => updateStatus(r.id, 'validated')}
                              className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600"
                              title="Validate"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => updateStatus(r.id, 'rejected')}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"
                              title="Reject"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => updateStatus(r.id, 'merged')}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"
                              title="Merge"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

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
