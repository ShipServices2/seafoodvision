'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Camera } from 'lucide-react';
import { fetchSimilarAssets, type AssetRow } from '@/lib/supabase/assetService';

interface SimilarAssetsProps {
  currentId: string;
  category: string | null;
}

const categoryEmoji: Record<string, { emoji: string; bgColor: string }> = {
  Fish: { emoji: '🐟', bgColor: 'from-blue-200 to-blue-100' },
  Crustaceans: { emoji: '🦐', bgColor: 'from-orange-200 to-orange-100' },
  Cephalopods: { emoji: '🐙', bgColor: 'from-purple-200 to-purple-100' },
  Molluscs: { emoji: '🦪', bgColor: 'from-teal-200 to-teal-100' },
  'Fillets & Portions': { emoji: '🍣', bgColor: 'from-red-200 to-red-100' },
  'Frozen Products': { emoji: '🧊', bgColor: 'from-cyan-200 to-cyan-100' },
  Packaging: { emoji: '📦', bgColor: 'from-slate-200 to-slate-100' },
  Aquaculture: { emoji: '🌊', bgColor: 'from-emerald-200 to-emerald-100' },
};

export default function SimilarAssets({ currentId, category }: SimilarAssetsProps) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimilarAssets(currentId, category, 6).then((data) => {
      setAssets(data);
      setLoading(false);
    });
  }, [currentId, category]);

  if (loading) {
    return (
      <section className="mt-12 pt-10 border-t border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">Similar assets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-${i}`} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-2.5 space-y-1.5">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (assets.length === 0) return null;

  return (
    <section className="mt-12 pt-10 border-t border-border">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Similar assets</h2>
          <p className="text-sm text-muted-foreground mt-1">Other seafood assets you might need</p>
        </div>
        <Link
          href="/library"
          className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          View all
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {assets.map((asset) => {
          const meta = categoryEmoji[asset.category || ''] || { emoji: '🐠', bgColor: 'from-blue-200 to-blue-100' };
          const scientificName = (asset.species as { scientific_name?: string } | null)?.scientific_name || '';
          return (
            <Link
              key={asset.id}
              href={`/asset-detail?slug=${asset.slug}`}
              className="group bg-card rounded-xl border border-border overflow-hidden card-hover shadow-card"
            >
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${meta.bgColor} flex items-center justify-center overflow-hidden`}>
                <span className="text-3xl select-none">{meta.emoji}</span>
                <div className="absolute inset-0 bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  {asset.is_real_photo && (
                    <span className="w-4 h-4 rounded-full badge-real-photo flex items-center justify-center">
                      <Camera size={8} />
                    </span>
                  )}
                  {asset.is_verified && (
                    <span className="w-4 h-4 rounded-full badge-verified flex items-center justify-center">
                      <CheckCircle2 size={8} />
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2.5">
                <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{asset.title}</h3>
                {scientificName && (
                  <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5 line-clamp-1">{scientificName}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}