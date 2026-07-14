'use client';

import React, { useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut, Lock, ImageOff, AlertCircle } from 'lucide-react';

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
    previewUrl?: string | null;
  };
}

export default function AssetPreview({ asset }: AssetPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  const hasRealImage = !!asset.previewUrl && !imgError;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
      {/* Preview area */}
      <div className="relative aspect-[4/3] overflow-hidden select-none">
        {hasRealImage ? (
          /* Real image from Supabase Storage */
          <div
            className="absolute inset-0 flex items-center justify-center bg-muted overflow-hidden"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.previewUrl!}
              alt={asset.title}
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          /* Fallback: gradient + emoji placeholder */
          <div className={`absolute inset-0 bg-gradient-to-br ${asset.bgColor} flex items-center justify-center`}>
            <span
              className="text-[120px] preview-protected transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              {asset.emoji}
            </span>
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

        {/* No-image notice when storage file is absent */}
        {!hasRealImage && (
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
          {!hasRealImage ? (
            <>
              <AlertCircle size={11} className="text-amber-500" />
              <span className="text-amber-600">No storage file registered</span>
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