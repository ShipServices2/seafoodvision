'use client';

import React, { Suspense } from 'react';
import CheckoutCancelContent from './CheckoutCancelContent';

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <CheckoutCancelContent />
    </Suspense>
  );
}
