'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Package, ChevronRight, Search } from 'lucide-react';

interface PackagingConfig {
  id: string;
  name: string;
  material: string | null;
  net_weight: number | null;
  gross_weight: number | null;
  weight_unit: string | null;
  units_per_package: number | null;
  packages_per_carton: number | null;
  status: string | null;
  is_demo: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  unverified: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function PackagingPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [configs, setConfigs] = useState<PackagingConfig[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [demoFilter, setDemoFilter] = useState<'all' | 'demo' | 'real'>('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/packaging'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchConfigs = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('packaging_configurations').select('*').order('created_at', { ascending: false }).limit(100);
    if (demoFilter === 'demo') q = q.eq('is_demo', true);
    if (demoFilter === 'real') q = q.eq('is_demo', false);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data } = await q;
    setConfigs(data ?? []);
    setFetching(false);
  }, [profile, demoFilter, search]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

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
          <span className="text-slate-800 font-medium">Packaging</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-pink-600 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Packaging Configurations</h1>
            <p className="text-xs text-slate-500">A photo showing packaging does not prove its weight or market</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search packaging..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value as 'all' | 'demo' | 'real')} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            <option value="all">All Data</option>
            <option value="demo">Demo Only</option>
            <option value="real">Real Only</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : configs.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No packaging configurations found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Net Weight</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Units/Pkg</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pkgs/Carton</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.name}</div>
                      {c.material && <div className="text-xs text-slate-400">{c.material}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.net_weight != null ? `${c.net_weight} ${c.weight_unit ?? 'kg'}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.units_per_package ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.packages_per_carton ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status ?? 'unverified'] ?? 'bg-slate-100 text-slate-600'}`}>{c.status ?? 'unverified'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.is_demo && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">demo</span>}
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
