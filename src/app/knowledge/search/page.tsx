'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, ChevronRight, Fish, ShoppingBag, Package, Globe, Award, FileText, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { encyclopediaSearch, type SearchResult } from '@/lib/supabase/encyclopediaQueries';
import Icon from '@/components/ui/AppIcon';


const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; href: (r: SearchResult) => string }> = {
  species: { label: 'Species', icon: Fish, color: 'bg-ocean-900 text-white', href: (r) => `/species/${r.slug}` },
  product: { label: 'Product', icon: ShoppingBag, color: 'bg-ocean-700 text-white', href: (r) => `/products/${r.slug}` },
  packaging: { label: 'Packaging', icon: Package, color: 'bg-teal-500 text-white', href: () => '/packaging' },
  market: { label: 'Market', icon: Globe, color: 'bg-ocean-600 text-white', href: (r) => `/markets/${r.slug}` },
  certification: { label: 'Certification', icon: Award, color: 'bg-green-700 text-white', href: (r) => `/certifications/${r.slug}` },
  document: { label: 'Document', icon: FileText, color: 'bg-slate-700 text-white', href: () => '/documents' },
};

const EXAMPLE_QUERIES = [
  'Octopus vulgaris', 'frozen sardine', 'IQF shrimp', 'MSC certification',
  'Atlantic salmon', 'squid rings', 'halal certificate', 'technical sheet',
  'Portugal', 'whole gutted', 'IQF', '20 kg carton',
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams?.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeType, setActiveType] = useState<string>('all');

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const res = await encyclopediaSearch(q, 50);
    setResults(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
  }, [initialQ, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/knowledge/search?q=${encodeURIComponent(query.trim())}`);
      doSearch(query.trim());
    }
  };

  const filteredResults = activeType === 'all' ? results : results.filter((r) => r.type === activeType);

  const typeCounts: Record<string, number> = {};
  results.forEach((r) => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Search</span>
        </nav>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Encyclopedia Search</p>
          <h1 className="text-3xl font-bold text-foreground mb-2">Search the Encyclopedia</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Search across species, products, packaging, markets, certifications and documents.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search species, products, certifications, markets…"
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60 transition-colors"
                autoFocus
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="px-6 py-3 bg-ocean-900 text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">
              Search
            </button>
          </div>
        </form>

        {/* Example queries */}
        {!searched && (
          <div className="mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Example searches</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); router.push(`/knowledge/search?q=${encodeURIComponent(q)}`); doSearch(q); }}
                  className="text-sm px-3 py-1.5 bg-card border border-border text-muted-foreground rounded-lg hover:text-foreground hover:border-secondary/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {!loading && searched && (
          <>
            {/* Type filter tabs */}
            {results.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setActiveType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeType === 'all' ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                >
                  All ({results.length})
                </button>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const cfg = TYPE_CONFIG[type];
                  if (!cfg) return null;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveType(activeType === type ? 'all' : type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeType === type ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {cfg.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-4">
              {filteredResults.length > 0
                ? `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''} for "${initialQ || query}"`
                : `No results for "${initialQ || query}"`}
            </p>

            {filteredResults.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Search size={32} className="text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Try different keywords or browse the encyclopedia sections.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['Species', 'Products', 'Markets', 'Certifications'].map((s) => (
                    <Link key={s} href={`/${s.toLowerCase()}`} className="text-sm px-3 py-1.5 bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                      Browse {s}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResults.map((r) => {
                  const cfg = TYPE_CONFIG[r.type];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  const href = cfg.href(r);
                  return (
                    <Link
                      key={r.id}
                      href={href}
                      className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 hover:border-secondary/40 hover:shadow-sm transition-all"
                    >
                      <div className={`w-8 h-8 rounded-lg ${cfg.color} flex items-center justify-center shrink-0`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{r.title}</span>
                          {r.is_demo && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">Demo</span>}
                        </div>
                        {r.subtitle && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{r.subtitle}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{cfg.label}</span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function KnowledgeSearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-12 bg-muted rounded-xl max-w-2xl" />
          </div>
        </main>
        <Footer />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
