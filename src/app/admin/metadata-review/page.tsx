'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ClipboardCheck, Upload, Fish, Tag, BookOpen, ChartBar as BarChart2, Clock, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Circle as HelpCircle, GitMerge, Zap, TrendingUp, Users, ArrowRight, RefreshCw } from 'lucide-react';

interface ReviewStats {
  totalAssets: number;
  pendingReview: number;
  aiSuggestions: number;
  approved: number;
  rejected: number;
  unknownSpecies: number;
  unknownCategories: number;
  synonymsCount: number;
  conflictsCount: number;
  avgConfidence: number;
  validationProgress: number;
  keywordsCount: number;
  importBatches: number;
}

const SECTIONS = [
  {
    href: '/admin/metadata-review/assets',
    icon: ClipboardCheck,
    label: 'Asset Review',
    desc: 'Review and validate per-asset metadata suggestions',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
  },
  {
    href: '/admin/metadata-review/import',
    icon: Upload,
    label: 'Import Metadata Pack',
    desc: 'Import Codex CSV packs with dry-run validation',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    iconColor: 'text-violet-600',
  },
  {
    href: '/admin/metadata-review/species',
    icon: Fish,
    label: 'Species Review Center',
    desc: 'Validate, merge and correct species entries',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconColor: 'text-teal-600',
  },
  {
    href: '/admin/metadata-review/synonyms',
    icon: GitMerge,
    label: 'Synonym Center',
    desc: 'Manage synonyms by language, type and frequency',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
  },
  {
    href: '/admin/metadata-review/keywords',
    icon: Tag,
    label: 'Keyword Center',
    desc: 'Detect duplicates, merge variants and validate keywords',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
  },
  {
    href: '/admin/metadata-review/history',
    icon: BookOpen,
    label: 'History',
    desc: 'Full audit trail of all metadata changes',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    iconColor: 'text-gray-600',
  },
];

const WORKFLOW_STATES = [
  { label: 'Suggested', color: 'bg-gray-100 text-gray-600', key: 'suggested' },
  { label: 'Under Review', color: 'bg-amber-100 text-amber-700', key: 'under_review' },
  { label: 'Approved', color: 'bg-green-100 text-green-700', key: 'approved' },
  { label: 'Rejected', color: 'bg-red-100 text-red-700', key: 'rejected' },
  { label: 'Merged', color: 'bg-blue-100 text-blue-700', key: 'merged' },
  { label: 'Published', color: 'bg-indigo-100 text-indigo-700', key: 'published' },
];

export default function MetadataReviewDashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/metadata-review');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/account');
    }
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user || !profile) return;
    if (!['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '')) return;
    const supabase = createClient();
    (async () => {
      setFetching(true);
      const [
        assetsRes,
        suggestionsRes,
        approvedRes,
        rejectedRes,
        synonymsRes,
        keywordsRes,
        importRes,
        reviewsRes,
      ] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('metadata_suggestions').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
        supabase.from('metadata_suggestions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('metadata_suggestions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('metadata_synonyms').select('*', { count: 'exact', head: true }),
        supabase.from('metadata_keywords').select('*', { count: 'exact', head: true }),
        supabase.from('metadata_import_batches').select('*', { count: 'exact', head: true }),
        supabase.from('asset_metadata_reviews').select('quality_score, confidence_score'),
      ]);

      const reviews = reviewsRes.data ?? [];
      const avgConf = reviews.length > 0
        ? reviews.reduce((acc, r) => acc + (r.confidence_score ?? 0), 0) / reviews.length
        : 0;
      const totalAssets = assetsRes.count ?? 0;
      const approvedCount = approvedRes.count ?? 0;
      const progress = totalAssets > 0 ? Math.round((approvedCount / totalAssets) * 100) : 0;

      setStats({
        totalAssets,
        pendingReview: suggestionsRes.count ?? 0,
        aiSuggestions: (suggestionsRes.count ?? 0) + (approvedRes.count ?? 0) + (rejectedRes.count ?? 0),
        approved: approvedCount,
        rejected: rejectedRes.count ?? 0,
        unknownSpecies: 0,
        unknownCategories: 0,
        synonymsCount: synonymsRes.count ?? 0,
        conflictsCount: 0,
        avgConfidence: Math.round(avgConf * 100),
        validationProgress: progress,
        keywordsCount: keywordsRes.count ?? 0,
        importBatches: importRes.count ?? 0,
      });
      setFetching(false);
    })();
  }, [user, profile]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading Metadata Review Center…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/admin" className="hover:text-gray-700">Admin</Link>
                <span>/</span>
                <span className="text-gray-800 font-medium">Metadata Review Center</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Metadata Review Center</h1>
              <p className="text-sm text-gray-500 mt-1">
                Validate, correct and publish Codex metadata before integration into Seafood Vision.
                All AI suggestions remain <span className="font-medium text-amber-600">under_review</span> until human validation.
              </p>
            </div>
            <Link
              href="/admin/metadata-review/assets"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              Start Review
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Assets', value: stats?.totalAssets ?? 0, icon: BarChart2, color: 'text-gray-700' },
              { label: 'Pending Review', value: stats?.pendingReview ?? 0, icon: Clock, color: 'text-amber-600' },
              { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-500' },
              { label: 'Synonyms', value: stats?.synonymsCount ?? 0, icon: GitMerge, color: 'text-blue-600' },
              { label: 'Keywords', value: stats?.keywordsCount ?? 0, icon: Tag, color: 'text-violet-600' },
              { label: 'Import Batches', value: stats?.importBatches ?? 0, icon: Upload, color: 'text-teal-600' },
              { label: 'Unknown Species', value: stats?.unknownSpecies ?? 0, icon: HelpCircle, color: 'text-orange-500' },
              { label: 'Conflicts', value: stats?.conflictsCount ?? 0, icon: AlertTriangle, color: 'text-red-500' },
              { label: 'Avg Confidence', value: `${stats?.avgConfidence ?? 0}%`, icon: Zap, color: 'text-indigo-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Validation Progress */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">Validation Progress</span>
              </div>
              <span className="text-sm font-bold text-blue-600">{stats?.validationProgress ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${stats?.validationProgress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {stats?.approved ?? 0} of {stats?.totalAssets ?? 0} assets validated
            </p>
          </div>

          {/* Workflow States */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Workflow States</h2>
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_STATES.map((ws) => (
                <span key={ws.key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${ws.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {ws.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              All Codex suggestions start as <strong>under_review</strong>. No AI suggestion is auto-published.
            </p>
          </div>

          {/* Module Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map((sec) => (
              <Link
                key={sec.href}
                href={sec.href}
                className={`group flex items-start gap-4 p-5 rounded-xl border bg-white hover:shadow-md transition-all duration-200 hover:border-blue-300`}
              >
                <div className={`p-2.5 rounded-lg border ${sec.color} flex-shrink-0`}>
                  <sec.icon className={`w-5 h-5 ${sec.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{sec.label}</span>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{sec.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Integration Notice */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Integration Targets</h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Validated metadata feeds automatically into: <strong>Species Center</strong>, <strong>Seafood Encyclopedia</strong>,{' '}
                  <strong>Smart Search</strong>, <strong>Marketplace</strong>, <strong>AI Knowledge Assistant</strong>, and{' '}
                  <strong>Seafood Identification</strong> — without data duplication.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
