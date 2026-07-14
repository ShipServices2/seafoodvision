'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, ArrowRight, X, Zap } from 'lucide-react';
import type { Asset } from '@/lib/supabase/types';
import { getSignedStorageUrl, getAssetThumbnailFile } from '@/lib/supabase/assetService';

interface ReviewModeProps {
  assets: Asset[];
  currentIndex: number;
  onApprove: (assetId: string) => Promise<void>;
  onReject: (assetId: string) => Promise<void>;
  onNext: () => void;
  onClose: () => void;
  totalCount: number;
}

export default function ReviewMode({
  assets,
  currentIndex,
  onApprove,
  onReject,
  onNext,
  onClose,
  totalCount,
}: ReviewModeProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [startTime] = useState(Date.now());
  const [rate, setRate] = useState(0);

  const asset = assets[currentIndex];

  useEffect(() => {
    if (!asset) return;
    setThumbUrl(null);
    const file = getAssetThumbnailFile(asset);
    if (file) {
      getSignedStorageUrl(file.storage_bucket, file.storage_path, 300).then(setThumbUrl);
    }
  }, [asset]);

  useEffect(() => {
    const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
    if (elapsed > 0 && reviewed > 0) {
      setRate(Math.round(reviewed / elapsed));
    }
  }, [reviewed, startTime]);

  const handleApprove = useCallback(async () => {
    if (!asset || loading) return;
    setLoading('approve');
    await onApprove(asset.id);
    setReviewed((r) => r + 1);
    setLoading(null);
    onNext();
  }, [asset, loading, onApprove, onNext]);

  const handleReject = useCallback(async () => {
    if (!asset || loading) return;
    setLoading('reject');
    await onReject(asset.id);
    setReviewed((r) => r + 1);
    setLoading(null);
    onNext();
  }, [asset, loading, onReject, onNext]);

  // Keyboard shortcuts in review mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a' || e.key === 'A') handleApprove();
      if (e.key === 'r' || e.key === 'R') handleReject();
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleApprove, handleReject, onNext, onClose]);

  if (!asset) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
        <div className="text-center text-white">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">All assets reviewed!</h2>
          <p className="text-gray-400 mb-6">{reviewed} assets reviewed in this session</p>
          <button onClick={onClose} className="btn-primary">Close Review Mode</button>
        </div>
      </div>
    );
  }

  const progress = totalCount > 0 ? ((currentIndex) / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-secondary/20 text-secondary px-2.5 py-1 rounded-full text-xs font-bold">
            <Zap size={11} />
            Review Mode
          </div>
          <span className="text-white/60 text-xs">
            {currentIndex + 1} / {totalCount}
          </span>
          {rate > 0 && (
            <span className="text-green-400 text-xs font-medium">
              ~{rate}/hr
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-xs">A = Approve · R = Reject · → = Next · Esc = Close</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/10">
        <div
          className="h-full bg-secondary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex gap-8 items-start max-w-4xl w-full">
          {/* Image */}
          <div className="flex-1 max-w-lg">
            <div className="aspect-square bg-white/5 rounded-2xl overflow-hidden border border-white/10">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt={asset.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">
                  No preview
                </div>
              )}
            </div>
          </div>

          {/* Info + Actions */}
          <div className="w-72 flex flex-col gap-4">
            <div>
              <h2 className="text-white font-bold text-lg leading-tight mb-1">{asset.title}</h2>
              <p className="text-white/40 text-xs font-mono">{asset.public_asset_id || asset.id.slice(0, 8)}</p>
            </div>

            <div className="space-y-2">
              {asset.species && (
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs w-20 shrink-0">Species</span>
                  <span className="text-white/80 text-xs">{asset.species.common_name}</span>
                </div>
              )}
              {asset.category && (
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs w-20 shrink-0">Category</span>
                  <span className="text-white/80 text-xs capitalize">{asset.category}</span>
                </div>
              )}
              {asset.product_form && (
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs w-20 shrink-0">Product</span>
                  <span className="text-white/80 text-xs capitalize">{asset.product_form}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-20 shrink-0">Status</span>
                <span className="text-amber-400 text-xs capitalize">{asset.review_status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-20 shrink-0">Type</span>
                <span className="text-white/60 text-xs">{asset.is_demo ? 'Demo' : 'Real'}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={handleApprove}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                Approve <span className="text-green-200 text-xs font-normal ml-1">[A]</span>
              </button>
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                Reject <span className="text-red-200 text-xs font-normal ml-1">[R]</span>
              </button>
              <button
                onClick={onNext}
                disabled={!!loading}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50"
              >
                <ArrowRight size={14} />
                Skip / Next <span className="text-white/40 text-xs font-normal ml-1">[→]</span>
              </button>
            </div>

            {/* Session stats */}
            {reviewed > 0 && (
              <div className="mt-2 p-3 bg-white/5 rounded-xl">
                <p className="text-white/40 text-xs mb-1">Session</p>
                <p className="text-white text-sm font-bold">{reviewed} reviewed</p>
                {rate > 0 && <p className="text-green-400 text-xs">{rate} assets/hour</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
