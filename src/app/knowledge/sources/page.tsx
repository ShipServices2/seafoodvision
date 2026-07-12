'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, BookOpen } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchPublicSources, type EncSource } from '@/lib/supabase/encyclopediaQueries';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_source: 'Official Source',
  scientific_publication: 'Scientific Publication',
  public_database: 'Public Database',
  expert_review: 'Expert Review',
  internal_experience: 'Internal Experience',
  media_observation: 'Media Observation',
  other: 'Other',
};

const RELIABILITY_BADGE: Record<string, string> = {
  authoritative: 'bg-green-100 text-green-700 border-green-200',
  high: 'bg-blue-100 text-blue-700 border-blue-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  unknown: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS);

export default function SourcesPage() {
  const [sources, setSources] = useState<EncSource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchPublicSources({ page, pageSize: 30, sourceType: activeType || undefined }).then((r) => {
      setSources(r.data);
      setTotal(r.total);
      setLoading(false);
    });
  }, [page, activeType]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Sources</span>
        </nav>

        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Sources & Trust</p>
          <h1 className="text-3xl font-bold text-foreground mb-3">Public Knowledge Sources</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Only sources explicitly marked as public are listed here. Internal, confidential, and restricted sources are not visible. Each source is assigned a reliability level by a qualified reviewer.
          </p>

          {/* Type filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => { setActiveType(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!activeType ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            {SOURCE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => { setActiveType(activeType === t ? '' : t); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeType === t ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
              >
                {SOURCE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <BookOpen size={32} className="text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No public sources yet</h3>
              <p className="text-sm text-muted-foreground">Public sources will appear here as the knowledge graph grows.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">{total} public source{total !== 1 ? 's' : ''}</p>
              <div className="space-y-3">
                {sources.map((s) => (
                  <div key={s.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{s.title || 'Untitled source'}</h3>
                        {s.author_or_organization && (
                          <p className="text-xs text-muted-foreground mt-0.5">{s.author_or_organization}</p>
                        )}
                        {s.reference && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono-data truncate">{s.reference}</p>
                        )}
                        {s.publication_date && (
                          <p className="text-xs text-muted-foreground mt-1">Published: {s.publication_date}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {SOURCE_TYPE_LABELS[s.source_type] || s.source_type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RELIABILITY_BADGE[s.reliability_level] || RELIABILITY_BADGE.unknown}`}>
                          {s.reliability_level}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
                  <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
