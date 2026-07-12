'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, FileImage, Fish, Tag, ClipboardList, Upload, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface AdminStats {
  totalAssets: number;
  underReview: number;
  totalSpecies: number;
  totalCategories: number;
  loading: boolean;
}

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    totalAssets: 0, underReview: 0, totalSpecies: 0, totalCategories: 0, loading: true,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/admin');
      return;
    }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('review_status', 'under_review'),
      supabase.from('species').select('*', { count: 'exact', head: true }),
      supabase.from('categories').select('*', { count: 'exact', head: true }),
    ]).then(([a, ur, sp, cat]) => {
      setStats({
        totalAssets: a.count ?? 0,
        underReview: ur.count ?? 0,
        totalSpecies: sp.count ?? 0,
        totalCategories: cat.count ?? 0,
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

  if (!['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
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
      label: 'Reviews',
      description: 'Asset review queue and status management',
      stat: stats.underReview,
      statLabel: 'pending',
    },
    {
      href: '/admin/imports',
      icon: Upload,
      label: 'CSV Import',
      description: 'Validate and preview Codex CSV exports',
      stat: null,
      statLabel: null,
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
                  {section.stat !== null && (
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
