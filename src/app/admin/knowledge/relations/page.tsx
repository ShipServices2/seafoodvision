'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { GitBranch, ChevronRight, Search } from 'lucide-react';

interface Relation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  weight: number | null;
  status: string | null;
  confidence_score: number | null;
  justification: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  suggested: 'bg-blue-100 text-blue-700',
  unverified: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  disputed: 'bg-purple-100 text-purple-700',
};

export default function RelationsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [relations, setRelations] = useState<Relation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/relations'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchRelations = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('knowledge_relations').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (search.trim()) q = q.ilike('relation_type', `%${search.trim()}%`);
    const { data } = await q;
    setRelations(data ?? []);
    setFetching(false);
  }, [profile, statusFilter, search]);

  useEffect(() => { fetchRelations(); }, [fetchRelations]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Relations</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Knowledge Relations</h1>
            <p className="text-xs text-slate-500">{relations.length} relations loaded</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search relation types..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {['all', 'suggested', 'unverified', 'under_review', 'verified', 'rejected', 'disputed'].map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : relations.length === 0 ? (
            <div className="p-12 text-center">
              <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No relations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">From Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Relation</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">To Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confidence</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.from_entity_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">{r.relation_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.to_entity_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status ?? 'suggested'] ?? 'bg-slate-100 text-slate-600'}`}>{r.status ?? 'suggested'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.confidence_score != null ? `${Math.round((r.confidence_score ?? 0) * 100)}%` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
