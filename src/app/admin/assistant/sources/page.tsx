'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Database, ChevronLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SourceStat {
  source_type: string;
  count: number;
}

export default function AdminAssistantSourcesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant/sources');
    if (!loading && profile && !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) router.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin', 'reviewer'].includes(profile.role)) return;
    const supabase = createClient();
    supabase
      .from('assistant_message_sources')
      .select('source_type')
      .limit(1000)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((s: any) => {
          counts[s.source_type] = (counts[s.source_type] || 0) + 1;
        });
        const stats = Object.entries(counts)
          .map(([source_type, count]) => ({ source_type, count }))
          .sort((a, b) => b.count - a.count);
        setSources(stats);
        setTotal(data?.length || 0);
        setFetching(false);
      });
  }, [profile]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Source Citations</h1>
              <p className="text-xs text-muted-foreground">{total} total citations across all answers</p>
            </div>
          </div>

          {fetching ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No citations recorded yet</div>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => {
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.source_type} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground capitalize">{s.source_type}</span>
                      <span className="text-sm font-bold text-foreground">{s.count} <span className="text-xs text-muted-foreground font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
