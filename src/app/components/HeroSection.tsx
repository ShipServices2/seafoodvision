'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, CircleCheck as CheckCircle2, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const heroSuggestions = [
  'Atlantic mackerel fillet',
  'European sardine whole',
  'Giant squid frozen',
  'Tiger shrimp headless',
  'Common octopus fresh',
  'Yellowfin tuna steak',
  'Seabream vacuum packed',
];

interface CatalogStats {
  totalAssets: number | null;
  verifiedAssets: number | null;
  speciesCount: number | null;
  loading: boolean;
}

export default function HeroSection() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [stats, setStats] = useState<CatalogStats>({
    totalAssets: null,
    verifiedAssets: null,
    speciesCount: null,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient();

        const [assetsResult, verifiedResult, speciesResult] = await Promise.all([
          supabase
            .from('assets')
            .select('*', { count: 'exact', head: true })
            .eq('is_demo', false)
            .in('review_status', ['approved', 'commercial', 'editorial']),
          supabase
            .from('assets')
            .select('*', { count: 'exact', head: true })
            .eq('is_demo', false)
            .eq('is_verified', true)
            .in('review_status', ['approved', 'commercial', 'editorial']),
          supabase
            .from('species')
            .select('*', { count: 'exact', head: true })
            .eq('is_demo', false)
            .eq('is_validated', true),
        ]);

        setStats({
          totalAssets: assetsResult.count ?? 0,
          verifiedAssets: verifiedResult.count ?? 0,
          speciesCount: speciesResult.count ?? 0,
          loading: false,
        });
      } catch {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/library?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/library');
    }
  };

  const filteredSuggestions =
    query.length > 1
      ? heroSuggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      : heroSuggestions.slice(0, 5);

  const hasRealCatalog =
    !stats.loading && stats.totalAssets !== null && stats.totalAssets > 0;

  return (
    <section className="gradient-hero min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Decorative gradient orbs */}
      <div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, var(--teal-500) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-8"
        style={{ background: 'radial-gradient(circle, var(--gold-500) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 w-full">
        <div className="flex flex-col items-center text-center pt-24 pb-16">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/8 text-white/75 text-xs font-medium mb-8 backdrop-blur-sm">
            <Camera size={12} className="text-secondary" />
            Real photographs only — no AI-generated content
            <CheckCircle2 size={12} className="text-green-verified" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-extrabold text-white leading-[1.05] tracking-tight text-balance max-w-5xl mb-6">
            The World&apos;s Visual Library{' '}
            <span className="text-secondary">for Real Seafood</span>
          </h1>

          <p className="text-base sm:text-lg text-white/65 max-w-2xl mb-10 leading-relaxed">
            Verified real photographs of seafood products, scientifically named and professionally
            documented. For food industry, editorial, and research use worldwide.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="w-full max-w-2xl relative" role="search">
            <div
              className={`relative flex items-center bg-white rounded-xl hero-search-shadow transition-all duration-200 ${focused ? 'ring-2 ring-secondary' : ''}`}
            >
              <Search size={18} className="absolute left-4 text-muted-foreground shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Search by species, product form, scientific name…"
                className="w-full pl-12 pr-4 py-4 rounded-xl text-foreground text-base bg-transparent focus:outline-none placeholder:text-muted-foreground"
                aria-label="Search seafood visual library"
              />
              <button
                type="submit"
                className="absolute right-2 flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-ocean-800 transition-colors duration-150 active:scale-95"
              >
                Search
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {focused && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-card rounded-xl border border-border shadow-modal z-20 overflow-hidden">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={`suggestion-${suggestion}`}
                    type="button"
                    onMouseDown={() => {
                      setQuery(suggestion);
                      router.push(`/library?q=${encodeURIComponent(suggestion)}`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors duration-150 text-left"
                  >
                    <Search size={13} className="text-muted-foreground shrink-0" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Quick category links */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['Fish', 'Crustaceans', 'Cephalopods', 'Molluscs', 'Fillets & Portions', 'Frozen Products'].map(
              (cat) => (
                <a
                  key={`hero-cat-${cat}`}
                  href={`/library?category=${encodeURIComponent(cat)}`}
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/8 text-white/70 text-xs font-medium hover:bg-white/15 hover:text-white transition-all duration-150 backdrop-blur-sm"
                >
                  {cat}
                </a>
              )
            )}
          </div>

          {/* Dynamic stats or neutral message */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 mt-14 pt-10 border-t border-white/10 w-full max-w-2xl">
            {hasRealCatalog ? (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono-data">
                    {stats.totalAssets?.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    Catalog assets
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono-data">
                    {stats.verifiedAssets?.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    Verified assets
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono-data">
                    {stats.speciesCount?.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    Documented species
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono-data">
                    100%
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    Real photos
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1 col-span-2 sm:col-span-2">
                  <span className="text-sm sm:text-base font-semibold text-white/80 text-center">
                    Catalog building in progress
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider text-center">
                    Real seafood photography collection
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 col-span-2 sm:col-span-2">
                  <span className="text-sm sm:text-base font-semibold text-white/80 text-center">
                    Professional seafood content platform
                  </span>
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider text-center">
                    100% real photographs
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <path
            d="M0 40C180 80 360 0 540 40C720 80 900 0 1080 40C1260 80 1380 20 1440 40V80H0V40Z"
            fill="var(--background)"
          />
        </svg>
      </div>
    </section>
  );
}