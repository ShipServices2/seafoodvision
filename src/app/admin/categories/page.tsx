'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminCategories } from '@/lib/supabase/queries';
import type { Category } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AdminCategoriesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/categories');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    fetchAdminCategories().then((data) => {
      setCategories(data);
      setFetching(false);
    });
  }, [profile]);

  if (loading || !user || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground">{categories.length} categories</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-border">
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-2/3" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-8" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-8" /></td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No categories found</td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{cat.label}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground font-mono-data text-xs">{cat.slug}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{cat.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {cat.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono-data text-xs">{cat.sort_order}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
