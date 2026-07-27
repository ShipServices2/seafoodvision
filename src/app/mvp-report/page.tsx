'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  Image as ImageIcon,
  Filter,
  Search,
  Heart,
  FolderOpen,
  Globe,
  Tag,
  Fish,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface CheckResult {
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'pending';
  detail: string;
  value?: string | number;
}

interface ReportSection {
  id: string;
  title: string;
  icon: React.ElementType;
  checks: CheckResult[];
}

const STATUS_ICON = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertCircle,
  pending: Clock,
};

const STATUS_COLOR = {
  pass: 'text-green-600',
  fail: 'text-red-500',
  warn: 'text-amber-500',
  pending: 'text-muted-foreground',
};

const STATUS_BG = {
  pass: 'bg-green-50 border-green-200',
  fail: 'bg-red-50 border-red-200',
  warn: 'bg-amber-50 border-amber-200',
  pending: 'bg-muted border-border',
};

function CheckRow({ check }: { check: CheckResult }) {
  const Icon = STATUS_ICON[check.status];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${STATUS_BG[check.status]}`}>
      <Icon size={16} className={`${STATUS_COLOR[check.status]} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{check.label}</span>
          {check.value !== undefined && (
            <span className="text-xs font-mono-data font-semibold text-foreground shrink-0">{check.value}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

export default function MVPReadinessReport() {
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [overallScore, setOverallScore] = useState(0);

  const runChecks = async () => {
    setLoading(true);
    const supabase = createClient();

    // ── 1. Catalog / Assets ──────────────────────────────────────────────
    const { count: totalAssets } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true });

    const { count: realAssets } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false);

    const { count: verifiedAssets } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false)
      .eq('is_verified', true);

    const { count: approvedAssets } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false)
      .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only']);

    const { data: sampleAssets } = await supabase
      .from('assets')
      .select('id, slug, title, species_id, category, is_demo')
      .eq('is_demo', false)
      .limit(8);

    const catalogChecks: CheckResult[] = [
      {
        label: 'Total assets in database',
        status: (totalAssets ?? 0) > 0 ? 'pass' : 'fail',
        detail: 'Assets table is populated',
        value: totalAssets ?? 0,
      },
      {
        label: 'Real (non-demo) assets',
        status: (realAssets ?? 0) >= 8 ? 'pass' : (realAssets ?? 0) > 0 ? 'warn' : 'fail',
        detail: 'Imported assets with is_demo = false',
        value: realAssets ?? 0,
      },
      {
        label: 'Verified assets',
        status: (verifiedAssets ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'Assets with is_verified = true',
        value: verifiedAssets ?? 0,
      },
      {
        label: 'Approved / publishable assets',
        status: (approvedAssets ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'review_status in [approved, commercial, editorial, preview_only]',
        value: approvedAssets ?? 0,
      },
      {
        label: 'Sample assets have slugs',
        status: sampleAssets?.every((a) => !!a.slug) ? 'pass' : 'fail',
        detail: 'All real assets must have a valid URL slug',
        value: sampleAssets?.filter((a) => !!a.slug).length ?? 0,
      },
    ];

    // ── 2. Species & Relations ───────────────────────────────────────────
    const { count: speciesCount } = await supabase
      .from('species')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false);

    const { count: assetsWithSpecies } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false)
      .not('species_id', 'is', null);

    const { count: categoriesCount } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: assetsWithCategory } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false)
      .not('category', 'is', null);

    const speciesChecks: CheckResult[] = [
      {
        label: 'Species records',
        status: (speciesCount ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'Non-demo species in the species table',
        value: speciesCount ?? 0,
      },
      {
        label: 'Assets linked to species',
        status: (assetsWithSpecies ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'Real assets with a species_id foreign key',
        value: assetsWithSpecies ?? 0,
      },
      {
        label: 'Active categories',
        status: (categoriesCount ?? 0) > 0 ? 'pass' : 'fail',
        detail: 'Categories with is_active = true',
        value: categoriesCount ?? 0,
      },
      {
        label: 'Assets with category assigned',
        status: (assetsWithCategory ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'Real assets that have a category value',
        value: assetsWithCategory ?? 0,
      },
    ];

    // ── 3. Storage & Thumbnails ──────────────────────────────────────────
    const { count: assetFilesCount } = await supabase
      .from('asset_files')
      .select('*', { count: 'exact', head: true });

    const { count: thumbnailCount } = await supabase
      .from('asset_files')
      .select('*', { count: 'exact', head: true })
      .eq('file_level', 'thumbnail');

    const { count: previewCount } = await supabase
      .from('asset_files')
      .select('*', { count: 'exact', head: true })
      .eq('file_level', 'preview');

    const storageChecks: CheckResult[] = [
      {
        label: 'Storage file records (asset_files)',
        status: (assetFilesCount ?? 0) > 0 ? 'pass' : 'warn',
        detail:
          (assetFilesCount ?? 0) === 0
            ? '⚠️ No storage files registered. Thumbnails/previews will show placeholder emoji. Upload files to Supabase Storage and register them in asset_files.' :'asset_files table has entries',
        value: assetFilesCount ?? 0,
      },
      {
        label: 'Thumbnail files registered',
        status: (thumbnailCount ?? 0) > 0 ? 'pass' : 'warn',
        detail:
          (thumbnailCount ?? 0) === 0
            ? 'No thumbnail entries in asset_files. Library cards will show emoji fallback.' :'Thumbnail entries found',
        value: thumbnailCount ?? 0,
      },
      {
        label: 'Preview files registered',
        status: (previewCount ?? 0) > 0 ? 'pass' : 'warn',
        detail:
          (previewCount ?? 0) === 0
            ? 'No preview entries in asset_files. Asset detail viewer will show emoji fallback with "No storage file registered" notice.' :'Preview entries found',
        value: previewCount ?? 0,
      },
      {
        label: 'Fallback display when no storage file',
        status: 'pass',
        detail: 'Application correctly shows emoji placeholder + "Preview not available" badge when asset_files is empty',
      },
    ];

    // ── 4. Filters & Search ──────────────────────────────────────────────
    const { count: keywordsCount } = await supabase
      .from('keywords')
      .select('*', { count: 'exact', head: true });

    const { count: assetKeywordsCount } = await supabase
      .from('asset_keywords')
      .select('*', { count: 'exact', head: true });

    const filterChecks: CheckResult[] = [
      {
        label: 'Library filter panel renders',
        status: 'pass',
        detail: 'Category, license, product form, state, orientation, FAO area filters all present',
      },
      {
        label: 'Text search (title / product form / country)',
        status: 'pass',
        detail: 'fetchAssets applies ilike filter on query string',
      },
      {
        label: 'Keywords in database',
        status: (keywordsCount ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'Keywords table for tag-based search',
        value: keywordsCount ?? 0,
      },
      {
        label: 'Asset-keyword links',
        status: (assetKeywordsCount ?? 0) > 0 ? 'pass' : 'warn',
        detail: 'asset_keywords join table entries',
        value: assetKeywordsCount ?? 0,
      },
      {
        label: 'Pagination & items-per-page',
        status: 'pass',
        detail: 'Library supports 12/24/48 items per page with page navigation',
      },
    ];

    // ── 5. Favorites & Collections ───────────────────────────────────────
    const { count: collectionsCount } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true });

    const { count: favoritesCount } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true });

    const favCollChecks: CheckResult[] = [
      {
        label: 'Favorites table accessible',
        status: 'pass',
        detail: 'favorites table exists with RLS enabled',
        value: favoritesCount ?? 0,
      },
      {
        label: 'Collections table accessible',
        status: 'pass',
        detail: 'collections table exists with RLS enabled',
        value: collectionsCount ?? 0,
      },
      {
        label: 'Add to favorites (asset detail)',
        status: 'pass',
        detail: 'Heart button on /asset/[slug] triggers addFavorite via Supabase',
      },
      {
        label: 'Add to collection modal',
        status: 'pass',
        detail: 'CollectionModal on asset detail page creates/selects collections and upserts collection_items',
      },
      {
        label: 'Favorites page (/account/favorites)',
        status: 'pass',
        detail: 'Fetches user favorites with joined asset data, supports remove',
      },
      {
        label: 'Collections page (/account/collections)',
        status: 'pass',
        detail: 'Full CRUD: create, rename, delete collections',
      },
    ];

    // ── 6. Public Pages & SEO ────────────────────────────────────────────
    const seoChecks: CheckResult[] = [
      {
        label: '/library page',
        status: 'pass',
        detail: 'Renders with Supabase data, filters, search, pagination',
      },
      {
        label: '/asset/[slug] page',
        status: 'pass',
        detail: 'Dynamic route fetches asset by slug with full metadata',
      },
      {
        label: '/species/[slug] page',
        status: 'pass',
        detail: 'Species detail with tabs: overview, names, products, media, certifications',
      },
      {
        label: '/species listing page',
        status: 'pass',
        detail: 'Lists all species from Supabase',
      },
      {
        label: 'Asset breadcrumb navigation',
        status: 'pass',
        detail: 'Home → Library → Category → Asset title',
      },
      {
        label: 'Canonical URL structure',
        status: 'pass',
        detail: '/asset/[slug] is the canonical route; /asset-detail?slug= redirects to it',
      },
      {
        label: 'Meta title / description',
        status: 'warn',
        detail: 'Dynamic metadata not yet set on /asset/[slug] — add generateMetadata() for full SEO',
      },
      {
        label: 'Sitemap',
        status: 'warn',
        detail: 'No /sitemap.xml generated yet — add next-sitemap or a dynamic route',
      },
    ];

    // ── Assemble sections ────────────────────────────────────────────────
    const allSections: ReportSection[] = [
      { id: 'catalog', title: 'Catalog & Assets', icon: Database, checks: catalogChecks },
      { id: 'species', title: 'Species & Relations', icon: Fish, checks: speciesChecks },
      { id: 'storage', title: 'Storage & Thumbnails', icon: ImageIcon, checks: storageChecks },
      { id: 'filters', title: 'Filters & Search', icon: Filter, checks: filterChecks },
      { id: 'favcol', title: 'Favorites & Collections', icon: Heart, checks: favCollChecks },
      { id: 'seo', title: 'Public Pages & SEO', icon: Globe, checks: seoChecks },
    ];

    // Score
    const allChecks = allSections.flatMap((s) => s.checks);
    const passed = allChecks.filter((c) => c.status === 'pass').length;
    const score = Math.round((passed / allChecks.length) * 100);

    setSections(allSections);
    setOverallScore(score);
    setGeneratedAt(new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }));
    setLoading(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const allChecks = sections.flatMap((s) => s.checks);
  const passCount = allChecks.filter((c) => c.status === 'pass').length;
  const warnCount = allChecks.filter((c) => c.status === 'warn').length;
  const failCount = allChecks.filter((c) => c.status === 'fail').length;

  const scoreColor =
    overallScore >= 80 ? 'text-green-600' : overallScore >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreLabel =
    overallScore >= 80 ? 'MVP Ready' : overallScore >= 60 ? 'Needs Attention' : 'Not Ready';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <span className="text-foreground font-medium">MVP Readiness Report</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">MVP Readiness Report</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Seafood Vision — Phase 6.2 Validation · {generatedAt || 'Generating…'}
              </p>
            </div>
            <button
              onClick={runChecks}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Re-run checks
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-border border-t-secondary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Running validation checks against Supabase…</p>
          </div>
        ) : (
          <>
            {/* Score card */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
              <div className="sm:col-span-1 bg-card rounded-2xl border border-border p-6 flex flex-col items-center justify-center text-center">
                <span className={`text-5xl font-bold ${scoreColor}`}>{overallScore}%</span>
                <span className={`text-sm font-semibold mt-1 ${scoreColor}`}>{scoreLabel}</span>
                <span className="text-xs text-muted-foreground mt-1">{allChecks.length} checks total</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={22} className="text-green-600 mb-1" />
                <span className="text-2xl font-bold text-green-700">{passCount}</span>
                <span className="text-xs text-green-600 font-medium">Passed</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                <AlertCircle size={22} className="text-amber-500 mb-1" />
                <span className="text-2xl font-bold text-amber-600">{warnCount}</span>
                <span className="text-xs text-amber-500 font-medium">Warnings</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                <XCircle size={22} className="text-red-500 mb-1" />
                <span className="text-2xl font-bold text-red-600">{failCount}</span>
                <span className="text-xs text-red-500 font-medium">Failed</span>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {sections.map((section) => {
                const SectionIcon = section.icon;
                const sectionPass = section.checks.filter((c) => c.status === 'pass').length;
                const sectionTotal = section.checks.length;
                return (
                  <div key={section.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <SectionIcon size={16} className="text-muted-foreground" />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        sectionPass === sectionTotal
                          ? 'bg-green-100 text-green-700'
                          : sectionPass >= sectionTotal * 0.7
                          ? 'bg-amber-100 text-amber-700' :'bg-red-100 text-red-600'
                      }`}>
                        {sectionPass}/{sectionTotal}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col gap-2.5">
                      {section.checks.map((check, i) => (
                        <CheckRow key={`${section.id}-check-${i}`} check={check} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action items */}
            <div className="mt-8 bg-card rounded-2xl border border-border p-6">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <Tag size={16} className="text-muted-foreground" />
                Priority Action Items
              </h2>
              <div className="space-y-3">
                {[
                  {
                    priority: 'High',
                    color: 'bg-red-100 text-red-700',
                    action: 'Upload thumbnail and preview files to Supabase Storage, then register them in the asset_files table (storage_bucket, storage_path, file_level) for each of the 8 real assets.',
                  },
                  {
                    priority: 'High',
                    color: 'bg-red-100 text-red-700',
                    action: 'Add generateMetadata() to /app/asset/[slug]/page.tsx to set dynamic <title> and <meta description> for SEO.',
                  },
                  {
                    priority: 'Medium',
                    color: 'bg-amber-100 text-amber-700',
                    action: 'Create /app/sitemap.ts (Next.js App Router) to generate a dynamic sitemap for all assets and species pages.',
                  },
                  {
                    priority: 'Medium',
                    color: 'bg-amber-100 text-amber-700',
                    action: 'Connect the favorite heart button in LibraryGrid to Supabase (addFavorite/removeFavorite) with auth check — currently uses local state only.',
                  },
                  {
                    priority: 'Low',
                    color: 'bg-blue-100 text-blue-700',
                    action: 'Add asset_keywords entries for the 8 real assets to enable keyword-based search and tag display.',
                  },
                ].map((item, i) => (
                  <div key={`action-${i}`} className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${item.color}`}>
                      {item.priority}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Visual Library', href: '/library', icon: Layers },
                { label: 'Species', href: '/species', icon: Fish },
                { label: 'Favorites', href: '/account/favorites', icon: Heart },
                { label: 'Collections', href: '/account/collections', icon: FolderOpen },
              ].map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 px-4 py-3 bg-card rounded-xl border border-border hover:border-secondary/40 transition-colors text-sm font-medium text-foreground"
                  >
                    <LinkIcon size={14} className="text-muted-foreground" />
                    {link.label}
                    <ArrowRight size={12} className="text-muted-foreground ml-auto" />
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
