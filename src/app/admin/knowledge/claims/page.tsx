'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FileText, ChevronRight, Search, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface Claim {
  id: string;
  entity_id: string;
  claim_text: string;
  claim_status: string;
  confidence_score: number | null;
  predicate: string | null;
  value_text: string | null;
  status: string | null;
  justification: string | null;
  created_at: string;
  updated_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-blue-100 text-blue-700',
  suggested: 'bg-blue-100 text-blue-700',
  unverified: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  disputed: 'bg-purple-100 text-purple-700',
  deprecated: 'bg-slate-100 text-slate-400',
};

const STATUSES = ['all', 'suggested', 'unverified', 'under_review', 'verified', 'rejected', 'disputed'];

export default function ClaimsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/claims'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchClaims = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('knowledge_claims').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('claim_status', statusFilter);
    if (search.trim()) q = q.ilike('claim_text', `%${search.trim()}%`);
    const { data } = await q;
    setClaims(data ?? []);
    setFetching(false);
  }, [profile, statusFilter, search]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const updateClaimStatus = async (claimId: string, newStatus: string) => {
    if (!['administrator', 'super_admin'].includes(profile?.role ?? '')) return;
    setUpdating(claimId);
    const supabase = createClient();
    await supabase.from('knowledge_claims').update({ claim_status: newStatus }).eq('id', claimId);
    await fetchClaims();
    setUpdating(null);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const counts = {
    pending: claims.filter((c) => ['suggested', 'unverified', 'under_review'].includes(c.claim_status)).length,
    verified: claims.filter((c) => c.claim_status === 'verified').length,
    rejected: claims.filter((c) => c.claim_status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Claims</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Knowledge Claims</h1>
            <p className="text-xs text-slate-500">Claims require a source and human decision to reach &quot;verified&quot;</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Pending Review', value: counts.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Verified', value: counts.verified, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Rejected', value: counts.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">A claim cannot be marked &quot;verified&quot; without a source and explicit human decision. Contradictory claims must remain visible.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search claims..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
          </select>
        </div>

        {/* Claims list */}
        <div className="space-y-3">
          {fetching ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : claims.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No claims found</p>
            </div>
          ) : claims.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-800">{c.claim_text}</p>
                  {c.predicate && (
                    <div className="mt-1 flex gap-3 text-xs text-slate-500">
                      <span>Predicate: <span className="font-mono">{c.predicate}</span></span>
                      {c.value_text && <span>→ {c.value_text}</span>}
                    </div>
                  )}
                  {c.justification && <p className="mt-1 text-xs text-slate-400 italic">{c.justification}</p>}
                  <div className="mt-2 flex gap-3 text-xs text-slate-400">
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    {c.confidence_score != null && <span>Confidence: {Math.round((c.confidence_score ?? 0) * 100)}%</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.claim_status] ?? 'bg-slate-100 text-slate-600'}`}>{c.claim_status}</span>
                  {['administrator', 'super_admin'].includes(profile?.role ?? '') && c.claim_status !== 'verified' && c.claim_status !== 'rejected' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateClaimStatus(c.id, 'verified')}
                        disabled={updating === c.id}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => updateClaimStatus(c.id, 'rejected')}
                        disabled={updating === c.id}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
