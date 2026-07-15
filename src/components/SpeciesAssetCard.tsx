'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import type { Asset } from '@/lib/supabase/types';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

interface SpeciesAssetCardProps {
  asset: Asset;
  // Storage file info for signed URL generation
  thumbnailBucket?: string | null;
  thumbnailPath?: string | null;
  // Legacy — kept for backward compat
  thumbnailUrl?: string | null;
  emoji: string;
}

export default function SpeciesAssetCard({ asset, thumbnailBucket, thumbnailPath, emoji }: SpeciesAssetCardProps) {
  const [imgError, setImgError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailBucket || !thumbnailPath) { setSignedUrl(null); return; }
    let cancelled = false;
    getSignedStorageUrl(thumbnailBucket, thumbnailPath, 3600).then((url) => {
      if (!cancelled) setSignedUrl(url);
    });
    return () => { cancelled = true; };
  }, [thumbnailBucket, thumbnailPath]);

  const hasImage = !!signedUrl && !imgError;

  return (
    <Link
      href={`/asset/${asset.slug}`}
      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl!}
            alt={asset.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-3xl select-none">{emoji}</span>
        )}
        {!hasImage && asset.is_real_photo && thumbnailPath && (
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
