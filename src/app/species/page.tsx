'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, ChevronRight, CheckCircle, ArrowRight, X, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchEncSpeciesList, type EncSpecies } from '@/lib/supabase/encyclopediaQueries';

const CATEGORIES = ['Fish', 'Crustaceans', 'Cephalopods', 'Molluscs', 'Aquaculture'];
const PAGE_SIZE = 24;

const SPECIES_COLORS: Record<string, string> = {
  Fish: 'from-blue-100 to-blue-50',
  Crustaceans: 'from-orange-100 to-orange-50',
  Cephalopods: 'from-purple-100 to-purple-50',
  Molluscs: 'from-teal-100 to-teal-50',
  Aquaculture: 'from-green-100 to-green-50',
};
const SPECIES_EMOJI: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪', Aquaculture: '🌊',
};

function SpeciesCard({ species }: { species: EncSpecies }) {
  const color = SPECIES_COLORS[species.category || ''] || 'from-slate-100 to-slate-50';
  const emoji = SPECIES_EMOJI[species.category || ''] || '🐠';
  return (
    <Link
      href={`/species/${species.slug}`}
      className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className={`h-28 bg-gradient-to-br ${color} flex items-center justify-center relative`}>
        <span className="text-5xl">{emoji}</span>
        <div className="absolute top-2 right-2 flex gap-1">
          {species.is_validated && (
            <span className="flex items-center gap-0.5 text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
              <CheckCircle size={9} /> Verified
            </span>
          )}
          {species.is_demo && (
            <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">Demo</span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground text-sm leading-tight">{species.common_name}</h3>
        <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5 truncate">{species.scientific_name}</p>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {species.family && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{species.family}</span>
          )}
          {species.category && (
            <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{species.category}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-secondary font-medium group-hover:gap-2 transition-all">
          View species <ArrowRight size={11} />
        </div>
      </div>
    </Link>
  );
}

export default function SpeciesPage() {
  const [speciesList, setSpeciesList] = useState<EncSpecies[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchEncSpeciesList({
      page, pageSize: PAGE_SIZE, search: debouncedSearch, category: category || undefined, verifiedOnly,
    });
    setSpeciesList(result.data);
    setTotal(result.total);
    setLoading(false);
  }, [page, debouncedSearch, category, verifiedOnly]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!category || verifiedOnly;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Species</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Species Center</p>
          <h1 className="text-3xl font-bold text-foreground mb-2">Seafood Species Encyclopedia</h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm">
            Documented seafood species with scientific names, multilingual names, FAO codes, taxonomy, associated products and media.
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, scientific name, family…"
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters || hasFilters ? 'bg-secondary/10 border-secondary/40 text-secondary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasFilters && <span className="w-4 h-4 bg-secondary text-white rounded-full text-xs flex items-center justify-center">!</span>}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategory('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!category ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                >All</button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(category === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${category === c ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="verified-only"
                checked={verifiedOnly}
                onChange={(e) => { setVerifiedOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4 accent-secondary"
              />
              <label htmlFor="verified-only" className="text-sm text-foreground cursor-pointer">Verified only</label>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setCategory(''); setVerifiedOnly(false); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted-foreground mb-4">
            {total > 0 ? `${total} species found` : 'No species found'}
            {debouncedSearch && ` for "${debouncedSearch}"`}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="h-28 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : speciesList.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <p className="text-4xl mb-4">🐟</p>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {debouncedSearch ? 'No species match your search' : 'Species catalog building in progress'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {debouncedSearch ? 'Try a different search term or remove filters.' : 'Our professional seafood species library is being prepared.'}
            </p>
            {(debouncedSearch || hasFilters) && (
              <button onClick={() => { setSearch(''); setCategory(''); setVerifiedOnly(false); }} className="mt-4 px-4 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-border transition-colors">
                Clear all
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {speciesList.map((sp) => <SpeciesCard key={sp.id} species={sp} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
