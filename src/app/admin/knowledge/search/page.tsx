'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Fish, ShoppingBag, Globe, Award, FileText, BookOpen, BarChart2, TrendingUp, AlertCircle, Clock, X, Eye, Database, Layers,  } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminSearch, fetchSearchAnalytics,
  type SemanticSearchResult, type SearchAnalytics,
} from '@/lib/supabase/semanticSearch';
import Icon from '@/components/ui/AppIcon';


// ---- Type config ----

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  species: { label: 'Species', icon: Fish, color: 'text-ocean-900', bg: 'bg-ocean-900/10' },
  product: { label: 'Product', icon: ShoppingBag, color: 'text-teal-700', bg: 'bg-teal-50' },
  market: { label: 'Market', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50' },
  certification: { label: 'Certification', icon: Award, color: 'text-green-700', bg: 'bg-green-50' },
  document: { label: 'Document', icon: FileText, color: 'text-amber-700', bg: 'bg-amber-50' },
  knowledge_entity: { label: 'KG Entity', icon: BookOpen, color: 'text-indigo-700', bg: 'bg-indigo-50' },
};

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  under_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-slate-100 text-slate-600',
  unverified: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700',
  obsolete: 'bg-slate-100 text-slate-400',
  suggested: 'bg-blue-100 text-blue-600',
  private: 'bg-purple-100 text-purple-700',
  confidential: 'bg-red-100 text-red-600',
};

// ---- Result row ----

