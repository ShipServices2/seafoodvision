'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Globe, ChevronRight, Search, Plus } from 'lucide-react';

interface Market {
  id: string;
  slug: string;
  name: string;
  market_type: string;
  region: string | null;
  status: string | null;
  is_public: boolean;
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

const TYPE_COLORS: Record<string, string> = {
  country: 'bg-blue-100 text-blue-700',
  regional: 'bg-cyan-100 text-cyan-700',
  retail: 'bg-green-100 text-green-700',
  foodservice: 'bg-orange-100 text-orange-700',
  wholesale: 'bg-violet-100 text-violet-700',
  processing: 'bg-slate-100 text-slate-600',
  institutional: 'bg-indigo-100 text-indigo-700',
  marketplace: 'bg-pink-100 text-pink-700',
};

export default function MarketsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/markets'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchMarkets = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('markets').select('*').order('created_at', { ascending: false }).limit(100);
    if (typeFilter !== 'all') q = q.eq('market_type', typeFilter);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data } = await q;
    setMarkets(data ?? []);
    setFetching(false);
  }, [profile, typeFilter, search]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const marketTypes = ['all', 'country', 'regional', 'retail', 'foodservice', 'wholesale', 'processing', 'institutional', 'marketplace'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Markets</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Markets</h1>
              <p className="text-xs text-slate-500">Market preferences must be sourced claims, not automatic facts</p>
            </div>
          </div>
          {['administrator', 'super_admin'].includes(profile?.role ?? '') && (
            <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> Add Market
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search markets..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {marketTypes.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fetching ? (
            <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : markets.length === 0 ? (
            <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No markets found</p>
            </div>
          ) : markets.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-800 text-sm">{m.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[m.status ?? 'unverified'] ?? 'bg-slate-100 text-slate-600'}`}>{m.status ?? 'unverified'}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[m.market_type] ?? 'bg-slate-100 text-slate-600'}`}>{m.market_type}</span>
                {m.is_demo && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">demo</span>}
                {m.is_public && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">public</span>}
              </div>
              {m.region && <p className="text-xs text-slate-500">Region: {m.region}</p>}
              <p className="text-xs text-slate-400 mt-1 font-mono">{m.slug}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
