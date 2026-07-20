'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

interface SpeciesCard {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  family: string | null;
  category: string | null;
  mediaCount: number | null;
  faoArea: string | null;
  photoUrl: string | null;
  photoAlt: string;
  bgColor: string;
}

const categoryBg: Record<string, string> = {
  Fish: 'bg-gradient-to-br from-blue-50 to-blue-100',
  Crustaceans: 'bg-gradient-to-br from-orange-50 to-orange-100',
  Cephalopods: 'bg-gradient-to-br from-purple-50 to-purple-100',
  Molluscs: 'bg-gradient-to-br from-teal-50 to-teal-100',
  'Fillets & Portions': 'bg-gradient-to-br from-red-50 to-red-100',
  'Frozen Products': 'bg-gradient-to-br from-cyan-50 to-cyan-100',
  Packaging: 'bg-gradient-to-br from-slate-50 to-slate-100',
  Aquaculture: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
};

const defaultBg = 'bg-gradient-to-br from-blue-50 to-blue-100';

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

        const withPhotos = await Promise.all(
          species.map(async (sp) => {
            // Count assets for this species
            const { count } = await supabase
              .from('assets')
              .select('*', { count: 'exact', head: true })
              .eq('species_id', sp.id)
              .eq('is_demo', false)
              .in('review_status', ['approved', 'commercial', 'editorial']);

            // Fetch first real photo asset for this species
            const { data: assetRows } = await supabase
              .from('assets')
              .select('id, title, asset_files(file_level, storage_bucket, storage_path)')
              .eq('species_id', sp.id)
              .eq('is_demo', false)
              .eq('is_real_photo', true)
              .in('review_status', ['approved', 'commercial', 'editorial'])
              .limit(5);

            let photoUrl: string | null = null;
            let photoAlt = sp.common_name;

            if (assetRows && assetRows.length > 0) {
              for (const asset of assetRows) {
                const files = (asset as any).asset_files as Array<{ file_level: string; storage_bucket: string; storage_path: string }> | null;
                if (!files || files.length === 0) continue;
                const thumbFile =
                  files.find((f) => f.file_level === 'thumbnail') ||
                  files.find((f) => f.file_level === 'preview');
                if (thumbFile) {
                  const url = await getSignedStorageUrl(thumbFile.storage_bucket, thumbFile.storage_path, 7200);
                  if (url) {
                    photoUrl = url;
                    photoAlt = `${sp.common_name} (${sp.scientific_name}) — real seafood photo`;
                    break;
                  }
                }
              }
            }

            const bgColor = categoryBg[sp.category || ''] || defaultBg;

            return {
              id: sp.id,
              slug: sp.slug,
              commonName: sp.common_name,
              scientificName: sp.scientific_name,
              family: sp.family,
              category: sp.category,
              mediaCount: count ?? 0,
              faoArea: sp.fao_areas?.[0] || null,
              photoUrl,
              photoAlt,
              bgColor,
            };
          })
        );

        setSpeciesList(withPhotos);
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
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-36 bg-muted" />
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
            <div className={`h-36 relative overflow-hidden ${!species?.photoUrl ? species?.bgColor : ''}`}>
              {species?.photoUrl ? (
                <img
                  src={species.photoUrl}
                  alt={species.photoAlt}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className={`w-full h-full ${species?.bgColor} flex items-center justify-center`}>
                  <span className="text-muted-foreground/20 text-3xl font-bold select-none">
                    {species?.commonName?.charAt(0)}
                  </span>
                </div>
              )}
              {species?.mediaCount !== null && species.mediaCount !== undefined && species.mediaCount > 0 && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <ImageIcon size={10} className="text-white/80" />
                  <span className="text-xs font-mono-data font-medium text-white/90">
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