'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Library, Search, Eye, Fish, Database, Shield, ChevronRight, BookOpen, Layers } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  value: string | number;
  detail?: string;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  checks: CheckResult[];
}

interface AssetRow {
  id: string;
  slug: string;
  title: string;
  review_status: string;
  publication_status: string;
  is_demo: boolean;
  is_verified: boolean;
  species_id: string | null;
  category: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckResult['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={16} className="text-green-600 shrink-0" />;
  if (status === 'fail') return <XCircle size={16} className="text-red-600 shrink-0" />;
  if (status === 'warn') return <AlertCircle size={16} className="text-amber-500 shrink-0" />;
  return <AlertCircle size={16} className="text-blue-500 shrink-0" />;
}

function statusBg(status: CheckResult['status']) {
  if (status === 'pass') return 'bg-green-50 border-green-200';
  if (status === 'fail') return 'bg-red-50 border-red-200';
  if (status === 'warn') return 'bg-amber-50 border-amber-200';
  return 'bg-blue-50 border-blue-200';
}

function statusText(status: CheckResult['status']) {
  if (status === 'pass') return 'text-green-700';
  if (status === 'fail') return 'text-red-700';
  if (status === 'warn') return 'text-amber-700';
  return 'text-blue-700';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicCatalogVisibilityPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [runAt, setRunAt] = useState<string>('');
  const [score, setScore] = useState({ pass: 0, warn: 0, fail: 0, total: 0 });
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const runAudit = async () => {
    setLoading(true);
    const supabase = createClient();
    const now = new Date();
    setRunAt(now.toLocaleString());

    // ── 1. Fetch all assets (admin view — no RLS filter) ──────────────────
    const { data: allAssets, error: allErr } = await supabase
      .from('assets')
      .select('id, slug, title, review_status, publication_status, is_demo, is_verified, species_id, category')
      .order('created_at', { ascending: false });

    const assetList: AssetRow[] = (allAssets as AssetRow[]) || [];
    setAssets(assetList);

    const totalAssets = assetList.length;
    const approvedAssets = assetList.filter(a =>
      ['approved', 'commercial', 'editorial', 'preview_only'].includes(a.review_status)
    );
    const draftAssets = assetList.filter(a => a.review_status === 'draft');
    const importedAssets = assetList.filter(a => a.review_status === 'imported');
    const underReviewAssets = assetList.filter(a => a.review_status === 'under_review');
    const archivedPub = assetList.filter(a => a.publication_status === 'archived');
    const demoAssets = assetList.filter(a => a.is_demo);
    const realAssets = assetList.filter(a => !a.is_demo);
    const approvedReal = approvedAssets.filter(a => !a.is_demo);
    const withSpecies = assetList.filter(a => a.species_id !== null);
    const withoutSpecies = assetList.filter(a => a.species_id === null);

    // ── 2. Fetch species ──────────────────────────────────────────────────
    const { data: speciesData } = await supabase
      .from('species')
      .select('id, slug, common_name, is_demo');
    const speciesList = speciesData || [];
    const publicSpecies = speciesList.filter((s: any) => !s.is_demo);

    // ── 3. Fetch categories ───────────────────────────────────────────────
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name, is_active');
    const activeCategories = (catData || []).filter((c: any) => c.is_active);

    // ── 4. Fetch keywords ─────────────────────────────────────────────────
    const { data: kwData } = await supabase
      .from('asset_keywords')
      .select('asset_id, keywords(term)');
    const assetsWithKeywords = new Set((kwData || []).map((k: any) => k.asset_id));

    // ── 5. Fetch asset_files ──────────────────────────────────────────────
    const { data: filesData } = await supabase
      .from('asset_files')
      .select('asset_id, file_level');
    const assetsWithFiles = new Set((filesData || []).map((f: any) => f.asset_id));
    const assetsWithThumbnails = new Set(
      (filesData || []).filter((f: any) => f.file_level === 'thumbnail').map((f: any) => f.asset_id)
    );

    // ── 6. Test public read (anon) ────────────────────────────────────────
    const { data: publicRead, error: publicReadErr } = await supabase
      .from('assets')
      .select('id, review_status')
      .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
      .limit(20);
    const publicReadCount = (publicRead || []).length;

    // ── 7. Test slug resolution ───────────────────────────────────────────
    const firstApproved = approvedAssets[0];
    let slugWorks = false;
    if (firstApproved?.slug) {
      const { data: slugTest } = await supabase
        .from('assets')
        .select('id, slug')
        .eq('slug', firstApproved.slug)
        .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
        .maybeSingle();
      slugWorks = !!slugTest;
    }

    // ── 8. Test species join ──────────────────────────────────────────────
    let speciesJoinWorks = false;
    if (withSpecies.length > 0) {
      const { data: joinTest, error: joinErr } = await supabase
        .from('assets')
        .select('id, species!fk_assets_species(id, common_name)')
        .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
        .limit(5);
      speciesJoinWorks = !joinErr && (joinTest || []).length > 0;
    }

    // ── 9. Test keyword join ──────────────────────────────────────────────
    let keywordJoinWorks = false;
    {
      const { data: kwJoinTest, error: kwJoinErr } = await supabase
        .from('assets')
        .select('id, asset_keywords(keywords(term))')
        .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
        .limit(5);
      keywordJoinWorks = !kwJoinErr && (kwJoinTest || []).length > 0;
    }

    // ── 10. Test species page assets ──────────────────────────────────────
    let speciesPageWorks = false;
    const speciesWithAssets = speciesList.filter((s: any) =>
      approvedAssets.some(a => a.species_id === s.id)
    );
    if (speciesWithAssets.length > 0) {
      const testSpeciesId = speciesWithAssets[0].id;
      const { data: spAssetsTest, error: spErr } = await supabase
        .from('assets')
        .select('id, species_id')
        .eq('species_id', testSpeciesId)
        .in('review_status', ['approved', 'commercial', 'editorial', 'preview_only'])
        .limit(5);
      speciesPageWorks = !spErr && (spAssetsTest || []).length > 0;
    }

    // ── Build sections ────────────────────────────────────────────────────

    const newSections: Section[] = [
      {
        title: 'Catalog Inventory',
        icon: <Database size={16} />,
        checks: [
          {
            label: 'Total assets in database',
            status: totalAssets > 0 ? 'pass' : 'fail',
            value: totalAssets,
            detail: `${demoAssets.length} demo · ${realAssets.length} real`,
          },
          {
            label: 'Assets with approved/public status',
            status: approvedAssets.length > 0 ? 'pass' : 'fail',
            value: approvedAssets.length,
            detail: approvedAssets.length === 0
              ? 'No assets have review_status in [approved, commercial, editorial, preview_only]'
              : `${approvedReal.length} real · ${approvedAssets.length - approvedReal.length} demo`,
          },
          {
            label: 'Assets blocked (draft/imported/under_review)',
            status: (draftAssets.length + importedAssets.length + underReviewAssets.length) === 0 ? 'pass' : 'warn',
            value: draftAssets.length + importedAssets.length + underReviewAssets.length,
            detail: `draft: ${draftAssets.length} · imported: ${importedAssets.length} · under_review: ${underReviewAssets.length}`,
          },
          {
            label: 'Assets blocked by publication_status=archived',
            status: archivedPub.length === 0 ? 'pass' : 'warn',
            value: archivedPub.length,
            detail: archivedPub.length > 0 ? 'These assets are hidden even if review_status is approved' : 'None archived',
          },
        ],
      },
      {
        title: 'RLS & Public Access',
        icon: <Shield size={16} />,
        checks: [
          {
            label: 'Public (anon) can read approved assets',
            status: publicReadErr ? 'fail' : publicReadCount > 0 ? 'pass' : 'warn',
            value: publicReadErr ? 'ERROR' : publicReadCount,
            detail: publicReadErr
              ? `RLS error: ${publicReadErr.message}`
              : publicReadCount === 0
              ? 'RLS policy may be blocking — check assets_public_read_approved' :'RLS policy working correctly for anonymous users',
          },
          {
            label: 'Slug-based asset lookup works',
            status: !firstApproved ? 'warn' : slugWorks ? 'pass' : 'fail',
            value: !firstApproved ? 'No approved assets' : slugWorks ? 'OK' : 'FAIL',
            detail: firstApproved
              ? `Tested slug: ${firstApproved.slug}`
              : 'Cannot test — no approved assets found',
          },
          {
            label: 'Species join (fk_assets_species) works',
            status: withSpecies.length === 0 ? 'warn' : speciesJoinWorks ? 'pass' : 'fail',
            value: withSpecies.length === 0 ? 'No assets with species_id' : speciesJoinWorks ? 'OK' : 'FAIL',
            detail: withSpecies.length > 0
              ? `${withSpecies.length} assets have species_id set`
              : `${withoutSpecies.length} assets have no species_id`,
          },
          {
            label: 'Keyword join works',
            status: keywordJoinWorks ? 'pass' : 'warn',
            value: keywordJoinWorks ? 'OK' : 'No keywords',
            detail: `${assetsWithKeywords.size} assets have keywords`,
          },
        ],
      },
      {
        title: 'Library Page (/library)',
        icon: <Library size={16} />,
        checks: [
          {
            label: 'Approved assets visible in Library',
            status: approvedReal.length > 0 ? 'pass' : approvedAssets.length > 0 ? 'warn' : 'fail',
            value: approvedReal.length,
            detail: approvedReal.length === 0
              ? approvedAssets.length > 0
                ? 'Only demo assets are approved — real assets need review_status update' :'No approved assets — update review_status to approved/commercial/editorial/preview_only'
              : `${approvedReal.length} real assets ready to display`,
          },
          {
            label: 'Assets with category set',
            status: assetList.filter(a => a.category).length === totalAssets ? 'pass' : 'warn',
            value: `${assetList.filter(a => a.category).length}/${totalAssets}`,
            detail: 'Category filter requires this field',
          },
          {
            label: 'Active categories available',
            status: activeCategories.length > 0 ? 'pass' : 'warn',
            value: activeCategories.length,
            detail: activeCategories.map((c: any) => c.name).join(', ') || 'None',
          },
          {
            label: 'Assets with keywords',
            status: assetsWithKeywords.size > 0 ? 'pass' : 'warn',
            value: assetsWithKeywords.size,
            detail: `${totalAssets - assetsWithKeywords.size} assets have no keywords`,
          },
        ],
      },
      {
        title: 'Asset Detail Page (/asset/[slug])',
        icon: <Eye size={16} />,
        checks: [
          {
            label: 'Approved assets have slugs',
            status: approvedAssets.every(a => !!a.slug) ? 'pass' : 'fail',
            value: approvedAssets.filter(a => !!a.slug).length + '/' + approvedAssets.length,
            detail: approvedAssets.filter(a => !a.slug).map(a => a.title).join(', ') || 'All slugs present',
          },
          {
            label: 'Slug lookup via RLS',
            status: !firstApproved ? 'warn' : slugWorks ? 'pass' : 'fail',
            value: slugWorks ? 'Working' : firstApproved ? 'FAIL' : 'No approved assets',
            detail: firstApproved
              ? `Test: /asset/${firstApproved.slug}`
              : 'Approve at least one asset first',
          },
          {
            label: 'Assets with storage files (thumbnails)',
            status: assetsWithThumbnails.size > 0 ? 'pass' : 'warn',
            value: assetsWithThumbnails.size,
            detail: assetsWithThumbnails.size === 0
              ? 'No thumbnails in asset_files — emoji fallback will be shown'
              : `${assetsWithThumbnails.size} assets have thumbnail files`,
          },
          {
            label: 'Assets with any storage file',
            status: assetsWithFiles.size > 0 ? 'pass' : 'warn',
            value: assetsWithFiles.size,
            detail: assetsWithFiles.size === 0
              ? 'No files in asset_files table — upload to Supabase Storage to activate previews'
              : `${assetsWithFiles.size} assets have storage files`,
          },
        ],
      },
      {
        title: 'Species Pages (/species/[slug])',
        icon: <Fish size={16} />,
        checks: [
          {
            label: 'Species records available',
            status: publicSpecies.length > 0 ? 'pass' : 'fail',
            value: publicSpecies.length,
            detail: `${speciesList.length} total · ${publicSpecies.length} non-demo`,
          },
          {
            label: 'Approved assets linked to species',
            status: withSpecies.filter(a =>
              ['approved', 'commercial', 'editorial', 'preview_only'].includes(a.review_status)
            ).length > 0 ? 'pass' : 'warn',
            value: withSpecies.filter(a =>
              ['approved', 'commercial', 'editorial', 'preview_only'].includes(a.review_status)
            ).length,
            detail: `${withoutSpecies.length} approved assets have no species_id`,
          },
          {
            label: 'Species with linked assets',
            status: speciesWithAssets.length > 0 ? 'pass' : 'warn',
            value: speciesWithAssets.length,
            detail: speciesWithAssets.map((s: any) => s.common_name).join(', ') || 'No species have approved assets',
          },
          {
            label: 'Species page asset query works',
            status: speciesWithAssets.length === 0 ? 'warn' : speciesPageWorks ? 'pass' : 'fail',
            value: speciesWithAssets.length === 0 ? 'No linked assets' : speciesPageWorks ? 'OK' : 'FAIL',
            detail: speciesWithAssets.length > 0
              ? `Tested species_id: ${speciesWithAssets[0].id}`
              : 'Link assets to species via species_id column',
          },
        ],
      },
      {
        title: 'Search',
        icon: <Search size={16} />,
        checks: [
          {
            label: 'Text search on title works',
            status: approvedAssets.length > 0 ? 'pass' : 'warn',
            value: approvedAssets.length > 0 ? 'Available' : 'No approved assets',
            detail: 'Library search uses ilike on title, product_form, country',
          },
          {
            label: 'Assets searchable by category',
            status: assetList.filter(a => a.category).length > 0 ? 'pass' : 'warn',
            value: assetList.filter(a => a.category).length,
            detail: 'Category filter uses exact match',
          },
          {
            label: 'Assets searchable by species',
            status: withSpecies.length > 0 ? 'pass' : 'warn',
            value: withSpecies.length,
            detail: 'Species filter requires species_id to be set',
          },
          {
            label: 'Keyword search available',
            status: assetsWithKeywords.size > 0 ? 'pass' : 'warn',
            value: assetsWithKeywords.size,
            detail: assetsWithKeywords.size === 0
              ? 'Add keywords via asset_keywords table for better discoverability'
              : `${assetsWithKeywords.size} assets indexed with keywords`,
          },
        ],
      },
    ];

    setSections(newSections);

    // Score
    const allChecks = newSections.flatMap(s => s.checks);
    const p = allChecks.filter(c => c.status === 'pass').length;
    const w = allChecks.filter(c => c.status === 'warn').length;
    const f = allChecks.filter(c => c.status === 'fail').length;
    setScore({ pass: p, warn: w, fail: f, total: allChecks.length });

    setLoading(false);
  };

  useEffect(() => { runAudit(); }, []);

  const scorePercent = score.total > 0 ? Math.round((score.pass / score.total) * 100) : 0;
  const scoreColor = scorePercent >= 80 ? 'text-green-600' : scorePercent >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = scorePercent >= 80 ? 'bg-green-50 border-green-200' : scorePercent >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
            <ChevronRight size={12} />
            <span className="text-foreground font-medium">Public Catalog Visibility</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Public Catalog Visibility Report</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Audits the full publication chain: RLS policies, status filters, joins, and public page queries.
              </p>
              {runAt && (
                <p className="text-xs text-muted-foreground mt-1">Last run: {runAt}</p>
              )}
            </div>
            <button
              onClick={runAudit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Running…' : 'Re-run Audit'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-border border-t-secondary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Running catalog visibility audit…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Score Card */}
            <div className={`rounded-2xl border p-6 mb-8 ${scoreBg}`}>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <p className={`text-5xl font-black ${scoreColor}`}>{scorePercent}%</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Overall Score</p>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4 min-w-[200px]">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{score.pass}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{score.warn}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{score.fail}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <Link href="/library" target="_blank" className="flex items-center gap-1.5 text-secondary hover:underline">
                    <ExternalLink size={12} /> Open Library
                  </Link>
                  <Link href="/species" target="_blank" className="flex items-center gap-1.5 text-secondary hover:underline">
                    <ExternalLink size={12} /> Open Species
                  </Link>
                  {assets[0] && (
                    <Link href={`/asset/${assets[0].slug}`} target="_blank" className="flex items-center gap-1.5 text-secondary hover:underline">
                      <ExternalLink size={12} /> Test Asset Detail
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Asset Status Breakdown */}
            {assets.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-5 mb-8">
                <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Layers size={15} className="text-muted-foreground" />
                  Asset Status Breakdown ({assets.length} total)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Title</th>
                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">review_status</th>
                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">publication_status</th>
                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">is_demo</th>
                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium">species_id</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Public?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.slice(0, 20).map((a) => {
                        const isPublic = ['approved', 'commercial', 'editorial', 'preview_only'].includes(a.review_status)
                          && a.publication_status !== 'archived';
                        return (
                          <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium text-foreground max-w-[200px] truncate">
                              <Link href={`/asset/${a.slug}`} target="_blank" className="hover:text-secondary hover:underline">
                                {a.title}
                              </Link>
                            </td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${
                                isPublic ? 'bg-green-100 text-green-700' :
                                a.review_status === 'under_review' ? 'bg-amber-100 text-amber-700' :
                                a.review_status === 'imported'? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {a.review_status}
                              </span>
                            </td>
                            <td className="py-2 pr-4 font-mono-data text-muted-foreground">{a.publication_status}</td>
                            <td className="py-2 pr-4">
                              <span className={a.is_demo ? 'text-purple-600' : 'text-green-600'}>
                                {a.is_demo ? 'demo' : 'real'}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              {a.species_id ? (
                                <span className="text-green-600">✓ linked</span>
                              ) : (
                                <span className="text-amber-600">— none</span>
                              )}
                            </td>
                            <td className="py-2">
                              {isPublic ? (
                                <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> Yes</span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> No</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {assets.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-2">Showing 20 of {assets.length} assets</p>
                  )}
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sections.map((section) => (
                <div key={section.title} className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-muted-foreground">{section.icon}</span>
                    {section.title}
                  </h2>
                  <div className="space-y-2">
                    {section.checks.map((check) => (
                      <div
                        key={check.label}
                        className={`flex items-start gap-3 rounded-xl border p-3 ${statusBg(check.status)}`}
                      >
                        <StatusIcon status={check.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold ${statusText(check.status)}`}>{check.label}</p>
                            <span className={`text-xs font-mono-data font-bold shrink-0 ${statusText(check.status)}`}>
                              {check.value}
                            </span>
                          </div>
                          {check.detail && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Items */}
            {score.fail > 0 && (
              <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <XCircle size={15} />
                  Critical Issues — Action Required
                </h2>
                <ul className="space-y-2">
                  {sections.flatMap(s => s.checks).filter(c => c.status === 'fail').map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span><strong>{c.label}</strong>: {c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {score.warn > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertCircle size={15} />
                  Warnings — Recommended Improvements
                </h2>
                <ul className="space-y-2">
                  {sections.flatMap(s => s.checks).filter(c => c.status === 'warn').map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span><strong>{c.label}</strong>: {c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Links */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/library', label: 'Library', icon: <Library size={14} /> },
                { href: '/species', label: 'Species', icon: <Fish size={14} /> },
                { href: '/admin/assets', label: 'Admin Assets', icon: <Database size={14} /> },
                { href: '/mvp-report', label: 'MVP Report', icon: <BookOpen size={14} /> },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 justify-center px-4 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
