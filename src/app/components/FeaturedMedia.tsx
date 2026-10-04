'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Plus, ArrowRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

interface FeaturedAsset {
  id: string;
  slug: string;
  title: string;
  scientificName: string | null;
  category: string | null;
  licenseType: string | null;
  isVerified: boolean;
  isRealPhoto: boolean;
  photoUrl: string | null;
  photoAlt: string;
  span: string;
}

const SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
];

interface AssetCardProps {
  asset: FeaturedAsset;
}

function FeaturedAssetCard({ asset }: AssetCardProps) {
  const [favorited, setFavorited] = useState(false);
  const isLarge = asset.span.includes('row-span-2');

  return (
    <div className={`group relative rounded-2xl overflow-hidden border border-border card-hover bg-card shadow-card ${asset.span}`}>
      <Link href={`/asset-detail?slug=${asset.slug}`} className="block h-full">
        {/* Thumbnail */}
        <div className={`relative ${isLarge ? 'h-72' : 'h-44'} bg-muted overflow-hidden`}>
          {asset.photoUrl ? (
            <img
              src={asset.photoUrl}
              alt={asset.photoAlt}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <span className="text-muted-foreground/30 text-sm font-medium select-none">
                {asset.category || 'Seafood'}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">View Asset</span>
          </div>

          {/* Badges top-left */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {asset.isRealPhoto && (
              <Badge variant="real-photo" label="Real Photo" size="sm" />
            )}
            {asset.isVerified && (
              <Badge variant="verified" label="Verified" size="sm" />
            )}
          </div>

          {/* Actions top-right (hover) */}
          <div className="asset-card-actions absolute top-2.5 right-2.5 flex flex-col gap-1.5">
            <button
              onClick={(e) => {
                e.preventDefault();
                setFavorited(!favorited);
              }}
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 ${
                favorited
                  ? 'bg-red-500 text-white' :'bg-white/90 text-muted-foreground hover:text-red-500'
              }`}
            >
              <Heart size={13} fill={favorited ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => e.preventDefault()}
              aria-label="Add to collection"
              className="w-7 h-7 rounded-lg bg-white/90 text-muted-foreground hover:text-secondary flex items-center justify-center transition-all duration-150 active:scale-90"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-foreground line-clamp-1">
            {asset.title}
          </h3>
          {asset.scientificName && (
            <p className="text-xs font-mono-data text-muted-foreground mt-0.5 italic">
              {asset.scientificName}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {asset.category && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {asset.category}
              </span>
            )}
            {asset.licenseType && (
              <Badge
                variant={asset.licenseType as 'commercial' | 'editorial'}
                size="sm"
                showIcon={false}
              />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function FeaturedMedia() {
  const [assets, setAssets] = useState<FeaturedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedAssets = async () => {
      try {
        const supabase = createClient();

        // Fetch 5 diverse real approved assets with their files and species
        const { data: rows } = await supabase
          .from('assets')
          .select(
            'id, slug, title, category, license_type, is_verified, is_real_photo, asset_files(file_level, storage_bucket, storage_path), species:species_id(scientific_name)'
          )
          .eq('is_demo', false)
          .eq('is_real_photo', true)
          .in('review_status', ['approved', 'commercial', 'editorial'])
          .not('asset_files', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!rows || rows.length === 0) {
          setLoading(false);
          return;
        }

        // Pick up to 5 assets from different categories
        const seen = new Set<string>();
        const picked: typeof rows = [];
        for (const row of rows) {
          const cat = (row as any).category || 'other';
          if (!seen.has(cat) && picked.length < 5) {
            seen.add(cat);
            picked.push(row);
          }
        }
        // Fill remaining slots if not enough diversity
        for (const row of rows) {
          if (picked.length >= 5) break;
          if (!picked.includes(row)) picked.push(row);
        }

        // Resolve signed URLs
        const enriched: FeaturedAsset[] = await Promise.all(
          picked.slice(0, 5).map(async (row, idx) => {
            const files = (row as any).asset_files as Array<{ file_level: string; storage_bucket: string; storage_path: string }> | null;
            let photoUrl: string | null = null;

            if (files && files.length > 0) {
              const thumbFile =
                files.find((f) => f.file_level === 'thumbnail') ||
                files.find((f) => f.file_level === 'preview');
              if (thumbFile) {
                photoUrl = await getSignedStorageUrl(thumbFile.storage_bucket, thumbFile.storage_path, 7200);
              }
            }

            const speciesData = (row as any).species;
            const scientificName = speciesData?.scientific_name || null;

            return {
              id: row.id,
              slug: row.slug,
              title: row.title,
              scientificName,
              category: (row as any).category || null,
              licenseType: (row as any).license_type || null,
              isVerified: (row as any).is_verified ?? false,
              isRealPhoto: (row as any).is_real_photo ?? true,
              photoUrl,
              photoAlt: `${row.title}${scientificName ? ` — ${scientificName}` : ''} seafood photo`,
              span: SPANS[idx] || 'col-span-1 row-span-1',
            };
          })
        );

        setAssets(enriched);
      } catch {
        // Keep empty state
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedAssets();
  }, []);

  return (
    <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Featured Assets
          </p>
          <h2 className="section-title">Sample from the collection</h2>
          <p className="section-subtitle mt-2 max-w-xl">
            A preview of the platform&apos;s visual depth. Each asset carries complete scientific and commercial metadata.
          </p>
        </div>
        <Link
          href="/library"
          className="hidden sm:flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          Browse full library
          <ArrowRight size={15} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className={`rounded-2xl border border-border bg-card animate-pulse overflow-hidden ${SPANS[i]}`}
            >
              <div className={`bg-muted ${i === 0 ? 'h-72' : 'h-44'}`} />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-auto">
          {assets.map((asset) => (
            <FeaturedAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Assets loading — check back shortly.</p>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/library" className="btn-primary">
          Explore the full library
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}