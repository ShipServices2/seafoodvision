'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Fish, ShoppingBag, Package, Globe, Award, FileText, Search, ChevronRight, CircleCheck as CheckCircle, Clock, Compass, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchDiscoverData, type DiscoverSection } from '@/lib/supabase/semanticSearch';
import Icon from '@/components/ui/AppIcon';


// ---- Category config ----

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  Fish: { emoji: '🐟', color: 'text-blue-700', bg: 'bg-blue-50' },
  Crustaceans: { emoji: '🦐', color: 'text-orange-700', bg: 'bg-orange-50' },
  Cephalopods: { emoji: '🐙', color: 'text-purple-700', bg: 'bg-purple-50' },
  Molluscs: { emoji: '🦪', color: 'text-teal-700', bg: 'bg-teal-50' },
  'Fillets & Portions': { emoji: '🍣', color: 'text-red-700', bg: 'bg-red-50' },
  'Frozen Products': { emoji: '🧊', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  Packaging: { emoji: '📦', color: 'text-slate-700', bg: 'bg-slate-100' },
  Aquaculture: { emoji: '🌊', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const EXPLORE_SECTIONS = [
  { label: 'Species', href: '/species', icon: Fish, color: 'text-ocean-900', bg: 'bg-ocean-900/10', desc: 'Browse all seafood species with scientific names and multilingual names' },
  { label: 'Products', href: '/products', icon: ShoppingBag, color: 'text-teal-700', bg: 'bg-teal-50', desc: 'Commercial products with forms, processing methods and markets' },
  { label: 'Packaging', href: '/packaging', icon: Package, color: 'text-slate-700', bg: 'bg-slate-100', desc: 'Packaging configurations, weights, and market associations' },
  { label: 'Markets', href: '/markets', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50', desc: 'Country, regional and trade markets with product links' },
  { label: 'Certifications', href: '/certifications', icon: Award, color: 'text-green-700', bg: 'bg-green-50', desc: 'Quality, sustainability, religious and regulatory certifications' },
  { label: 'Documents', href: '/documents', icon: FileText, color: 'text-amber-700', bg: 'bg-amber-50', desc: 'Public technical sheets, certificates and reference documents' },
];

// ---- Species card ----

function SpeciesCard({ species }: { species: any }) {
  return (
    <Link
      href={`/species/${species.slug}`}
      className="group flex items-center gap-3 bg-card rounded-xl border border-border p-3.5 hover:border-secondary/40 hover:shadow-sm transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-xl bg-ocean-900/10 flex items-center justify-center shrink-0">
        <Fish size={16} className="text-ocean-900" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-secondary transition-colors">
          {species.common_name}
        </p>
        <p className="text-xs text-muted-foreground italic truncate">{species.scientific_name}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {species.is_validated && <CheckCircle size={12} className="text-green-600" />}
        <ChevronRight size={13} className="text-muted-foreground group-hover:text-secondary transition-colors" />
      </div>
    </Link>
  );
}

// ---- Recently updated card ----

function RecentCard({ item }: { item: any }) {
  const catCfg = CATEGORY_CONFIG[item.category] || { emoji: '🐠', color: 'text-ocean-900', bg: 'bg-ocean-900/10' };
  return (
    <Link
      href={`/species/${item.slug}`}
      className="group flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 px-2 rounded-lg transition-colors"
    >
      <span className="text-lg shrink-0">{catCfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-secondary transition-colors">
          {item.common_name}
        </p>
        <p className="text-xs text-muted-foreground italic truncate">{item.scientific_name}</p>
      </div>
      <Clock size={11} className="text-muted-foreground shrink-0" />
    </Link>
  );
}

// ---- Market card ----

function MarketCard({ market }: { market: any }) {
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="group flex items-center gap-3 bg-card rounded-xl border border-border p-3.5 hover:border-secondary/40 hover:shadow-sm transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
        <Globe size={16} className="text-blue-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-secondary transition-colors">
          {market.name}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{market.market_type?.replace(/_/g, ' ')}</p>
      </div>
      <ChevronRight size={13} className="text-muted-foreground shrink-0 group-hover:text-secondary transition-colors" />
    </Link>
  );
}

// ---- Certification card ----

function CertCard({ cert }: { cert: any }) {
  return (
    <Link
      href={`/certifications/${cert.slug}`}
      className="group flex items-center gap-3 bg-card rounded-xl border border-border p-3.5 hover:border-secondary/40 hover:shadow-sm transition-all duration-200"
    >
      <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
        <Award size={16} className="text-green-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-secondary transition-colors">
          {cert.name}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{cert.certification_type?.replace(/_/g, ' ')}</p>
      </div>
      <ChevronRight size={13} className="text-muted-foreground shrink-0 group-hover:text-secondary transition-colors" />
    </Link>
  );
}

// ---- Main page ----

export default function DiscoverPage() {
  const [data, setData] = useState<DiscoverSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDiscoverData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">

        {/* Hero */}
        <section className="bg-gradient-to-br from-ocean-900 via-ocean-800 to-teal-800 text-white py-16 px-4">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
            <div className="flex items-center gap-2 mb-4">
              <Compass size={20} className="text-teal-300" />
              <span className="text-xs font-semibold uppercase tracking-widest text-teal-300">Discovery</span>
            </div>
            <h1 className="text-4xl font-bold mb-3">Explore the Seafood Encyclopedia</h1>
            <p className="text-ocean-100 text-lg mb-8 max-w-2xl">
              Navigate species, products, packaging, markets and certifications — all sourced and structured.
            </p>
            <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search species, products, certifications…"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/50 outline-none focus:border-white/40 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-white text-ocean-900 rounded-xl text-sm font-semibold hover:bg-ocean-50 transition-colors shrink-0"
              >
                Search
              </button>
            </form>
          </div>
        </section>

        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-12 space-y-14">

          {/* Explore sections */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Browse by type</p>
                <h2 className="text-2xl font-bold text-foreground">Explore the Catalog</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {EXPLORE_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <Link
                    key={section.label}
                    href={section.href}
                    className="group flex flex-col items-center gap-3 bg-card rounded-2xl border border-border p-5 hover:border-secondary/40 hover:shadow-md transition-all duration-200 text-center"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${section.bg} flex items-center justify-center`}>
                      <Icon size={22} className={section.color} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-secondary transition-colors">
                        {section.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 hidden sm:block">
                        {section.desc}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground group-hover:text-secondary transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recently verified + Recently updated */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Recently verified */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Validated data</p>
                  <h2 className="text-xl font-bold text-foreground">Recently Verified</h2>
                </div>
                <Link href="/species?verified=true" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-3.5 animate-pulse">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 bg-muted rounded-xl" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-muted rounded w-2/3" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : data?.recentlyVerified.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <CheckCircle size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No verified entries yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Verified data will appear here once validated.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.recentlyVerified.map((s) => <SpeciesCard key={s.object_id} species={{ slug: s.slug, common_name: s.title, scientific_name: s.subtitle, is_validated: true }} />)}
                </div>
              )}
            </section>

            {/* Recently updated */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Latest activity</p>
                  <h2 className="text-xl font-bold text-foreground">Recently Updated</h2>
                </div>
                <Link href="/species" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div className="bg-card rounded-xl border border-border p-4 space-y-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3 py-2.5 animate-pulse">
                      <div className="w-6 h-6 bg-muted rounded" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3.5 bg-muted rounded w-1/2" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : data?.recentlyUpdated.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <Clock size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent updates.</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-4">
                  {data?.recentlyUpdated.map((s: any) => <RecentCard key={s.id} item={s} />)}
                </div>
              )}
            </section>
          </div>

          {/* Explore by category */}
          {(!loading && data?.speciesCategories && data.speciesCategories.length > 0) && (
            <section>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Browse by category</p>
                <h2 className="text-2xl font-bold text-foreground">Explore by Species Category</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.speciesCategories.map(({ category, count }) => {
                  const cfg = CATEGORY_CONFIG[category] || { emoji: '🐠', color: 'text-ocean-900', bg: 'bg-ocean-900/10' };
                  return (
                    <Link
                      key={category}
                      href={`/species?category=${encodeURIComponent(category)}`}
                      className="group flex flex-col items-center gap-2 bg-card rounded-2xl border border-border p-4 hover:border-secondary/40 hover:shadow-sm transition-all duration-200 text-center"
                    >
                      <span className="text-3xl">{cfg.emoji}</span>
                      <p className="text-sm font-semibold text-foreground group-hover:text-secondary transition-colors">{category}</p>
                      <p className="text-xs text-muted-foreground">{count} species</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Markets + Certifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Markets */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Trade & distribution</p>
                  <h2 className="text-xl font-bold text-foreground">Explore by Market</h2>
                </div>
                <Link href="/markets" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-3.5 animate-pulse h-14" />
                  ))}
                </div>
              ) : data?.markets.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <Globe size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No markets available yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.markets.map((m) => <MarketCard key={m.id} market={m} />)}
                </div>
              )}
            </section>

            {/* Certifications */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">Quality & compliance</p>
                  <h2 className="text-xl font-bold text-foreground">Explore by Certification</h2>
                </div>
                <Link href="/certifications" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border p-3.5 animate-pulse h-14" />
                  ))}
                </div>
              ) : data?.certifications.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <Award size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No certifications available yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.certifications.map((c) => <CertCard key={c.id} cert={c} />)}
                </div>
              )}
            </section>
          </div>

          {/* CTA */}
          <section className="bg-gradient-to-r from-ocean-900 to-teal-800 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-2">Can't find what you're looking for?</h2>
            <p className="text-ocean-100 mb-6 max-w-lg mx-auto">
              Use the full semantic search to find species, products, certifications and documents by name, synonym or translation.
            </p>
            <Link
              href="/knowledge/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-ocean-900 rounded-xl text-sm font-semibold hover:bg-ocean-50 transition-colors"
            >
              <Search size={16} />
              Open Search
            </Link>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
}
