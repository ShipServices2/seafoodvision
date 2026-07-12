'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FileText, ChevronRight, Search, Lock } from 'lucide-react';

interface Document {
  id: string;
  public_title: string;
  internal_title: string | null;
  status: string | null;
  confidentiality_level: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  is_public: boolean;
  is_demo: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  suggested: 'bg-blue-100 text-blue-700',
  unverified: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const CONFIDENTIALITY_COLORS: Record<string, string> = {
  public: 'bg-green-100 text-green-700',
  restricted: 'bg-yellow-100 text-yellow-700',
  internal: 'bg-orange-100 text-orange-700',
  confidential: 'bg-red-100 text-red-700',
  highly_confidential: 'bg-red-200 text-red-800',
};

export default function DocumentsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/documents'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchDocuments = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (search.trim()) q = q.ilike('public_title', `%${search.trim()}%`);
    const { data } = await q;
    setDocuments(data ?? []);
    setFetching(false);
  }, [profile, statusFilter, search]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

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
          <span className="text-slate-800 font-medium">Documents</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Documents</h1>
            <p className="text-xs text-slate-500">Documents are private by default — no originals uploaded in Phase 5.1</p>
          </div>
        </div>

        <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2">
          <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-indigo-700">All documents are private by default. No original files are uploaded in this phase. Only references and metadata are stored.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {['all', 'draft', 'suggested', 'unverified', 'under_review', 'verified', 'rejected'].map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No documents found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Confidentiality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Issuing Body</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Issue Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.public_title}</div>
                      {d.internal_title && <div className="text-xs text-slate-400">{d.internal_title}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status ?? 'draft'] ?? 'bg-slate-100 text-slate-600'}`}>{d.status ?? 'draft'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENTIALITY_COLORS[d.confidentiality_level ?? 'confidential'] ?? 'bg-slate-100 text-slate-600'}`}>{d.confidentiality_level ?? 'confidential'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.issuing_body ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{d.issue_date ? new Date(d.issue_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {d.is_demo && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">demo</span>}
                        {d.is_public && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">public</span>}
                      </div>
                    </td>
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
