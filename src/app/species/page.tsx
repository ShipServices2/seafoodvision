'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { fetchSpeciesList } from '@/lib/supabase/queries';
import type { Species } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const speciesEmoji: Record<string, { emoji: string; bgColor: string }> = {
  'sardina-pilchardus': { emoji: '🐠', bgColor: 'bg-gradient-to-br from-blue-100 to-blue-50' },
  'scomber-scombrus': { emoji: '🐟', bgColor: 'bg-gradient-to-br from-teal-100 to-teal-50' },
  'thunnus-albacares': { emoji: '🐡', bgColor: 'bg-gradient-to-br from-yellow-100 to-amber-50' },
  'octopus-vulgaris': { emoji: '🐙', bgColor: 'bg-gradient-to-br from-purple-100 to-purple-50' },
  'loligo-vulgaris': { emoji: '🦑', bgColor: 'bg-gradient-to-br from-indigo-100 to-indigo-50' },
  'sepia-officinalis': { emoji: '🦑', bgColor: 'bg-gradient-to-br from-slate-100 to-slate-50' },
  'penaeus-monodon': { emoji: '🦐', bgColor: 'bg-gradient-to-br from-orange-100 to-orange-50' },
};
const defaultMeta = { emoji: '🐠', bgColor: 'bg-gradient-to-br from-blue-100 to-blue-50' };

const enableDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true';

export default function SpeciesPage() {
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSpeciesList(100).then((data) => {
      setSpeciesList(data);
      setLoading(false);
    });
  }, []);

  const filtered = speciesList.filter((sp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      sp.common_name.toLowerCase().includes(q) ||
      sp.scientific_name.toLowerCase().includes(q) ||
      (sp.family || '').toLowerCase().includes(q) ||
      (sp.category || '').toLowerCase().includes(q)
    );
  });

  const realSpecies = filtered.filter((sp) => !sp.is_demo);
  const demoSpecies = filtered.filter((sp) => sp.is_demo);
  const displayList = enableDemo ? filtered : realSpecies.length > 0 ? realSpecies : filtered;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Species Index
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Documented Seafood Species
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Each species page includes multilingual names, biological family, FAO fishing areas, product forms, and all associated media assets.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-md">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, scientific name, family…"
            className="input-base w-full"
          />
        </div>

        {/* Demo banner */}
        {enableDemo && demoSpecies.length > 0 && realSpecies.length === 0 && (
          <div className="mb-6 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-700">
            <span className="font-semibold">Demonstration catalog</span> — These species are sample data for platform preview.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skel-${i}`} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="h-28 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🐟</p>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {search ? 'No species match your search' : 'Species catalog building in progress'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {search
                ? 'Try a different search term.'
                : 'Our professional seafood species library is being prepared.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="btn-outline mt-4">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayList.map((species) => {
              const meta = speciesEmoji[species.slug] || defaultMeta;
              return (
                <Link
                  key={species.id}
                  href={`/species/${species.slug}`}
                  className="group bg-card rounded-2xl border border-border overflow-hidden card-hover shadow-card"
                >
                  <div className={`h-28 ${meta.bgColor} flex items-center justify-center relative`}>
                    <span className="text-5xl">{meta.emoji}</span>
                    {species.is_demo && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
                          Demo
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground text-sm">{species.common_name}</h3>
                    <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5">
                      {species.scientific_name}
                    </p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {species.family && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {species.family}
                        </span>
                      )}
                      {species.category && (
                        <span className="text-xs text-muted-foreground">{species.category}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs text-secondary font-medium group-hover:gap-2 transition-all">
                      View species
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-8 text-center">
          {displayList.length > 0 && `${displayList.length} species documented`}
        </p>
      </main>
      <Footer />
    </div>
  );
}
