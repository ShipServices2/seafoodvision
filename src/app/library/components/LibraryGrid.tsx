'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart, Plus, Image as ImageIcon, CircleCheck as CheckCircle2, Camera, ImageOff } from 'lucide-react';
import type { ViewMode } from './LibraryContent';
import Badge from '@/components/ui/Badge';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

// Compatible asset shape (works for both DB assets and demo assets)
interface AssetCardData {
  id: string;
  slug: string;
  title: string;
  species: string;
  scientificName: string;
  family: string;
  category: string;
  productForm: string;
  productState: string;
  freezingMethod: string;
  packaging: string;
  country: string;
  faoArea: string;
  orientation: string;
  licenseType: string;
  isVerified: boolean;
  isRealPhoto: boolean;
  mediaType: string;
  dimensions: string;
  format: string;
  status: string;
  keywords: string[];
  isDemo: boolean;
  emoji: string;
  bgColor: string;
  // Storage file info for signed URL generation
  thumbnailBucket?: string | null;
  thumbnailPath?: string | null;
  // Legacy — kept for backward compat but ignored (use bucket+path)
  thumbnailUrl?: string | null;
}

interface LibraryGridProps {
  assets: AssetCardData[];
  viewMode: ViewMode;
  totalResults: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

// Hook: generate a signed URL for a private storage object
function useSignedUrl(bucket: string | null | undefined, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bucket || !path) { setUrl(null); return; }
    let cancelled = false;
    getSignedStorageUrl(bucket, path, 3600).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  return url;
}

function AssetThumbnail({
  asset,
  size = 'card',
}: {
  asset: AssetCardData;
  size?: 'card' | 'list';
}) {
  const [imgError, setImgError] = useState(false);
  const signedUrl = useSignedUrl(asset.thumbnailBucket, asset.thumbnailPath);
  const hasImage = !!signedUrl && !imgError;

  if (size === 'list') {
    return (
      <div className={`w-20 h-14 rounded-lg bg-gradient-to-br ${asset.bgColor} flex items-center justify-center overflow-hidden relative`}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl!}
            alt={asset.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-2xl select-none">{asset.emoji}</span>
        )}
        {!hasImage && asset.isRealPhoto && (
          <div className="absolute bottom-0.5 right-0.5">
            <ImageOff size={9} className="text-amber-500" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative aspect-[4/3] bg-gradient-to-br ${asset.bgColor} flex items-center justify-center overflow-hidden`}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedUrl!}
          alt={asset.title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-5xl select-none">{asset.emoji}</span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-primary/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <span className="text-white text-xs font-semibold bg-primary/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">
          View Asset
        </span>
      </div>

      {/* Top-left badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        {asset.isRealPhoto && (
          <span className="inline-flex items-center gap-1 badge-real-photo text-xs px-2 py-0.5 rounded-full font-medium">
            <Camera size={9} />
            Real Photo
          </span>
        )}
        {asset.isVerified && (
          <span className="inline-flex items-center gap-1 badge-verified text-xs px-2 py-0.5 rounded-full font-medium">
            <CheckCircle2 size={9} />
            Verified
          </span>
        )}
      </div>

      {/* No-image indicator — only when real photo but no storage file */}
      {!hasImage && asset.isRealPhoto && asset.thumbnailPath && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 bg-amber-50/90 border border-amber-200 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
            <ImageOff size={9} />
            No preview
          </span>
        </div>
      )}

      {/* Demo badge */}
      {asset.isDemo && (
        <div className="absolute bottom-2 left-2">
          <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
            Demo
          </span>
        </div>
      )}
    </div>
  );
}

function AssetGridCard({ asset }: { asset: AssetCardData }) {
  const [favorited, setFavorited] = useState(false);

  return (
    <div className="group relative bg-card rounded-xl border border-border overflow-hidden shadow-card card-hover">
      <Link href={`/asset/${asset.slug}`} className="block">
        <AssetThumbnail asset={asset} size="card" />

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
            {asset.title}
          </h3>
          <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5 line-clamp-1">
            {asset.scientificName}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              {asset.category}
            </span>
            <Badge
              variant={asset.licenseType as 'commercial' | 'editorial'}
              size="sm"
              showIcon={false}
            />
            <span className="text-xs text-muted-foreground font-mono-data ml-auto">
              {asset.orientation.charAt(0)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
            {asset.productForm} · {asset.productState}
          </p>
        </div>
      </Link>

      {/* Hover action buttons */}
      <div className="asset-card-actions absolute top-2 right-2 flex flex-col gap-1">
        <Link
          href={`/asset/${asset.slug}`}
          onClick={(e) => {
            e.stopPropagation();
            setFavorited(!favorited);
          }}
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 shadow-sm ${
            favorited ? 'bg-red-500 text-white' : 'bg-white text-muted-foreground hover:text-red-500'
          }`}
        >
          <Heart size={12} fill={favorited ? 'currentColor' : 'none'} />
        </Link>
        <Link
          href={`/asset/${asset.slug}`}
          aria-label="Add to collection"
          className="w-7 h-7 rounded-lg bg-white text-muted-foreground hover:text-secondary flex items-center justify-center transition-all duration-150 active:scale-90 shadow-sm"
        >
          <Plus size={12} />
        </Link>
      </div>
    </div>
  );
}

