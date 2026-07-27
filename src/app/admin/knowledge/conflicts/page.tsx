'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TriangleAlert as AlertTriangle, ChevronRight, CircleCheck as CheckCircle } from 'lucide-react';

interface Conflict {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  conflict_type: string;
  status: string;
  severity: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  under_review: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  accepted_difference: 'bg-blue-100 text-blue-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-800',
};

export default function ConflictsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [activeConflict, setActiveConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/conflicts'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchConflicts = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('knowledge_conflicts').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setConflicts(data ?? []);
    setFetching(false);
  }, [profile, statusFilter]);

  useEffect(() => { fetchConflicts(); }, [fetchConflicts]);

  const resolveConflict = async (conflictId: string, newStatus: string) => {
    if (!['administrator', 'super_admin'].includes(profile?.role ?? '')) return;
    setResolving(conflictId);
    const supabase = createClient();
    await supabase.from('knowledge_conflicts').update({
      status: newStatus,
      resolution_note: resolutionNote || null,
      resolved_at: new Date().toISOString(),
    }).eq('id', conflictId);
    setActiveConflict(null);
    setResolutionNote('');
    await fetchConflicts();
    setResolving(null);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const openCount = conflicts.filter((c) => c.status === 'open').length;
  const reviewCount = conflicts.filter((c) => c.status === 'under_review').length;
  const resolvedCount = conflicts.filter((c) => c.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Conflicts</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Knowledge Conflicts</h1>
            <p className="text-xs text-slate-500">Contradictory data must remain visible until resolved</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Open', value: openCount, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Under Review', value: reviewCount, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Resolved', value: resolvedCount, color: 'text-green-600', bg: 'bg-green-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {['all', 'open', 'under_review', 'resolved', 'accepted_difference', 'dismissed'].map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {fetching ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No conflicts found</p>
            </div>
          ) : conflicts.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-600'}`}>{c.status.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[c.severity ?? 'medium'] ?? 'bg-slate-100 text-slate-600'}`}>{c.severity ?? 'medium'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{c.conflict_type.replace('_', ' ')}</span>
                  </div>
                  {c.entity_type && (
                    <p className="text-xs text-slate-500">Entity type: <span className="font-medium">{c.entity_type}</span></p>
                  )}
                  {c.resolution_note && (
                    <p className="mt-2 text-xs text-slate-600 italic">Resolution: {c.resolution_note}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                {['administrator', 'super_admin'].includes(profile?.role ?? '') && c.status === 'open' && (
                  <button
                    onClick={() => setActiveConflict(activeConflict === c.id ? null : c.id)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
              {activeConflict === c.id && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Resolution note (optional)..."
                    className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none resize-none text-slate-700 placeholder-slate-400"
                    rows={2}
                  />
                  <div className="flex gap-2 mt-2">
                    {['resolved', 'accepted_difference', 'dismissed'].map((s) => (
                      <button
                        key={s}
                        onClick={() => resolveConflict(c.id, s)}
                        disabled={resolving === c.id}
                        className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        Mark as {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
