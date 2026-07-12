'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminSpecies } from '@/lib/supabase/queries';
import type { Species } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AdminSpeciesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [species, setSpecies] = useState<Species[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/species');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    fetchAdminSpecies(page, 20).then(({ species: rows, total: t }) => {
      setSpecies(rows);
      setTotal(t);
      setFetching(false);
    });
  }, [page, profile]);

  if (loading || !user || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
    </div>;
  }

  const totalPages = Math.ceil(total / 20);

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
            <h1 className="text-xl font-bold text-foreground">Species</h1>
            <p className="text-sm text-muted-foreground">{total} total species</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Common Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Scientific Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Family</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validated</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Demo</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-border">
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/3" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-12" /></td>
                  </tr>
                ))
              ) : species.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No species found</td>
                </tr>
              ) : (
                species.map((sp) => (
                  <tr key={sp.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/species/${sp.slug}`} className="font-medium text-foreground hover:text-secondary transition-colors">
                        {sp.common_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground font-mono-data italic text-xs">{sp.scientific_name}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{sp.family || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sp.is_validated ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {sp.is_validated ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">{sp.is_demo ? 'Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50">Previous</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-outline px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
