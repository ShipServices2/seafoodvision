'use client';

import React, { Suspense } from 'react';
import MediaLinkingContent from './MediaLinkingContent';

export default function MediaLinkingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>}>
      <MediaLinkingContent />
    </Suspense>
  );
}
