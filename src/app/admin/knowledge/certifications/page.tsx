'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Award, ChevronRight, Search } from 'lucide-react';

interface Certification {
  id: string;
  slug: string;
  name: string;
  issuing_body: string | null;
  certification_type: string;
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
  quality: 'bg-blue-100 text-blue-700',
  food_safety: 'bg-teal-100 text-teal-700',
  sustainability: 'bg-green-100 text-green-700',
  religious: 'bg-purple-100 text-purple-700',
  organic: 'bg-lime-100 text-lime-700',
  regulatory: 'bg-orange-100 text-orange-700',
  facility: 'bg-slate-100 text-slate-600',
  product: 'bg-indigo-100 text-indigo-700',
};

export default function CertificationsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge/certifications'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const fetchCertifications = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const supabase = createClient();
    let q = supabase.from('certifications').select('*').order('created_at', { ascending: false }).limit(100);
    if (typeFilter !== 'all') q = q.eq('certification_type', typeFilter);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data } = await q;
    setCertifications(data ?? []);
    setFetching(false);
  }, [profile, typeFilter, search]);

  useEffect(() => { fetchCertifications(); }, [fetchCertifications]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const certTypes = ['all', 'quality', 'food_safety', 'sustainability', 'religious', 'organic', 'regulatory', 'facility', 'product'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin" className="hover:text-teal-600">Admin</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/admin/knowledge" className="hover:text-teal-600">Knowledge</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Certifications</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
            <Award className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Certifications</h1>
            <p className="text-xs text-slate-500">A logo on a photo does not make a certification &quot;verified&quot;</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search certifications..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none">
            {certTypes.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fetching ? (
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
            </div>
          ) : certifications.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No certifications found</p>
            </div>
          ) : certifications.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-800 text-sm">{c.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[c.status ?? 'unverified'] ?? 'bg-slate-100 text-slate-600'}`}>{c.status ?? 'unverified'}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.certification_type] ?? 'bg-slate-100 text-slate-600'}`}>{c.certification_type.replace('_', ' ')}</span>
                {c.is_demo && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">demo</span>}
                {c.is_public && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">public</span>}
              </div>
              {c.issuing_body && <p className="text-xs text-slate-500">Issuing body: {c.issuing_body}</p>}
              <p className="text-xs text-slate-400 mt-1 font-mono">{c.slug}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
