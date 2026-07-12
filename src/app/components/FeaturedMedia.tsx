'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Plus, ArrowRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';

const featuredAssets = [
  {
    id: 'asset-demo-001',
    slug: 'atlantic-mackerel-whole-fresh-sv001',
    title: 'Atlantic Mackerel — Whole, Fresh',
    species: 'Atlantic Mackerel',
    scientificName: 'Scomber scombrus',
    category: 'Fish',
    productForm: 'Whole, ungutted',
    orientation: 'Landscape',
    isVerified: true,
    isRealPhoto: true,
    licenseType: 'commercial',
    thumbnailColor: 'bg-gradient-to-br from-blue-200 via-blue-100 to-slate-100',
    emoji: '🐟',
    span: 'col-span-2 row-span-2',
  },
  {
    id: 'asset-demo-002',
    slug: 'common-octopus-whole-fresh-sv002',
    title: 'Common Octopus — Whole, Fresh',
    species: 'Common Octopus',
    scientificName: 'Octopus vulgaris',
    category: 'Cephalopods',
    productForm: 'Whole, uncleaned',
    orientation: 'Portrait',
    isVerified: true,
    isRealPhoto: true,
    licenseType: 'editorial',
    thumbnailColor: 'bg-gradient-to-br from-purple-200 via-purple-100 to-pink-100',
    emoji: '🐙',
    span: 'col-span-1 row-span-1',
  },
  {
    id: 'asset-demo-003',
    slug: 'tiger-shrimp-headless-frozen-sv003',
    title: 'Tiger Shrimp — Headless, Frozen',
    species: 'Giant Tiger Prawn',
    scientificName: 'Penaeus monodon',
    category: 'Crustaceans',
    productForm: 'Headless shell-on',
    orientation: 'Landscape',
    isVerified: true,
    isRealPhoto: true,
    licenseType: 'commercial',
    thumbnailColor: 'bg-gradient-to-br from-orange-200 via-orange-100 to-amber-100',
    emoji: '🦐',
    span: 'col-span-1 row-span-1',
  },
  {
    id: 'asset-demo-004',
    slug: 'yellowfin-tuna-steak-sv004',
    title: 'Yellowfin Tuna — Steak, Fresh',
    species: 'Yellowfin Tuna',
    scientificName: 'Thunnus albacares',
    category: 'Fish',
    productForm: 'Steak',
    orientation: 'Landscape',
    isVerified: true,
    isRealPhoto: true,
    licenseType: 'commercial',
    thumbnailColor: 'bg-gradient-to-br from-red-200 via-red-100 to-rose-100',
    emoji: '🍣',
    span: 'col-span-1 row-span-1',
  },
  {
    id: 'asset-demo-005',
    slug: 'european-sardine-whole-sv005',
    title: 'European Sardine — Whole',
    species: 'European Pilchard',
    scientificName: 'Sardina pilchardus',
    category: 'Fish',
    productForm: 'Whole, fresh',
    orientation: 'Portrait',
    isVerified: false,
    isRealPhoto: true,
    licenseType: 'editorial',
    thumbnailColor: 'bg-gradient-to-br from-slate-200 via-slate-100 to-blue-100',
    emoji: '🐠',
    span: 'col-span-1 row-span-1',
  },
];

interface AssetCardProps {
  asset: typeof featuredAssets[0];
  span?: string;
}

function FeaturedAssetCard({ asset, span }: AssetCardProps) {
  const [favorited, setFavorited] = useState(false);

  return (
    <div className={`group relative rounded-2xl overflow-hidden border border-border card-hover bg-card shadow-card ${span || ''}`}>
      {/* Thumbnail */}
      <Link href={`/asset-detail?slug=${asset.slug}`} className="block h-full">
        <div className={`relative ${span?.includes('row-span-2') ? 'h-72' : 'h-44'} ${asset.thumbnailColor} flex items-center justify-center overflow-hidden`}>
          <span className="text-6xl">{asset.emoji}</span>

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
          <p className="text-xs font-mono-data text-muted-foreground mt-0.5 italic">
            {asset.scientificName}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {asset.category}
            </span>
            <Badge
              variant={asset.licenseType as 'commercial' | 'editorial'}
              size="sm"
              showIcon={false}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function FeaturedMedia() {
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

      {/* Bento grid: 4 cols, 2 rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-auto">
        {featuredAssets.map((asset) => (
          <FeaturedAssetCard
            key={asset.id}
            asset={asset}
            span={asset.span}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link href="/library" className="btn-primary">
          Explore the full library
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}