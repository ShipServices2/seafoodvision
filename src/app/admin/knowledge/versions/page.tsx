'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Clock, ChevronRight, Search } from 'lucide-react';

interface Version {
  id: string;
  entity_id: string;
  entity_type: string | null;
  version_number: number;
  change_type: string | null;
  change_reason: string | null;
  changed_at: string | null;
  created_at: string;
}

export default function VersionsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [versions, setVersions] = useState<Version[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/versions'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchVersions = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('knowledge_versions').select('*').order('created_at', { ascending: false }).limit(100);
    if (search.trim()) q = q.ilike('change_reason', `%${search.trim()}%`);
    const { data } = await q;
    setVersions(data ?? []);
    setFetching(false);
  }, [profile, search]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const CHANGE_COLORS: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    corrected: 'bg-yellow-100 text-yellow-700',
    verified: 'bg-teal-100 text-teal-700',
    rejected: 'bg-red-100 text-red-700',
    disputed: 'bg-purple-100 text-purple-700',
    restored: 'bg-indigo-100 text-indigo-700',
    marked_obsolete: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Versions</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-slate-600 flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Version History</h1>
            <p className="text-xs text-slate-500">Complete audit trail of all knowledge changes</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : versions.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No version history yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Change</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versions.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/knowledge/entities/${v.entity_id}`} className="font-mono text-xs text-teal-600 hover:text-teal-700">{v.entity_id.slice(0, 8)}…</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{v.entity_type ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">v{v.version_number}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CHANGE_COLORS[v.change_type ?? 'updated'] ?? 'bg-slate-100 text-slate-600'}`}>{v.change_type ?? 'updated'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-48 truncate">{v.change_reason ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(v.changed_at ?? v.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
