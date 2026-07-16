import React, { Suspense } from 'react';
import CheckoutResumeContent from './CheckoutResumeContent';

export default function CheckoutResumePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    }>
      <CheckoutResumeContent />
    </Suspense>
  );
}
