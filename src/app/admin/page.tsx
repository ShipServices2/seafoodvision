'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, FileImage, Fish, Tag, ClipboardList, Upload, ChevronRight, Award, TrendingUp, BarChart2, AlertCircle, Database, ClipboardCheck, HardDrive, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchExtendedCatalogStats } from '@/lib/supabase/queries';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface AdminStats {
  totalAssets: number;
  underReview: number;
  totalSpecies: number;
  totalCategories: number;
  realAssets: number;
  demoAssets: number;
  realSpecies: number;
  demoSpecies: number;
  previewOnly: number;
  // Phase 4.4
  certifiedAssets: number;
  commercialReady: number;
  avgCertificationPct: number;
  avgMetadataPct: number;
  avgRightsPct: number;
  loading: boolean;
}

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    totalAssets: 0, underReview: 0, totalSpecies: 0, totalCategories: 0,
    realAssets: 0, demoAssets: 0, realSpecies: 0, demoSpecies: 0, previewOnly: 0,
    certifiedAssets: 0, commercialReady: 0, avgCertificationPct: 0,
    avgMetadataPct: 0, avgRightsPct: 0,
    loading: true,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/admin');
      return;
    }
    // Only super_admin and administrator can access /admin
    // Reviewers are redirected to /account (middleware also enforces this server-side)
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'under_review'),
      supabase.from('species').select('*', { count: 'exact', head: true }),
      supabase.from('categories').select('*', { count: 'exact', head: true }),
      fetchExtendedCatalogStats(),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'approved'),
      supabase.from('asset_workflow').select('*', { count: 'exact', head: true }).eq('workflow_status', 'commercial_license_ready'),
      supabase.from('asset_readiness').select('completion_pct, metadata_completed, rights_verified'),
    ]).then(([a, ur, sp, cat, extended, certified, commercial, readiness]) => {
      const readData = readiness.data ?? [];
      const avgCert = readData.length > 0
        ? readData.reduce((acc, r) => acc + (r.completion_pct ?? 0), 0) / readData.length
        : 0;
      const metaCount = readData.filter((r) => r.metadata_completed).length;
      const rightsCount = readData.filter((r) => r.rights_verified).length;
      const avgMeta = readData.length > 0 ? (metaCount / readData.length) * 100 : 0;
      const avgRights = readData.length > 0 ? (rightsCount / readData.length) * 100 : 0;

      setStats({
        totalAssets: a.count ?? 0,
        underReview: ur.count ?? 0,
        totalSpecies: sp.count ?? 0,
        totalCategories: cat.count ?? 0,
        realAssets: extended.realAssets,
        demoAssets: extended.demoAssets,
        realSpecies: extended.realSpecies,
        demoSpecies: extended.demoSpecies,
        previewOnly: extended.previewOnly,
        certifiedAssets: certified.count ?? 0,
        commercialReady: commercial.count ?? 0,
        avgCertificationPct: Math.round(avgCert),
        avgMetadataPct: Math.round(avgMeta),
        avgRightsPct: Math.round(avgRights),
        loading: false,
      });
    });
  }, [profile]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!['administrator', 'super_admin'].includes(profile.role)) {
    return null;
  }

  const adminSections = [
    {
      href: '/admin/assets',
      icon: FileImage,
      label: 'Assets',
      description: 'Review, filter and manage media assets',
      stat: stats.totalAssets,
      statLabel: 'total',
      badge: stats.underReview > 0 ? `${stats.underReview} pending review` : null,
    },
    {
      href: '/admin/species',
      icon: Fish,
      label: 'Species',
      description: 'Manage species catalog and validation',
      stat: stats.totalSpecies,
      statLabel: 'species',
    },
    {
      href: '/admin/categories',
      icon: Tag,
      label: 'Categories',
      description: 'Manage asset categories and product forms',
      stat: stats.totalCategories,
      statLabel: 'categories',
    },
    {
      href: '/admin/reviews',
      icon: ClipboardList,
      label: 'Asset Review Center',
      description: 'Full certification workflow, readiness checklist, history',
      stat: stats.underReview,
      statLabel: 'pending',
      badge: stats.underReview > 0 ? `${stats.underReview} to review` : null,
    },
    {
      href: '/admin/reviewer-dashboard',
      icon: BarChart2,
      label: 'Review Dashboards',
      description: 'Reviewer stats, QC, commercial candidates, reports',
      stat: stats.certifiedAssets,
      statLabel: 'certified',
    },
    {
      href: '/mvp-report',
      icon: ClipboardCheck,
      label: 'MVP Readiness Report',
      description: 'Phase 6.2 validation — catalog, storage, SEO checks',
      stat: null,
      statLabel: null,
    },
    {
      href: '/admin/catalog-visibility',
      icon: Database,
      label: 'Public Catalog Visibility',
      description: 'Audit publication chain — RLS, status filters, joins, public pages',
      stat: null,
      statLabel: null,
    },
    {
      href: '/admin/imports',
      icon: Upload,
      label: 'CSV Import',
      description: 'Validate and preview Codex CSV exports',
      stat: null,
      statLabel: null,
    },
    {
      href: '/admin/reconcile-storage',
      icon: HardDrive,
      label: 'Reconcile Storage',
      description: 'Link already-uploaded Storage files to existing assets — no reimports',
      stat: null,
      statLabel: null,
      badge: 'Storage',
    },
    {
      href: '/admin/commerce',
      icon: ShoppingCart,
      label: 'Commerce',
      description: 'Dodo Payments infrastructure — orders, subscriptions, credits, webhooks',
      stat: null,
      statLabel: null,
      badge: 'Phase 7.2',
    },
    {
      href: '/licensing-center',
      icon: Award,
      label: 'Licensing Center',
      description: 'License preparation — Coming Soon',
      stat: null,
      statLabel: null,
      badge: 'Coming Soon',
    },
    {
      href: '/admin/knowledge',
      icon: Database,
      label: 'Knowledge Graph',
      description: 'Phase 5.1 — Entities, relations, claims, sources, conflicts',
      stat: null,
      statLabel: null,
      badge: 'Phase 5.1',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Administration</h1>
            <p className="text-sm text-muted-foreground capitalize">
              Logged in as <span className="font-medium">{profile.role}</span>
            </p>
          </div>
        </div>

        {/* Stats row */}
        {!stats.loading && (
          <div className="space-y-4 mb-8">
            {/* Core stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Assets', value: stats.totalAssets },
                { label: 'Pending Review', value: stats.underReview },
                { label: 'Species', value: stats.totalSpecies },
                { label: 'Categories', value: stats.totalCategories },
              ].map((s) => (
                <div key={s.label} className="bg-card rounded-xl border border-border p-4">
                  <p className="text-2xl font-bold text-foreground font-mono-data">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Real vs Demo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Real Assets', value: stats.realAssets, color: 'text-green-600' },
                { label: 'Demo Assets', value: stats.demoAssets, color: 'text-amber-600' },
                { label: 'Real Species', value: stats.realSpecies, color: 'text-green-600' },
                { label: 'Preview Only', value: stats.previewOnly, color: 'text-blue-600' },
              ].map((s) => (
                <div key={s.label} className="bg-card rounded-xl border border-border p-4">
                  <p className={`text-2xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Phase 4.4 Commercial Cockpit */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-secondary" />
                <h2 className="text-sm font-semibold text-foreground">Commercial Readiness Cockpit</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Certified Assets', value: stats.certifiedAssets, color: 'text-green-600' },
                  { label: 'Commercial Ready', value: stats.commercialReady, color: 'text-teal-600' },
                  { label: 'Avg Certification %', value: `${stats.avgCertificationPct}%`, color: 'text-secondary' },
                  { label: 'Avg Metadata %', value: `${stats.avgMetadataPct}%`, color: 'text-blue-600' },
                  { label: 'Avg Rights %', value: `${stats.avgRightsPct}%`, color: 'text-orange-600' },
                  { label: 'Est. Monthly Revenue', value: '—', color: 'text-muted-foreground', note: 'Simulation only' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className={`text-xl font-bold font-mono-data ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    {s.note && <p className="text-xs text-muted-foreground/60 italic mt-0.5">{s.note}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle size={12} />
                <span>Revenue estimate is simulation only — not real revenue. No payments are active.</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:border-secondary/30 hover:shadow-card transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-secondary/10 transition-colors">
                  <Icon size={18} className="text-muted-foreground group-hover:text-secondary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm">{section.label}</h3>
                    {section.badge && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                        {section.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{section.description}</p>
                  {section.stat !== null && section.stat !== undefined && (
                    <p className="text-xs font-mono-data text-secondary mt-2 font-semibold">
                      {section.stat} {section.statLabel}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:text-secondary transition-colors" />
              </Link>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to account
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
