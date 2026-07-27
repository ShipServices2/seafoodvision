'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Database, GitBranch, FileText, TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle, Circle as XCircle, Package, Globe, Award, Fish, ShoppingBag, ChevronRight, Layers, BookOpen, Shield } from 'lucide-react';

interface KGStats {
  totalEntities: number;
  speciesLinked: number;
  productsCreated: number;
  packagingDocumented: number;
  marketsCreated: number;
  certificationsRegistered: number;
  documentsReferenced: number;
  claimsPending: number;
  claimsVerified: number;
  claimsRejected: number;
  conflictsOpen: number;
  entitiesWithoutSource: number;
  obsoleteItems: number;
  relationsTotal: number;
  loading: boolean;
}

const navCards = [
  { href: '/admin/knowledge/entities', label: 'Entities', icon: Database, color: 'bg-blue-50 border-blue-200 text-blue-700', desc: 'Browse and manage all knowledge entities' },
  { href: '/admin/knowledge/relations', label: 'Relations', icon: GitBranch, color: 'bg-violet-50 border-violet-200 text-violet-700', desc: 'Manage entity relationships' },
  { href: '/admin/knowledge/claims', label: 'Claims', icon: FileText, color: 'bg-amber-50 border-amber-200 text-amber-700', desc: 'Review and validate claims' },
  { href: '/admin/knowledge/sources', label: 'Sources', icon: BookOpen, color: 'bg-teal-50 border-teal-200 text-teal-700', desc: 'Manage knowledge sources' },
  { href: '/admin/knowledge/conflicts', label: 'Conflicts', icon: AlertTriangle, color: 'bg-red-50 border-red-200 text-red-700', desc: 'Resolve data conflicts' },
  { href: '/admin/knowledge/versions', label: 'Versions', icon: Clock, color: 'bg-slate-50 border-slate-200 text-slate-700', desc: 'View version history' },
  { href: '/admin/knowledge/documents', label: 'Documents', icon: FileText, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', desc: 'Manage referenced documents' },
  { href: '/admin/knowledge/certifications', label: 'Certifications', icon: Award, color: 'bg-green-50 border-green-200 text-green-700', desc: 'Manage certification records' },
  { href: '/admin/knowledge/markets', label: 'Markets', icon: Globe, color: 'bg-cyan-50 border-cyan-200 text-cyan-700', desc: 'Manage market definitions' },
  { href: '/admin/knowledge/products', label: 'Products', icon: ShoppingBag, color: 'bg-orange-50 border-orange-200 text-orange-700', desc: 'Manage commercial products' },
  { href: '/admin/knowledge/packaging', label: 'Packaging', icon: Package, color: 'bg-slate-50 border-slate-200 text-slate-700', desc: 'Manage packaging configurations' },
  { href: '/admin/knowledge/link-media', label: 'Link Media', icon: Layers, color: 'bg-purple-50 border-purple-200 text-purple-700', desc: 'Link media assets to knowledge entities' },
  { href: '/admin/knowledge/search', label: 'Search', icon: Shield, color: 'bg-ocean-900/10 border-ocean-900/20 text-ocean-900', desc: 'Admin search with analytics — includes drafts and private content' },
];

export default function KnowledgeDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<KGStats>({
    totalEntities: 0, speciesLinked: 0, productsCreated: 0, packagingDocumented: 0,
    marketsCreated: 0, certificationsRegistered: 0, documentsReferenced: 0,
    claimsPending: 0, claimsVerified: 0, claimsRejected: 0, conflictsOpen: 0,
    entitiesWithoutSource: 0, obsoleteItems: 0, relationsTotal: 0, loading: true,
  });

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('knowledge_entities').select('*', { count: 'exact', head: true }),
      supabase.from('species').select('*', { count: 'exact', head: true }),
      supabase.from('commercial_products').select('*', { count: 'exact', head: true }),
      supabase.from('packaging_configurations').select('*', { count: 'exact', head: true }),
      supabase.from('markets').select('*', { count: 'exact', head: true }),
      supabase.from('certifications').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('knowledge_claims').select('*', { count: 'exact', head: true }).eq('status', 'suggested'),
      supabase.from('knowledge_claims').select('*', { count: 'exact', head: true }).eq('status', 'verified'),
      supabase.from('knowledge_claims').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('knowledge_conflicts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('knowledge_relations').select('*', { count: 'exact', head: true }),
      supabase.from('knowledge_entities').select('*', { count: 'exact', head: true }).eq('status', 'obsolete'),
    ]).then(([ent, sp, prod, pkg, mkt, cert, doc, pending, verified, rejected, conflicts, rels, obsolete]) => {
      setStats({
        totalEntities: ent.count ?? 0,
        speciesLinked: sp.count ?? 0,
        productsCreated: prod.count ?? 0,
        packagingDocumented: pkg.count ?? 0,
        marketsCreated: mkt.count ?? 0,
        certificationsRegistered: cert.count ?? 0,
        documentsReferenced: doc.count ?? 0,
        claimsPending: pending.count ?? 0,
        claimsVerified: verified.count ?? 0,
        claimsRejected: rejected.count ?? 0,
        conflictsOpen: conflicts.count ?? 0,
        entitiesWithoutSource: 0,
        obsoleteItems: obsolete.count ?? 0,
        relationsTotal: rels.count ?? 0,
        loading: false,
      });
    });
  }, [profile]);

  if (loading || stats.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Entities', value: stats.totalEntities, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Species', value: stats.speciesLinked, icon: Fish, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Products', value: stats.productsCreated, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Packaging Configs', value: stats.packagingDocumented, icon: Package, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Markets', value: stats.marketsCreated, icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Certifications', value: stats.certificationsRegistered, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Documents', value: stats.documentsReferenced, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Relations', value: stats.relationsTotal, icon: GitBranch, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  const claimCards = [
    { label: 'Claims Pending', value: stats.claimsPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Claims Verified', value: stats.claimsVerified, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Claims Rejected', value: stats.claimsRejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Open Conflicts', value: stats.conflictsOpen, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Obsolete Items', value: stats.obsoleteItems, icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin" className="hover:text-teal-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-800 font-medium">Knowledge Graph</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Knowledge Graph</h1>
              <p className="text-slate-500 text-sm">Phase 5.1 — Seafood Knowledge Engine Foundation</p>
            </div>
          </div>
        </div>

        {/* Phase badge */}
        <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">Knowledge Graph Foundation — Phase 5.1</p>
            <p className="text-xs text-teal-600 mt-0.5">All data displayed is real. No statistics are simulated. Claims require human validation and a verified source before reaching &quot;verified&quot; status.</p>
          </div>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Claims & conflicts */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {claimCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Navigation cards */}
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Knowledge Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`flex items-center gap-4 p-4 rounded-xl border ${card.color} hover:shadow-sm transition-shadow`}
            >
              <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                <card.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{card.label}</div>
                <div className="text-xs opacity-70 truncate">{card.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* Back to admin */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-teal-600 flex items-center gap-1">
            ← Back to Admin Dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
