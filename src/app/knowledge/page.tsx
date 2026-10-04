'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Fish, ShoppingBag, Package, Globe, Award, FileText, Search, BookOpen, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, ArrowRight, Layers, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchKnowledgeStats, encyclopediaSearch, type SearchResult } from '@/lib/supabase/encyclopediaQueries';
import Icon from '@/components/ui/AppIcon';


const EXAMPLE_QUERIES = [
  'Octopus vulgaris', 'frozen sardine', 'IQF shrimp', 'MSC certification',
  'Atlantic salmon', 'squid rings', 'halal certificate', 'technical sheet',
];

const SECTIONS = [
  {
    href: '/species',
    label: 'Species Center',
    icon: Fish,
    color: 'bg-ocean-900',
    accent: 'border-teal-500/30',
    desc: 'Scientific names, multilingual names, FAO codes, taxonomy, associated media and products.',
    stat_key: 'species',
    stat_label: 'species documented',
  },
  {
    href: '/products',
    label: 'Product Center',
    icon: ShoppingBag,
    color: 'bg-ocean-700',
    accent: 'border-secondary/30',
    desc: 'Commercial products linked to species, presentations, processing methods and markets.',
    stat_key: 'products',
    stat_label: 'products indexed',
  },
  {
    href: '/packaging',
    label: 'Packaging Center',
    icon: Package,
    color: 'bg-teal-500',
    accent: 'border-teal-400/30',
    desc: 'Packaging configurations with weights, units, cartons, pallets and labeling languages.',
    stat_key: 'packaging',
    stat_label: 'configurations',
  },
  {
    href: '/markets',
    label: 'Market Center',
    icon: Globe,
    color: 'bg-ocean-600',
    accent: 'border-ocean-500/30',
    desc: 'Retail, wholesale, foodservice and regional markets with verified product links.',
    stat_key: 'markets',
    stat_label: 'markets referenced',
  },
  {
    href: '/certifications',
    label: 'Certification Center',
    icon: Award,
    color: 'bg-green-700',
    accent: 'border-green-500/30',
    desc: 'Quality, sustainability, religious and food safety certifications with claim status.',
    stat_key: 'certifications',
    stat_label: 'certifications',
  },
  {
    href: '/documents',
    label: 'Document Center',
    icon: FileText,
    color: 'bg-slate-700',
    accent: 'border-slate-500/30',
    desc: 'Public technical sheets, health certificates, labels and inspection reports.',
    stat_key: 'documents',
    stat_label: 'public documents',
  },
];

