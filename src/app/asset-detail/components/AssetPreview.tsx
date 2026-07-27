'use client';

import React, { useState, useEffect } from 'react';
import { Maximize2, ZoomIn, ZoomOut, Lock, ImageOff, CircleAlert as AlertCircle } from 'lucide-react';
import { getSignedStorageUrl } from '@/lib/supabase/assetService';

interface AssetPreviewProps {
  asset: {
    id?: string;
    slug?: string;
    title: string;
    emoji: string;
    bgColor: string;
    dimensions?: string;
    format?: string;
    isRealPhoto?: boolean;
    // Storage file info for signed URL generation
    previewBucket?: string | null;
    previewPath?: string | null;
    // Legacy — kept for backward compat
    previewUrl?: string | null;
  };
}

export default function AssetPreview({ asset }: AssetPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  // Generate signed URL for private bucket
  useEffect(() => {
    const bucket = asset.previewBucket;
    const path = asset.previewPath;
    if (!bucket || !path) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    setUrlLoading(true);
    getSignedStorageUrl(bucket, path, 3600).then((url) => {
      if (!cancelled) {
        setSignedUrl(url);
        setUrlLoading(false);
        setImgError(false);
      }
    });
    return () => { cancelled = true; };
  }, [asset.previewBucket, asset.previewPath]);

  const hasStorageFile = !!(asset.previewBucket && asset.previewPath);
  const hasRealImage = !!signedUrl && !imgError && !urlLoading;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
      {/* Preview area */}
      <div className="relative aspect-[4/3] overflow-hidden select-none">
        {hasRealImage ? (
          /* Real image from Supabase Storage via signed URL */
          <div
            className="absolute inset-0 flex items-center justify-center bg-muted overflow-hidden"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl!}
              alt={asset.title}
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          /* Fallback: gradient + emoji placeholder */
          <div className={`absolute inset-0 bg-gradient-to-br ${asset.bgColor} flex items-center justify-center`}>
            {urlLoading && hasStorageFile ? (
              <div className="w-10 h-10 border-2 border-border border-t-secondary rounded-full animate-spin" />
            ) : (
              <span
                className="text-[120px] preview-protected transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              >
                {asset.emoji}
              </span>
            )}
          </div>
        )}

        {/* Watermark grid — only on fallback */}
        {!hasRealImage && (
          <div className="watermark-repeat">
            {Array.from({ length: 12 }).map((_, row) =>
              Array.from({ length: 4 }).map((_, col) => (
                <div
                  key={`wm-${row + 1}-${col + 1}`}
                  className="absolute"
                  style={{
                    top: `${row * 80 + 20}px`,
                    left: `${col * 25}%`,
                    transform: 'rotate(-35deg)',
                  }}
                >
                  <span className="watermark-text text-sm">SEAFOOD VISION PREVIEW</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* No-image notice — only when no storage file registered */}
        {!hasRealImage && !hasStorageFile && !urlLoading && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-amber-50/90 border border-amber-200 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <ImageOff size={11} className="text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">Preview not available</span>
          </div>
        )}

        {/* Lock overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-primary/70 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
          <Lock size={11} className="text-white" />
          <span className="text-xs text-white font-medium">Protected Preview</span>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-xs font-mono-data text-muted-foreground w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 2}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>

      {/* Preview info bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono-data text-muted-foreground">
            {asset.dimensions || '—'}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs font-mono-data text-muted-foreground">
            {asset.format || '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {!hasRealImage && !hasStorageFile ? (
            <>
              <AlertCircle size={11} className="text-amber-500" />
              <span className="text-amber-600">No storage file registered</span>
            </>
          ) : !hasRealImage && hasStorageFile && !urlLoading ? (
            <>
              <AlertCircle size={11} className="text-amber-500" />
              <span className="text-amber-600">File not found in storage</span>
            </>
          ) : (
            <>
              <Maximize2 size={11} />
              <span>Full resolution available with license</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}