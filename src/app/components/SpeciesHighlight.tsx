'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SpeciesCard {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  family: string | null;
  category: string | null;
  mediaCount: number | null;
  faoArea: string | null;
  emoji: string;
  bgColor: string;
}

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

export default function SpeciesHighlight() {
  const [speciesList, setSpeciesList] = useState<SpeciesCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const supabase = createClient();
        const { data: species } = await supabase
          .from('species')
          .select('id, slug, common_name, scientific_name, family, category, fao_areas')
          .eq('is_validated', true)
          .limit(8);

        if (!species || species.length === 0) {
          setLoading(false);
          return;
        }

        const withCounts = await Promise.all(
          species.map(async (sp) => {
            const { count } = await supabase
              .from('assets')
              .select('*', { count: 'exact', head: true })
              .eq('species_id', sp.id)
              .eq('is_demo', false)
              .in('review_status', ['approved', 'commercial', 'editorial']);

            const meta = speciesEmoji[sp.slug] || defaultMeta;
            return {
              id: sp.id,
              slug: sp.slug,
              commonName: sp.common_name,
              scientificName: sp.scientific_name,
              family: sp.family,
              category: sp.category,
              mediaCount: count ?? 0,
              faoArea: sp.fao_areas?.[0] || null,
              ...meta,
            };
          })
        );

        setSpeciesList(withCounts);
      } catch {
        // Keep empty state
      } finally {
        setLoading(false);
      }
    };

    fetchSpecies();
  }, []);

  if (loading) {
    return (
      <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
              Species Index
            </p>
            <h2 className="section-title">Documented species</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-28 bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (speciesList.length === 0) {
    return (
      <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
              Species Index
            </p>
            <h2 className="section-title">Documented species</h2>
            <p className="section-subtitle mt-2 max-w-xl">
              Species documentation is being built. Check back soon.
            </p>
          </div>
          <Link href="/species" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors">
            Full species index
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Species catalog building in progress</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Species Index
          </p>
          <h2 className="section-title">Documented species</h2>
          <p className="section-subtitle mt-2 max-w-xl">
            Each species page includes multilingual names, biological family, FAO area, product forms, and all associated media.
          </p>
        </div>
        <Link
          href="/species"
          className="hidden sm:flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          Full species index
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {speciesList?.map((species) => (
          <Link
            key={species?.id}
            href={`/species/${species?.slug}`}
            className="group bg-card rounded-2xl border border-border overflow-hidden card-hover shadow-card"
          >
            <div className={`h-28 ${species?.bgColor} flex items-center justify-center relative`}>
              <span className="text-5xl">{species?.emoji}</span>
              {species?.mediaCount !== null && species.mediaCount > 0 && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <ImageIcon size={10} className="text-muted-foreground" />
                  <span className="text-xs font-mono-data font-medium text-muted-foreground">
                    {species.mediaCount}
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-foreground text-sm">{species?.commonName}</h3>
              <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5">
                {species?.scientificName}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {species?.family && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {species.family}
                  </span>
                )}
                {species?.faoArea && (
                  <span className="text-xs text-muted-foreground">{species.faoArea}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}