const STATUS_LEGEND = [
  { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  { label: 'Under Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  { label: 'Source Available', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: BookOpen },
  { label: 'Demo', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Layers },
  { label: 'Disputed', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
];

const TYPE_COLORS: Record<string, string> = {
  species: 'bg-ocean-900 text-white',
  product: 'bg-ocean-700 text-white',
  packaging: 'bg-teal-500 text-white',
  market: 'bg-ocean-600 text-white',
  certification: 'bg-green-700 text-white',
  document: 'bg-slate-700 text-white',
};

const TYPE_HREFS: Record<string, (r: SearchResult) => string> = {
  species: (r) => `/species/${r.slug}`,
  product: (r) => `/products/${r.slug}`,
  market: (r) => `/markets/${r.slug}`,
  certification: (r) => `/certifications/${r.slug}`,
  document: () => '/documents',
  packaging: () => '/packaging',
};

export default function KnowledgePage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchKnowledgeStats().then((s) => { setStats(s); setStatsLoading(false); });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await encyclopediaSearch(searchQuery, 20);
      setSearchResults(results);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative bg-ocean-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #0EA5D4 0%, transparent 60%), radial-gradient(circle at 80% 20%, #C9A84C 0%, transparent 50%)' }} />
        <div className="relative max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-32 pb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-teal-400">Seafood Vision</span>
              <ChevronRight size={12} className="text-teal-400/60" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Knowledge Encyclopedia</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              Seafood Knowledge<br />
              <span className="text-teal-400">Encyclopedia</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl mb-8">
              A structured, sourced and human-validated reference for seafood species, commercial products, packaging, markets, certifications and documents.
            </p>

            {/* Search */}
            <div className="relative max-w-2xl">
              <div className="flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden focus-within:border-teal-400/60 transition-colors">
                <Search size={18} className="ml-4 text-white/50 shrink-0" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search species, products, certifications, markets…"
                  className="flex-1 bg-transparent px-3 py-4 text-white placeholder-white/40 outline-none text-sm"
                />
                {searchQuery && (
                  <Link
                    href={`/knowledge/search?q=${encodeURIComponent(searchQuery)}`}
                    className="mr-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Search
                  </Link>
                )}
              </div>

              {/* Inline results */}
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-border shadow-xl z-20 overflow-hidden max-h-80 overflow-y-auto">
                  {searching ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No results for "{searchQuery}"</div>
                  ) : (
                    <>
                      {searchResults.map((r) => {
                        const href = TYPE_HREFS[r.type]?.(r) ?? '/knowledge/search';
                        return (
                          <Link
                            key={r.id}
                            href={href}
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-0"
                          >
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[r.type]}`}>{r.type}</span>
                            <span className="text-sm text-foreground font-medium flex-1 truncate">{r.title}</span>
                            {r.subtitle && <span className="text-xs text-muted-foreground italic truncate max-w-[120px]">{r.subtitle}</span>}
                            {r.is_demo && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Demo</span>}
                          </Link>
                        );
                      })}
                      <Link
                        href={`/knowledge/search?q=${encodeURIComponent(searchQuery)}`}
                        className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-secondary font-medium hover:bg-muted transition-colors"
                      >
                        View all results <ArrowRight size={14} />
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Example queries */}
            <div className="flex flex-wrap gap-2 mt-4">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setSearchQuery(q)}
                  className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-full border border-white/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 py-14">

        {/* Section cards */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Explore the Encyclopedia</h2>
            <Link href="/knowledge/methodology" className="text-sm text-secondary font-medium hover:underline flex items-center gap-1">
              Methodology <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const count = stats[s.stat_key];
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`group relative rounded-2xl border ${s.accent} bg-card overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
                >
                  <div className={`${s.color} px-5 pt-5 pb-8`}>
                    <Icon size={22} className="text-white mb-2" />
                    <div className="text-white font-bold text-lg leading-tight">{s.label}</div>
                    {!statsLoading && count !== undefined && (
                      <div className="text-white/60 text-xs mt-1 font-mono-data">{count} {s.stat_label}</div>
                    )}
                  </div>
                  <div className="px-5 py-4 -mt-4 bg-card rounded-t-2xl relative">
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-secondary font-semibold group-hover:gap-2 transition-all">
                      Explore <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Status legend */}
        <div className="mb-14 bg-card rounded-2xl border border-border p-6">
          <h2 className="text-base font-bold text-foreground mb-4">Knowledge Status Legend</h2>
          <div className="flex flex-wrap gap-3">
            {STATUS_LEGEND.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${s.color}`}>
                  <Icon size={12} />
                  {s.label}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            All public data is sourced, traceable and subject to human validation. No information is presented as definitive without a verified source. Data marked <strong>Demo</strong> is for platform preview only and excluded from real statistics.
          </p>
        </div>

        {/* Institutional links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: '/knowledge/methodology', label: 'Methodology', desc: 'How data is prepared and validated', icon: BookOpen },
            { href: '/knowledge/sources', label: 'Sources & Trust', desc: 'Public source references and reliability', icon: Layers },
            { href: '/knowledge/search', label: 'Advanced Search', desc: 'Search across all entity types', icon: Search },
            { href: '/knowledge/disclaimer', label: 'Disclaimer', desc: 'Professional use notice and limitations', icon: AlertCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border hover:border-secondary/40 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