function AssetListRow({ asset }: { asset: AssetCardData }) {
  const [favorited, setFavorited] = useState(false);

  return (
    <div className="group flex items-center gap-4 bg-card rounded-xl border border-border p-3 shadow-card hover:shadow-card-hover transition-shadow duration-200">
      {/* Thumbnail */}
      <Link href={`/asset/${asset.slug}`} className="shrink-0">
        <AssetThumbnail asset={asset} size="list" />
      </Link>

      {/* Info */}
      <Link href={`/asset/${asset.slug}`} className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground line-clamp-1">{asset.title}</h3>
            <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5">{asset.scientificName}</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {asset.isRealPhoto && <Badge variant="real-photo" size="sm" label="Real Photo" />}
            {asset.isVerified && <Badge variant="verified" size="sm" label="Verified" />}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{asset.category}</span>
          <span className="text-xs text-muted-foreground">{asset.productForm}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{asset.productState}</span>
          <span className="text-xs text-muted-foreground hidden lg:inline">·</span>
          <span className="text-xs font-mono-data text-muted-foreground hidden lg:inline">{asset.faoArea}</span>
          <span className="text-xs text-muted-foreground hidden xl:inline">·</span>
          <span className="text-xs text-muted-foreground hidden xl:inline">{asset.country}</span>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge
          variant={asset.licenseType as 'commercial' | 'editorial'}
          size="sm"
          showIcon={false}
          className="hidden sm:inline-flex"
        />
        <button
          onClick={() => setFavorited(!favorited)}
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 border ${
            favorited ? 'border-red-200 bg-red-50 text-red-500' : 'border-border bg-card text-muted-foreground hover:text-red-500'
          }`}
        >
          <Heart size={13} fill={favorited ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}

export default function LibraryGrid({
  assets,
  viewMode,
  totalResults,
  currentPage,
  totalPages,
  itemsPerPage,
  itemsPerPageOptions,
  onPageChange,
  onItemsPerPageChange,
}: LibraryGridProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ImageIcon size={40} className="text-muted-foreground/40 mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-1">No assets found</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Try adjusting your filters or search terms to find what you&apos;re looking for.
        </p>
      </div>
    );
  }

  return (
    <div>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <AssetGridCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map((asset) => (
            <AssetListRow key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="input-base text-sm py-1 px-2 w-auto"
            >
              {itemsPerPageOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>per page · {totalResults.toLocaleString()} total</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-secondary text-white' :'border border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}