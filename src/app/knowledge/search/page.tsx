'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, ChevronRight, Fish, ShoppingBag, Package, Globe, Award, FileText,
  X, Filter, CheckCircle, Clock, AlertTriangle, Layers, Image, BookOpen,
  ArrowRight, Sparkles, TrendingUp,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  semanticSearch, autocompleteSearch, getSearchSuggestions, getRelatedSearches, getSearchFacets,
  type SemanticSearchResult, type AutocompleteResult, type SearchSuggestion,
  type RelatedSearch, type FacetGroup,
} from '@/lib/supabase/semanticSearch';
import Icon from '@/components/ui/AppIcon';


// ---- Config ----

const TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  href: (r: SemanticSearchResult) => string;
}> = {
  species: { label: 'Species', icon: Fish, color: 'text-ocean-900', bg: 'bg-ocean-900/10', href: (r) => r.slug ? `/species/${r.slug}` : '/species' },
  product: { label: 'Product', icon: ShoppingBag, color: 'text-teal-700', bg: 'bg-teal-50', href: (r) => r.slug ? `/products/${r.slug}` : '/products' },
  packaging: { label: 'Packaging', icon: Package, color: 'text-slate-700', bg: 'bg-slate-100', href: () => '/packaging' },
  market: { label: 'Market', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50', href: (r) => r.slug ? `/markets/${r.slug}` : '/markets' },
  certification: { label: 'Certification', icon: Award, color: 'text-green-700', bg: 'bg-green-50', href: (r) => r.slug ? `/certifications/${r.slug}` : '/certifications' },
  document: { label: 'Document', icon: FileText, color: 'text-amber-700', bg: 'bg-amber-50', href: () => '/documents' },
  media: { label: 'Media', icon: Image, color: 'text-purple-700', bg: 'bg-purple-50', href: (r) => r.slug ? `/asset/${r.slug}` : '/library' },
  knowledge_entity: { label: 'Knowledge', icon: BookOpen, color: 'text-indigo-700', bg: 'bg-indigo-50', href: (r) => r.slug ? `/admin/knowledge/entities/${r.object_id}` : '/knowledge' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  verified: { label: 'Verified', icon: CheckCircle, color: 'text-green-600' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-amber-600' },
  unverified: { label: 'Unverified', icon: AlertTriangle, color: 'text-slate-400' },
  draft: { label: 'Draft', icon: Clock, color: 'text-slate-400' },
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  exact: 'Exact match',
  scientific_name: 'Scientific name',
  commercial_name: 'Commercial name',
  local_name: 'Local name',
  synonym: 'Synonym',
  translation: 'Translation',
  keyword: 'Keyword',
  description: 'Description',
  related_entity: 'Related',
  fuzzy: 'Similar',
};

const EXAMPLE_QUERIES = [
  'Octopus vulgaris', 'poulpe', 'IQF shrimp', 'frozen sardine',
  'HGT mackerel', 'cephalopod packaging', 'halal certificate',
  'Portugal', '20 kg carton', 'technical sheet tuna',
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
];

// ---- Result Card ----

function ResultCard({ result }: { result: SemanticSearchResult }) {
  const cfg = TYPE_CONFIG[result.object_type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const href = cfg.href(result);
  const statusCfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.unverified;
  const StatusIcon = statusCfg.icon;
  const matchLabel = MATCH_TYPE_LABELS[result.match_type] || result.match_type;

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 bg-card rounded-xl border border-border p-4 hover:border-secondary/40 hover:shadow-md transition-all duration-200"
    >
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon size={18} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground group-hover:text-secondary transition-colors truncate">
                {result.title}
              </span>
              {result.status === 'verified' && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full shrink-0">
                  <CheckCircle size={10} />
                  Verified
                </span>
              )}
            </div>
            {result.subtitle && (
              <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{result.subtitle}</p>
            )}
            {result.excerpt && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{result.excerpt}</p>
            )}
          </div>
          <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1 group-hover:text-secondary transition-colors" />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-muted-foreground">{matchLabel}</span>
          {result.relevance_score >= 0.9 && (
            <span className="text-xs text-amber-600 flex items-center gap-0.5">
              <Sparkles size={10} />
              Best match
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Autocomplete Dropdown ----

function AutocompleteDropdown({
  suggestions,
  onSelect,
  visible,
}: {
  suggestions: AutocompleteResult[];
  onSelect: (s: AutocompleteResult) => void;
  visible: boolean;
}) {
  if (!visible || suggestions.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      {suggestions.map((s) => {
        const cfg = TYPE_CONFIG[s.object_type] || TYPE_CONFIG.species;
        const Icon = cfg.icon;
        return (
          <button
            key={`${s.object_type}-${s.object_id}`}
            onClick={() => onSelect(s)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
              <Icon size={13} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-foreground font-medium truncate block">{s.title}</span>
              {s.subtitle && <span className="text-xs text-muted-foreground italic truncate block">{s.subtitle}</span>}
            </div>
            {s.is_verified && <CheckCircle size={12} className="text-green-600 shrink-0" />}
            <span className={`text-xs ${cfg.color} shrink-0`}>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Facet Panel ----

function FacetPanel({
  facets,
  activeFacets,
  onToggle,
}: {
  facets: FacetGroup[];
  activeFacets: Record<string, string[]>;
  onToggle: (key: string, value: string) => void;
}) {
  if (facets.length === 0) return null;
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Layers size={12} />
        Facets
      </h3>
      {facets.map((group) => (
        <div key={group.key}>
          <p className="text-xs font-medium text-foreground mb-2">{group.label}</p>
          <div className="space-y-1.5">
            {group.options.slice(0, 6).map((opt) => {
              const isActive = activeFacets[group.key]?.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggle(group.key, opt.value)}
                  className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-ocean-900 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="capitalize">{opt.label}</span>
                  <span className={`text-xs ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Related Searches ----

function RelatedSearches({ items }: { items: RelatedSearch[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp size={12} />
        Related searches
      </h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ArrowRight size={11} className="shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---- Main Search Content ----

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams?.get('q') || '';
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeType, setActiveType] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [language, setLanguage] = useState('en');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Autocomplete
  const [acSuggestions, setAcSuggestions] = useState<AutocompleteResult[]>([]);
  const [acVisible, setAcVisible] = useState(false);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fuzzy suggestions
  const [fuzzySuggestions, setFuzzySuggestions] = useState<SearchSuggestion[]>([]);

  // Related searches
  const [relatedSearches, setRelatedSearches] = useState<RelatedSearch[]>([]);

  // Facets
  const [facets, setFacets] = useState<FacetGroup[]>([]);
  const [activeFacets, setActiveFacets] = useState<Record<string, string[]>>({});

  const doSearch = useCallback(async (q: string, pg = 1) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    setAcVisible(false);

    const [searchRes, suggestRes, facetRes] = await Promise.all([
      semanticSearch(q, {
        verifiedOnly,
        languageCode: language,
        page: pg,
        pageSize: 20,
      }),
      pg === 1 ? getSearchSuggestions(q) : Promise.resolve([]),
      pg === 1 ? getSearchFacets(q) : Promise.resolve([]),
    ]);

    if (pg === 1) {
      setResults(searchRes.results);
      setFuzzySuggestions(suggestRes);
      setFacets(facetRes);
    } else {
      setResults((prev) => [...prev, ...searchRes.results]);
    }
    setTotalCount(searchRes.total);
    setHasMore(searchRes.hasMore);
    setPage(pg);

    // Related searches (async, after results)
    if (pg === 1) {
      getRelatedSearches(q, searchRes.results).then(setRelatedSearches);
    }

    setLoading(false);
  }, [verifiedOnly, language]);

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
  }, [initialQ, doSearch]);

  // Autocomplete with debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (acTimer.current) clearTimeout(acTimer.current);
    if (val.length >= 2) {
      acTimer.current = setTimeout(async () => {
        const suggestions = await autocompleteSearch(val);
        setAcSuggestions(suggestions);
        setAcVisible(suggestions.length > 0);
      }, 200);
    } else {
      setAcSuggestions([]);
      setAcVisible(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveType('all');
      setActiveFacets({});
      router.push(`/knowledge/search?q=${encodeURIComponent(query.trim())}`);
      doSearch(query.trim());
    }
  };

  const handleAcSelect = (s: AutocompleteResult) => {
    const q = s.title;
    setQuery(q);
    setAcVisible(false);
    router.push(`/knowledge/search?q=${encodeURIComponent(q)}`);
    doSearch(q);
  };

  const handleFacetToggle = (key: string, value: string) => {
    setActiveFacets((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  // Filter results by type + facets
  const filteredResults = results.filter((r) => {
    if (activeType !== 'all' && r.object_type !== activeType) return false;
    return true;
  });

  const typeCounts: Record<string, number> = {};
  results.forEach((r) => { typeCounts[r.object_type] = (typeCounts[r.object_type] || 0) + 1; });

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setAcVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Search</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Semantic Search</p>
          <h1 className="text-3xl font-bold text-foreground mb-2">Search the Encyclopedia</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Search across species, products, packaging, markets, certifications and documents — in any language.
          </p>
        </div>

        {/* Search form */}
        <div className="mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3 max-w-3xl">
              <div className="relative flex-1" ref={autocompleteRef}>
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => acSuggestions.length > 0 && setAcVisible(true)}
                  placeholder="octopus frozen, poulpe, IQF shrimp, Portugal, halal certificate…"
                  className="w-full pl-10 pr-10 py-3.5 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60 transition-colors"
                  autoFocus
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setAcVisible(false); setResults([]); setSearched(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
                <AutocompleteDropdown
                  suggestions={acSuggestions}
                  onSelect={handleAcSelect}
                  visible={acVisible}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-ocean-900 text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors shrink-0"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3.5 rounded-xl text-sm font-medium border transition-colors shrink-0 flex items-center gap-2 ${
                  showFilters ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Filter size={14} />
                Filters
              </button>
            </div>
          </form>

          {/* Filter bar */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-3 max-w-3xl p-4 bg-card border border-border rounded-xl">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-secondary"
                />
                Verified only
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Language:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="text-xs bg-muted border border-border rounded-lg px-2 py-1 outline-none"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Fuzzy suggestions */}
        {!loading && searched && fuzzySuggestions.length > 0 && results.length === 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-3xl">
            <p className="text-sm text-amber-800 font-medium mb-2">Did you mean…</p>
            <div className="flex flex-wrap gap-2">
              {fuzzySuggestions.map((s) => (
                <button
                  key={s.suggestion}
                  onClick={() => {
                    setQuery(s.suggestion);
                    router.push(`/knowledge/search?q=${encodeURIComponent(s.suggestion)}`);
                    doSearch(s.suggestion);
                  }}
                  className="text-sm px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  {s.suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Example queries (before search) */}
        {!searched && (
          <div className="mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Example searches</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuery(q);
                    router.push(`/knowledge/search?q=${encodeURIComponent(q)}`);
                    doSearch(q);
                  }}
                  className="text-sm px-3 py-1.5 bg-card border border-border text-muted-foreground rounded-lg hover:text-foreground hover:border-secondary/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && page === 1 && (
          <div className="space-y-3 max-w-3xl">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-muted rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div className="flex gap-6">
            {/* Main results */}
            <div className="flex-1 min-w-0">
              {/* Type tabs */}
              {results.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  <button
                    onClick={() => setActiveType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      activeType === 'all' ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({results.length})
                  </button>
                  {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                    const cfg = TYPE_CONFIG[type];
                    if (!cfg) return null;
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveType(activeType === type ? 'all' : type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                          activeType === type ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <cfg.icon size={11} />
                        {cfg.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Result count */}
              <p className="text-xs text-muted-foreground mb-4">
                {filteredResults.length > 0
                  ? `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''} for "${initialQ || query}"`
                  : `No results for "${initialQ || query}"`}
              </p>

              {filteredResults.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-2xl border border-border">
                  <Search size={32} className="text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                    Try different keywords, check spelling, or browse the encyclopedia sections.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Species', 'Products', 'Markets', 'Certifications'].map((s) => (
                      <Link key={s} href={`/${s.toLowerCase()}`}
                        className="text-sm px-3 py-1.5 bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        Browse {s}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredResults.map((r) => <ResultCard key={`${r.object_type}-${r.object_id}`} result={r} />)}
                </div>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => doSearch(initialQ || query, page + 1)}
                    disabled={loading}
                    className="px-6 py-2.5 bg-card border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-secondary/40 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Load more results'}
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar: facets + related */}
            {(facets.length > 0 || relatedSearches.length > 0) && (
              <aside className="w-56 xl:w-64 shrink-0 hidden lg:block space-y-4">
                <FacetPanel facets={facets} activeFacets={activeFacets} onToggle={handleFacetToggle} />
                <RelatedSearches items={relatedSearches} />
              </aside>
            )}
          </div>
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
            <div className="h-14 bg-muted rounded-xl max-w-3xl" />
          </div>
        </main>
        <Footer />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