function AdminResultRow({ result }: { result: SemanticSearchResult }) {
  const cfg = TYPE_CONFIG[result.object_type] || TYPE_CONFIG.species;
  const Icon = cfg.icon;
  const statusClass = STATUS_COLORS[result.status] || STATUS_COLORS.unverified;

  return (
    <div className="flex items-center gap-4 bg-card rounded-xl border border-border p-3.5 hover:border-secondary/20 transition-colors">
      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon size={14} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{result.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusClass} shrink-0`}>
            {result.status}
          </span>
        </div>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground italic truncate mt-0.5">{result.subtitle}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-muted-foreground">
            Match: <span className="font-medium">{result.match_type}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Score: <span className="font-mono">{result.relevance_score.toFixed(2)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Analytics panel ----

function AnalyticsPanel({ analytics }: { analytics: SearchAnalytics | null }) {
  if (!analytics) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Searches', value: analytics.totalSearches, icon: Search, color: 'text-ocean-900' },
          { label: 'Unique Queries', value: analytics.uniqueQueries, icon: Layers, color: 'text-teal-700' },
          { label: 'Zero Results', value: analytics.zeroResultCount, icon: AlertCircle, color: 'text-amber-600' },
          { label: 'Avg Results', value: '—', icon: BarChart2, color: 'text-blue-700' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={stat.color} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top queries */}
      {analytics.topQueries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-secondary" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Queries</h3>
          </div>
          <div className="space-y-2">
            {analytics.topQueries.map((q, i) => (
              <div key={q.query} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-sm text-foreground font-mono">{q.query}</span>
                </div>
                <span className="text-xs text-muted-foreground">{q.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zero result queries */}
      {analytics.zeroResultQueries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-amber-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zero-Result Queries</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">These queries returned no results — consider adding synonyms or content.</p>
          <div className="space-y-2">
            {analytics.zeroResultQueries.slice(0, 8).map((q) => (
              <div key={q.query} className="flex items-center justify-between">
                <span className="text-sm text-foreground font-mono">{q.query}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{q.locale}</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{q.frequency}×</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent searches */}
      {analytics.recentSearches.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</h3>
          </div>
          <div className="space-y-1.5">
            {analytics.recentSearches.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground font-mono">{s.query}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{s.locale}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main page ----

export default function AdminKnowledgeSearchPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeType, setActiveType] = useState('all');
  const [includePrivate, setIncludePrivate] = useState(true);
  const [includeDraft, setIncludeDraft] = useState(true);
  const [activeTab, setActiveTab] = useState<'search' | 'analytics'>('search');
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const isAdmin = profile?.role === 'administrator' || profile?.role === 'super_admin';
  const isReviewer = profile?.role === 'reviewer' || isAdmin;

  const doSearch = useCallback(async (q: string, pg = 1) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const res = await adminSearch(q, {
      includePrivate,
      includeDraft,
      page: pg,
      pageSize: 20,
    });
    if (pg === 1) {
      setResults(res.results);
    } else {
      setResults((prev) => [...prev, ...res.results]);
    }
    setHasMore(res.hasMore);
    setPage(pg);
    setLoading(false);
  }, [includePrivate, includeDraft]);

  const loadAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setAnalyticsLoading(true);
    const data = await fetchSearchAnalytics();
    setAnalytics(data);
    setAnalyticsLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, loadAnalytics]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveType('all');
    doSearch(query);
  };

  const filteredResults = activeType === 'all' ? results : results.filter((r) => r.object_type === activeType);
  const typeCounts: Record<string, number> = {};
  results.forEach((r) => { typeCounts[r.object_type] = (typeCounts[r.object_type] || 0) + 1; });

  if (!isReviewer) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center p-8">
            <AlertCircle size={40} className="text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-sm">This page requires reviewer or administrator access.</p>
            <Link href="/knowledge/search" className="mt-4 inline-block text-sm text-secondary hover:underline">
              Use public search instead
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
          <ChevronRight size={12} />
          <Link href="/admin/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Search</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Admin</p>
            <h1 className="text-3xl font-bold text-foreground mb-1">Knowledge Search</h1>
            <p className="text-muted-foreground text-sm">
              Extended search including drafts, private content and all statuses.
              {isAdmin ? ' Full admin access.' : ' Reviewer access.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <span className="text-xs bg-ocean-900 text-white px-2.5 py-1 rounded-full">Administrator</span>
            )}
            {!isAdmin && isReviewer && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Reviewer</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {[
            { key: 'search', label: 'Search', icon: Search },
            ...(isAdmin ? [{ key: 'analytics', label: 'Analytics', icon: BarChart2 }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'search' | 'analytics')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-secondary text-secondary' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'search' && (
          <div className="flex gap-6">
            {/* Main search */}
            <div className="flex-1 min-w-0">
              {/* Search form */}
              <form onSubmit={handleSubmit} className="mb-5">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search all knowledge including drafts and private content…"
                      className="w-full pl-10 pr-10 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60 transition-colors"
                      autoFocus
                    />
                    {query && (
                      <button type="button" onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button type="submit" className="px-5 py-3 bg-ocean-900 text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors shrink-0">
                    Search
                  </button>
                </div>

                {/* Admin filters */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-secondary" />
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Eye size={12} /> Include private
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeDraft} onChange={(e) => setIncludeDraft(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-secondary" />
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Database size={12} /> Include drafts
                    </span>
                  </label>
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Admin search — not accessible to public
                  </span>
                </div>
              </form>

              {/* Loading */}
              {loading && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-3.5 animate-pulse h-16" />
                  ))}
                </div>
              )}

              {/* Results */}
              {!loading && searched && (
                <>
                  {/* Type tabs */}
                  {results.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button onClick={() => setActiveType('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeType === 'all' ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
                        All ({results.length})
                      </button>
                      {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                        const cfg = TYPE_CONFIG[type];
                        if (!cfg) return null;
                        return (
                          <button key={type} onClick={() => setActiveType(activeType === type ? 'all' : type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${activeType === type ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
                            <cfg.icon size={11} />
                            {cfg.label} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mb-3">
                    {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for "{query}"
                  </p>

                  {filteredResults.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-2xl border border-border">
                      <Search size={28} className="text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-semibold text-foreground mb-1">No results found</p>
                      <p className="text-xs text-muted-foreground">Try different keywords or check spelling.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredResults.map((r) => <AdminResultRow key={`${r.object_type}-${r.object_id}`} result={r} />)}
                    </div>
                  )}

                  {hasMore && (
                    <div className="mt-5 text-center">
                      <button onClick={() => doSearch(query, page + 1)} disabled={loading}
                        className="px-5 py-2 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}

              {!searched && (
                <div className="text-center py-16 bg-card rounded-2xl border border-border">
                  <Search size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground mb-1">Admin Knowledge Search</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Search across all entities including drafts, private documents, and under-review content.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar: quick links */}
            <aside className="w-56 xl:w-64 shrink-0 hidden lg:block space-y-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quick Access</h3>
                <div className="space-y-1.5">
                  {[
                    { label: 'Entities', href: '/admin/knowledge/entities' },
                    { label: 'Claims', href: '/admin/knowledge/claims' },
                    { label: 'Relations', href: '/admin/knowledge/relations' },
                    { label: 'Sources', href: '/admin/knowledge/sources' },
                    { label: 'Conflicts', href: '/admin/knowledge/conflicts' },
                    { label: 'Documents', href: '/admin/knowledge/documents' },
                    { label: 'Certifications', href: '/admin/knowledge/certifications' },
                    { label: 'Markets', href: '/admin/knowledge/markets' },
                    { label: 'Products', href: '/admin/knowledge/products' },
                  ].map((link) => (
                    <Link key={link.href} href={link.href}
                      className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      {link.label}
                      <ChevronRight size={11} />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800">Admin Only</span>
                </div>
                <p className="text-xs text-amber-700">
                  This search includes private, draft and confidential content. Results are not accessible to public users.
                </p>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'analytics' && isAdmin && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Search Analytics</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Aggregated search data — no personal information stored.
                </p>
              </div>
              <button onClick={loadAnalytics} disabled={analyticsLoading}
                className="text-xs text-secondary hover:underline disabled:opacity-50">
                {analyticsLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <AnalyticsPanel analytics={analyticsLoading ? null : analytics} />
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
