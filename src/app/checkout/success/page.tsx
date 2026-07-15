'use client';

import React, { Suspense } from 'react';
import CheckoutSuccessContent from './CheckoutSuccessContent';

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
