'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { ReviewTask } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AdminReviewsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/reviews');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    supabase
      .from('review_tasks')
      .select('*, assets(id, slug, title, review_status)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setTasks((data as ReviewTask[]) || []);
        setFetching(false);
      });
  }, [profile]);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

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
            <h1 className="text-xl font-bold text-foreground">Review Queue</h1>
            <p className="text-sm text-muted-foreground">{tasks.length} review tasks</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Asset</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Asset Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-border">
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                  </tr>
                ))
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No review tasks found. The queue is empty.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {task.assets ? (
                        <Link href={`/asset-detail?slug=${task.assets.slug}`} className="font-medium text-foreground hover:text-secondary transition-colors">
                          {task.assets.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground font-mono-data text-xs">{task.asset_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[task.status] || 'bg-gray-100 text-gray-600'}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {task.assets?.review_status && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                          {task.assets.review_status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {new Date(task.created_at).toLocaleDateString()}
                    </td>
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
