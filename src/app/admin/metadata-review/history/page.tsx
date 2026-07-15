'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Search, Loader2, RefreshCw, User, Calendar, ArrowRight } from 'lucide-react';

interface HistoryEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_at: string;
  reason: string | null;
  source: string;
  is_undone: boolean;
  performer?: { full_name: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  merged: 'bg-violet-100 text-violet-700',
  deleted: 'bg-red-100 text-red-600',
  published: 'bg-indigo-100 text-indigo-700',
  status_changed: 'bg-amber-100 text-amber-700',
  bulk_action: 'bg-blue-100 text-blue-700',
  import: 'bg-teal-100 text-teal-700',
  undo: 'bg-gray-100 text-gray-600',
};

const ENTITY_COLORS: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-700',
  species: 'bg-teal-50 text-teal-700',
  synonym: 'bg-amber-50 text-amber-700',
  keyword: 'bg-rose-50 text-rose-700',
  suggestion: 'bg-violet-50 text-violet-700',
};

export default function MetadataHistoryPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review/history');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  const loadHistory = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    setFetching(true);
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('metadata_history')
      .select('*', { count: 'exact' })
      .order('performed_at', { ascending: false })
      .range(from, to);

    if (entityFilter) query = query.eq('entity_type', entityFilter);
    if (actionFilter) query = query.eq('action', actionFilter);

    const { data, count } = await query;
    setTotal(count ?? 0);
    if (!data) { setFetching(false); return; }

    // Enrich with performer profiles
    const performerIds = [...new Set(data.map((h) => h.performed_by).filter(Boolean))];
    let profileMap = new Map<string, { full_name: string; email: string }>();
    if (performerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', performerIds);
      profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    }

    let enriched = data.map((h) => ({
      ...h,
      performer: h.performed_by ? profileMap.get(h.performed_by) ?? null : null,
    }));

    if (search.trim()) {
      const q = search.toLowerCase();
      enriched = enriched.filter((h) =>
        h.entity_type.toLowerCase().includes(q) ||
        h.action.toLowerCase().includes(q) ||
        h.old_value?.toLowerCase().includes(q) ||
        h.new_value?.toLowerCase().includes(q) ||
        h.reason?.toLowerCase().includes(q)
      );
    }

    setHistory(enriched);
    setFetching(false);
  }, [profile, page, search, entityFilter, actionFilter]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/admin" className="hover:text-gray-700">Admin</Link>
            <span>/</span>
            <Link href="/admin/metadata-review" className="hover:text-gray-700">Metadata Review</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">History</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link href="/admin/metadata-review" className="p-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Metadata History</h1>
                <p className="text-xs text-gray-500">{total} entries · No history is ever lost</p>
              </div>
            </div>
            <button onClick={loadHistory} className="p-2 rounded-lg hover:bg-gray-100">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search history…"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All entities</option>
              <option value="asset">Asset</option>
              <option value="species">Species</option>
              <option value="synonym">Synonym</option>
              <option value="keyword">Keyword</option>
              <option value="suggestion">Suggestion</option>
            </select>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
              <option value="bulk_action">Bulk Action</option>
              <option value="import">Import</option>
              <option value="undo">Undo</option>
            </select>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Change</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Performer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Source</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No history entries found.</td></tr>
                ) : history.map((h) => (
                  <tr key={h.id} className={`border-b border-gray-50 hover:bg-gray-50 ${h.is_undone ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(h.performed_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(h.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_COLORS[h.entity_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {h.entity_type}
                      </span>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{h.entity_id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[h.action] ?? 'bg-gray-100 text-gray-600'}`}>
                          {h.action}
                        </span>
                        {h.is_undone && <span className="text-xs text-gray-400">(undone)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(h.old_value || h.new_value) ? (
                        <div className="flex items-center gap-1 text-xs">
                          {h.old_value && <span className="text-red-500 line-through truncate max-w-20">{h.old_value}</span>}
                          {h.old_value && h.new_value && <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                          {h.new_value && <span className="text-green-600 truncate max-w-20">{h.new_value}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {h.field_name && <div className="text-xs text-gray-400 mt-0.5">{h.field_name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {h.performer ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-700">{h.performer.full_name || h.performer.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate">{h.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{h.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
