'use client';

import React from 'react';
import { Image as ImageIcon, Lock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Asset } from '@/lib/supabase/types';
import { getAssetThumbnailFile } from '@/lib/supabase/assetService';
import SpeciesAssetCard from '@/components/SpeciesAssetCard';

interface Props {
  assets: Asset[];
  speciesSlug: string;
  speciesName: string;
  hasSubscription: boolean;
}

export default function HubMediaLibrary({ assets, speciesSlug, speciesName, hasSubscription }: Props) {
  const emoji = '🐠';
  const visibleAssets = hasSubscription ? assets : assets.slice(0, 3);
  const lockedCount = assets.length - visibleAssets.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-secondary" />
          <h3 className="text-sm font-semibold text-foreground">Professional Media Library</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{assets.length} assets</span>
        </div>
        {assets.length > 0 && (
          <Link
            href={`/library?species=${encodeURIComponent(speciesName)}`}
            className="text-xs text-secondary hover:underline flex items-center gap-1"
          >
            View all <ExternalLink size={10} />
          </Link>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-xl border border-border">
          <ImageIcon size={28} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No media assets available for this species yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleAssets.map((asset) => {
              const thumbFile = getAssetThumbnailFile(asset);
              return (
                <SpeciesAssetCard
                  key={asset.id}
                  asset={asset}
                  thumbnailBucket={thumbFile?.storage_bucket || null}
                  thumbnailPath={thumbFile?.storage_path || null}
                  emoji={emoji}
                />
              );
            })}
          </div>

          {!hasSubscription && lockedCount > 0 && (
            <div className="bg-gradient-to-br from-ocean-50 to-blue-50 border border-ocean-200 rounded-xl p-5 text-center">
              <Lock size={20} className="text-ocean-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">
                {lockedCount} more professional assets available
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to a Professional subscription to access the full media library with high-resolution downloads.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-ocean-800 transition-colors"
              >
                Upgrade to Professional
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
