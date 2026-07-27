'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Search, CheckCircle2, XCircle, GitMerge,
  Plus, Loader2, RefreshCw, Globe, Hash
} from 'lucide-react';

interface Synonym {
  id: string;
  name: string;
  language: string;
  synonym_type: string;
  frequency: number;
  status: string;
  source: string;
  species?: { common_name: string; scientific_name: string } | null;
  species_id: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suggested: 'bg-gray-100 text-gray-600',
  merged: 'bg-blue-100 text-blue-700',
};

const TYPE_COLORS: Record<string, string> = {
  common_name: 'bg-teal-50 text-teal-700',
  trade_name: 'bg-violet-50 text-violet-700',
  local_name: 'bg-amber-50 text-amber-700',
  scientific_synonym: 'bg-blue-50 text-blue-700',
  abbreviation: 'bg-gray-50 text-gray-600',
  alias: 'bg-rose-50 text-rose-700',
};

export default function SynonymCenterPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSyn, setNewSyn] = useState({ name: '', language: 'en', synonym_type: 'common_name', species_id: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/synonyms');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  const loadSynonyms = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    setFetching(true);
    const supabase = createClient();
    let query = supabase
      .from('metadata_synonyms')
      .select('*', { count: 'exact' })
      .order('frequency', { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (langFilter) query = query.eq('language', langFilter);

    const { data, count } = await query;
    setTotal(count ?? 0);
    if (!data) { setFetching(false); return; }

    // Enrich with species
    const speciesIds = [...new Set(data.map((s) => s.species_id).filter(Boolean))];
    let speciesMap = new Map<string, { common_name: string; scientific_name: string }>();
    if (speciesIds.length > 0) {
      const { data: sp } = await supabase
        .from('species')
        .select('id, common_name, scientific_name')
        .in('id', speciesIds);
      speciesMap = new Map((sp ?? []).map((s) => [s.id, s]));
    }

    let enriched = data.map((s) => ({
      ...s,
      species: s.species_id ? speciesMap.get(s.species_id) ?? null : null,
    }));

    if (search.trim()) {
      const q = search.toLowerCase();
      enriched = enriched.filter((s) => s.name.toLowerCase().includes(q));
    }

    setSynonyms(enriched);
    setFetching(false);
  }, [profile, search, statusFilter, langFilter]);

  useEffect(() => { loadSynonyms(); }, [loadSynonyms]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('metadata_synonyms')
      .update({ status, validated_by: user?.id, validated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(`Synonym ${status}.`, 'success');
    loadSynonyms();
  };

  const deleteSynonym = async (id: string) => {
    const supabase = createClient();
    await supabase.from('metadata_synonyms').delete().eq('id', id);
    showToast('Synonym deleted.', 'success');
    loadSynonyms();
  };

  const createSynonym = async () => {
    if (!newSyn.name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { error } = await supabase.from('metadata_synonyms').insert({
      name: newSyn.name,
      language: newSyn.language,
      synonym_type: newSyn.synonym_type,
      species_id: newSyn.species_id || null,
      status: 'under_review',
      source: 'manual',
    });
    if (error) { showToast('Failed: ' + error.message, 'error'); setCreating(false); return; }
    showToast('Synonym created.', 'success');
    setShowCreate(false);
    setNewSyn({ name: '', language: 'en', synonym_type: 'common_name', species_id: '' });
    setCreating(false);
    loadSynonyms();
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
            <span className="text-gray-800 font-medium">Synonym Center</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Synonym Center</h1>
                <p className="text-xs text-gray-500">{total} synonyms</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
              >
                <Plus className="w-4 h-4" /> Add Synonym
              </button>
              <button onClick={loadSynonyms} className="p-2 rounded-lg hover:bg-gray-100">
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
                placeholder="Search synonyms…"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All statuses</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
            </select>
            <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All languages</option>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          {/* Create Modal */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Add Synonym</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={newSyn.name} onChange={(e) => setNewSyn((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Synonym name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                      <select value={newSyn.language} onChange={(e) => setNewSyn((p) => ({ ...p, language: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {['en', 'fr', 'es', 'pt', 'de', 'it', 'zh', 'ja'].map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select value={newSyn.synonym_type} onChange={(e) => setNewSyn((p) => ({ ...p, synonym_type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        {['common_name', 'trade_name', 'local_name', 'scientific_synonym', 'abbreviation', 'alias'].map((t) => (
                          <option key={t} value={t}>{t.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={createSynonym} disabled={creating || !newSyn.name.trim()}
                    className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Language</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Species</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
                ) : synonyms.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No synonyms found.</td></tr>
                ) : synonyms.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Globe className="w-3 h-3" /> {s.language}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[s.synonym_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.synonym_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.species ? (
                        <div>
                          <div className="text-xs font-medium text-gray-700">{s.species.common_name}</div>
                          <div className="text-xs text-gray-400 italic">{s.species.scientific_name}</div>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Hash className="w-3 h-3" /> {s.frequency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {s.status === 'under_review' && (
                          <>
                            <button onClick={() => updateStatus(s.id, 'approved')} className="p-1.5 rounded bg-green-50 hover:bg-green-100 text-green-600" title="Approve">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateStatus(s.id, 'rejected')} className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-500" title="Reject">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateStatus(s.id, 'merged')} className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600" title="Merge">
                              <GitMerge className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteSynonym(s.id)} className="p-1.5 rounded bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
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
