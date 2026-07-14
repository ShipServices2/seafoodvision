'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import type { Asset } from '@/lib/supabase/types';

interface SpeciesAssetCardProps {
  asset: Asset;
  thumbnailUrl: string | null;
  emoji: string;
}

export default function SpeciesAssetCard({ asset, thumbnailUrl, emoji }: SpeciesAssetCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!thumbnailUrl && !imgError;

  return (
    <Link
      href={`/asset/${asset.slug}`}
      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl!}
            alt={asset.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-3xl select-none">{emoji}</span>
        )}
        {!hasImage && asset.is_real_photo && (
          <div className="absolute bottom-1 right-1">
            <ImageOff size={10} className="text-amber-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-foreground line-clamp-1">{asset.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{asset.product_form || asset.category}</p>
      </div>
    </Link>
  );
}
