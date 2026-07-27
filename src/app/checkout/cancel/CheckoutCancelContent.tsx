'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Circle as XCircle, ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react';

export default function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order');
  const orderType = searchParams?.get('type');

  // Preserve checkout intent params so user can resume
  const plan = searchParams?.get('plan');
  const cycle = searchParams?.get('cycle');
  const assetId = searchParams?.get('asset_id');
  const licenseType = searchParams?.get('license_type');
  const unitProduct = searchParams?.get('unit_product');

  // Build resume URL preserving the original checkout intent
  function buildResumeHref(): string {
    if (plan) {
      const params = new URLSearchParams({ plan, cycle: cycle ?? 'monthly' });
      return `/checkout/resume?${params.toString()}`;
    }
    if (assetId && licenseType && unitProduct) {
      const params = new URLSearchParams({
        asset_id: assetId,
        license_type: licenseType,
        unit_product: unitProduct,
      });
      return `/checkout/resume?${params.toString()}`;
    }
    // Fallback: go back to pricing or library
    if (orderType === 'subscription') return '/pricing';
    if (orderType === 'credits') return '/pricing#credits';
    return '/library';
  }

  const resumeHref = buildResumeHref();
  const canResume = !!(plan || (assetId && licenseType && unitProduct));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Checkout cancelled</h1>
            <p className="text-muted-foreground max-w-sm">
              Your checkout was cancelled. No payment was taken and your order has not
              been confirmed. Your purchase intent has been preserved.
            </p>

            {/* Order reference — preserved, not deleted */}
            {orderId && (
              <div className="bg-muted rounded-xl px-6 py-3 text-sm text-muted-foreground w-full text-left">
                <div className="flex justify-between">
                  <span>Order reference</span>
                  <span className="font-mono text-xs text-foreground">{orderId}</span>
                </div>
                {plan && (
                  <div className="flex justify-between mt-1">
                    <span>Plan</span>
                    <span className="font-medium text-foreground capitalize">
                      {plan} ({cycle ?? 'monthly'})
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              {/* Resume checkout — preserves intent */}
              <Link
                href={resumeHref}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {canResume ? 'Resume checkout' : 'Try again'}
              </Link>

              {/* Back to pricing or asset — never home */}
              <Link
                href={
                  assetId ? `/asset/${assetId}` :
                  plan ? '/pricing' : '/pricing'
                }
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                {assetId ? 'Back to asset' : 'Back to Pricing'}
              </Link>

              <Link
                href="/"
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
