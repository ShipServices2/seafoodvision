'use client';

import { useEffect } from 'react';

// Discourages saving watermarked previews and thumbnails: no context menu, no drag-and-drop, no selection on <img> elements
// served from our private Storage buckets (signed URLs). Deterrent only; the real protection is the watermark and the short-lived URLs.
const isProtectedImage = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLImageElement)) return false;
  const src = target.currentSrc || target.src || '';
  return src.includes('/storage/v1/object/sign/') || src.includes('/_next/image');
};

export default function ImageProtection() {
  useEffect(() => {
    const block = (event: Event) => { if (isProtectedImage(event.target)) event.preventDefault(); };
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('selectstart', block);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('selectstart', block);
    };
  }, []);
  return null;
}
