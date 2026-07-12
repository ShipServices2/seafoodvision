'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { BookOpen, ChevronRight, Search, Plus } from 'lucide-react';

interface Source {
  id: string;
  source_type: string;
  title: string | null;
  author_or_organization: string | null;
  reliability_level: string | null;
  confidentiality_level: string | null;
  url: string | null;
  publication_date: string | null;
  created_at: string;
}

const RELIABILITY_COLORS: Record<string, string> = {
  unknown: 'bg-slate-100 text-slate-500',
  low: 'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-green-100 text-green-700',
  authoritative: 'bg-blue-100 text-blue-700',
};

export default function SourcesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/sources'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchSources = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('knowledge_sources').select('*').order('created_at', { ascending: false }).limit(100);
    if (typeFilter !== 'all') q = q.eq('source_type', typeFilter);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data } = await q;
    setSources(data ?? []);
    setFetching(false);
  }, [profile, typeFilter, search]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const sourceTypes = ['all', 'media_observation', 'internal_experience', 'supplier_document', 'official_source', 'scientific_publication', 'public_database', 'expert_review', 'other'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Sources</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Knowledge Sources</h1>
              <p className="text-xs text-slate-500">{sources.length} sources — no URLs are auto-fetched</p>
            </div>
          </div>
          {['administrator', 'super_admin'].includes(profile?.role ?? '') && (
            <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> Add Source
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search sources..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {sourceTypes.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : sources.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No sources found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title / Author</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Reliability</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confidentiality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{s.title ?? '—'}</div>
                      {s.author_or_organization && <div className="text-xs text-slate-400">{s.author_or_organization}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{s.source_type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RELIABILITY_COLORS[s.reliability_level ?? 'unknown'] ?? 'bg-slate-100 text-slate-500'}`}>{s.reliability_level ?? 'unknown'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{s.confidentiality_level ?? 'internal'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
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
