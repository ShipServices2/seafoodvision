'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Search, CircleCheck as CheckCircle2, Circle as XCircle, GitMerge, Plus, Loader as Loader2, RefreshCw, TriangleAlert as AlertTriangle, Hash } from 'lucide-react';

interface Keyword {
  id: string;
  term: string;
  normalized_term: string;
  language: string;
  status: string;
  source: string;
  frequency: number;
  merged_into: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  merged: 'bg-blue-100 text-blue-700',
};

export default function KeywordCenterPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKw, setNewKw] = useState({ term: '', language: 'en' });
  const [creating, setCreating] = useState(false);
  const [duplicates, setDuplicates] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/keywords');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  const loadKeywords = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('metadata_keywords')
      .select('*', { count: 'exact' })
      .order('frequency', { ascending: false })
      .limit(300);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, count } = await query;
    setTotal(count ?? 0);
    if (!data) { setFetching(false); return; }

    let filtered = data as Keyword[];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((k) => k.term.toLowerCase().includes(q) || k.normalized_term.toLowerCase().includes(q));
    }

    // Detect duplicates (same normalized_term)
    const normMap = new Map<string, string[]>();
    filtered.forEach((k) => {
      const arr = normMap.get(k.normalized_term) ?? [];
      arr.push(k.id);
      normMap.set(k.normalized_term, arr);
    });
    const dups: string[] = [];
    normMap.forEach((ids) => { if (ids.length > 1) dups.push(...ids); });
    setDuplicates(dups);

    setKeywords(filtered);
    setFetching(false);
  }, [profile, search, statusFilter]);

  useEffect(() => { loadKeywords(); }, [loadKeywords]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('metadata_keywords')
      .update({ status, validated_by: user?.id, validated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(`Keyword ${status}.`, 'success');
    loadKeywords();
  };

  const deleteKeyword = async (id: string) => {
    const supabase = createClient();
    await supabase.from('metadata_keywords').delete().eq('id', id);
    showToast('Keyword deleted.', 'success');
    loadKeywords();
  };

  const createKeyword = async () => {
    if (!newKw.term.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const normalized = newKw.term.toLowerCase().trim().replace(/\s+/g, ' ');
    const { error } = await supabase.from('metadata_keywords').insert({
      term: newKw.term.trim(),
      normalized_term: normalized,
      language: newKw.language,
      status: 'pending',
      source: 'manual',
    });
    if (error) { showToast('Failed: ' + error.message, 'error'); setCreating(false); return; }
    showToast('Keyword created.', 'success');
    setShowCreate(false);
    setNewKw({ term: '', language: 'en' });
    setCreating(false);
    loadKeywords();
  };

  const duplicateCount = new Set(duplicates).size;

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
            <span className="text-gray-800 font-medium">Keyword Center</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Keyword Center</h1>
                <p className="text-xs text-gray-500">{total} keywords · {duplicateCount} potential duplicates detected</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {duplicateCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {duplicateCount} duplicates
                </span>
              )}
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-rose-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-rose-600"
              >
                <Plus className="w-4 h-4" /> Add Keyword
              </button>
              <button onClick={loadKeywords} className="p-2 rounded-lg hover:bg-gray-100">
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
                placeholder="Search keywords…"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="validated">Validated</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
            </select>
          </div>

          {/* Create Modal */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Add Keyword</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Term *</label>
                    <input type="text" value={newKw.term} onChange={(e) => setNewKw((p) => ({ ...p, term: e.target.value }))}
                      placeholder="e.g. fresh salmon" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                    <select value={newKw.language} onChange={(e) => setNewKw((p) => ({ ...p, language: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {['en', 'fr', 'es', 'pt', 'de', 'it', 'zh', 'ja'].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={createKeyword} disabled={creating || !newKw.term.trim()}
                    className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Term</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Normalized</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Language</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
                ) : keywords.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No keywords found.</td></tr>
                ) : keywords.map((k) => (
                  <tr key={k.id} className={`border-b border-gray-50 hover:bg-gray-50 ${duplicates.includes(k.id) ? 'bg-orange-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{k.term}</span>
                        {duplicates.includes(k.id) && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">dup</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{k.normalized_term}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{k.language}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Hash className="w-3 h-3" /> {k.frequency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[k.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{k.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {k.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(k.id, 'validated')} className="p-1.5 rounded bg-green-50 hover:bg-green-100 text-green-600" title="Validate">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateStatus(k.id, 'rejected')} className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-500" title="Reject">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateStatus(k.id, 'merged')} className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600" title="Merge">
                              <GitMerge className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteKeyword(k.id)} className="p-1.5 rounded bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
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
