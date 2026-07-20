'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, RefreshCw, AlertCircle, ShoppingCart, CheckCircle2, Settings } from 'lucide-react';
import { resolveSubscriptionSelection } from '@/lib/payments/subscriptionPlanResolution';

type ResumeState =
  | 'loading' |'creating_checkout' |'redirecting' |'error' |'no_intent' |'not_configured';

type CheckoutType = 'subscription' | 'asset_license' | 'credit_pack' | 'unknown';

export default function CheckoutResumeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Subscription params
  const plan = searchParams.get('plan');
  const subscriptionSelection = plan
    ? resolveSubscriptionSelection(plan, searchParams.get('cycle'))
    : null;
  const cycle = subscriptionSelection?.billingCycle ?? 'monthly';

  // Asset license params
  const assetId = searchParams.get('asset_id');
  const licenseTypeCode = searchParams.get('license_type');
  const unitProductCode = searchParams.get('unit_product');
  const creditPackCode = searchParams.get('credit_pack');

  const checkoutType: CheckoutType = plan
    ? 'subscription'
    : assetId && licenseTypeCode && unitProductCode
    ? 'asset_license'
    : creditPackCode
    ? 'credit_pack' :'unknown';

  const [state, setState] = useState<ResumeState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Prevent double-execution (StrictMode + refresh guard)
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Not authenticated — redirect to sign-in with all params preserved
    if (!user) {
      const currentParams = new URLSearchParams();
      currentParams.set('return_to', '/checkout/resume');
      currentParams.set('checkout_intent', '1');
      if (plan) currentParams.set('plan', plan);
      if (cycle) currentParams.set('cycle', cycle);
      if (assetId) currentParams.set('asset_id', assetId);
      if (licenseTypeCode) currentParams.set('license_type', licenseTypeCode);
      if (unitProductCode) currentParams.set('unit_product', unitProductCode);
      if (creditPackCode) currentParams.set('credit_pack', creditPackCode);
      router.replace(`/auth/sign-in?${currentParams.toString()}`);
      return;
    }

    // No intent — show clear message, never redirect to home
    if (checkoutType === 'unknown') {
      setState('no_intent');
      return;
    }

    // Prevent double-execution in StrictMode / page refresh
    if (startedRef.current) return;
    startedRef.current = true;

    setState('creating_checkout');
    initiateCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  async function initiateCheckout() {
    try {
      // ── Server-side configuration check ──────────────────
      // This check runs on the server where process.env is available.
      // Never rely on client-side env vars for payment configuration.
      const configRes = await fetch('/api/payments/dodo/config-check');
      if (configRes.ok) {
        const configData = await configRes.json() as { isCheckoutReady: boolean };
        if (!configData.isCheckoutReady) {
          setState('not_configured');
          setErrorMessage('Dodo Payments is not configured for checkout.');
          return;
        }
      }
      // ─────────────────────────────────────────────────────

      let res: Response;

      if (checkoutType === 'subscription') {
        // Use unified checkout route with type=subscription
        res = await fetch('/api/payments/dodo/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'subscription',
            planCode: subscriptionSelection?.planCode,
            billingCycle: cycle,
          }),
        });
      } else if (checkoutType === 'asset_license') {
        // asset_license
        res = await fetch('/api/payments/dodo/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId, licenseTypeCode, unitProductCode }),
        });
      } else {
        res = await fetch('/api/payments/dodo/credit-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packCode: creditPackCode }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        const errMsg = (data as { error?: string }).error ?? 'Checkout failed';
        // Detect Dodo not configured — show informative state, preserve intent
        if (
          errMsg.toLowerCase().includes('not configured') ||
          errMsg.toLowerCase().includes('disabled') ||
          errMsg.toLowerCase().includes('dodo payments')
        ) {
          setState('not_configured');
          setErrorMessage(errMsg);
          return;
        }
        throw new Error(errMsg);
      }

      const { checkoutUrl } = data as { checkoutUrl: string; orderId: string };

      if (!checkoutUrl) {
        throw new Error('No checkout URL returned from server');
      }

      setState('redirecting');

      // External Dodo checkout URL — use window.location for full navigation
      if (checkoutUrl.startsWith('http')) {
        window.location.href = checkoutUrl;
      } else {
        router.replace(checkoutUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      setErrorMessage(msg);
      setState('error');
    }
  }

  const productLabel =
    checkoutType === 'subscription'
      ? (() => {
          // plan param is like "professional_monthly" or "professional" — extract the plan name only
          const planName = plan
            ? plan
                .replace(/_(monthly|annual)$/i, '')          // strip billing cycle suffix
                .split('_')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')
            : '';
          return `${planName} plan (${cycle})`;
        })()
      : checkoutType === 'asset_license'
      ? `Image license (${licenseTypeCode ?? ''})`
      : checkoutType === 'credit_pack'
      ? `Credit pack (${creditPackCode ?? ''})`
      : '';

  // Intent summary for display (never lost — shown in all non-loading states)
  const intentSummary =
    checkoutType === 'subscription'
      ? { label: 'Plan', value: productLabel }
      : checkoutType === 'asset_license'
      ? {
          label: 'License',
          value: `${licenseTypeCode ?? ''} — asset ${assetId?.slice(0, 8) ?? ''}`,
        }
      : checkoutType === 'credit_pack'
      ? { label: 'Credit pack', value: creditPackCode ?? '' }
      : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-28 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">

          {/* Loading / Creating checkout */}
          {(state === 'loading' || state === 'creating_checkout') && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-secondary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {state === 'loading' ?'Preparing your checkout…'
                  : `Setting up ${productLabel}`}
              </h1>
              {state === 'creating_checkout' && (
                <p className="text-sm text-muted-foreground">
                  Creating your order and opening the secure checkout…
                </p>
              )}
              <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin mt-2" />
            </div>
          )}

          {/* Redirecting to Dodo */}
          {state === 'redirecting' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Redirecting to checkout…
              </h1>
              <p className="text-sm text-muted-foreground">
                You are being redirected to the secure Dodo Payments page.
              </p>
              <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin mt-2" />
            </div>
          )}

          {/* Dodo not configured — preserve intent, show clear message */}
          {state === 'not_configured' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Settings className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Dodo Payments is not configured
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                The payment provider is not yet configured. Please set{' '}
                <code className="bg-muted px-1 rounded text-xs">
                  DODO_PAYMENTS_API_KEY
                </code>{' '}
                and{' '}
                <code className="bg-muted px-1 rounded text-xs">
                  DODO_PAYMENTS_WEBHOOK_SECRET
                </code>{' '}
                in your environment variables to enable checkout.
              </p>

              {/* Purchase intent preserved — never lost */}
              {intentSummary && (
                <div className="w-full bg-muted/50 rounded-xl p-4 text-left mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Purchase intent (preserved)
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {intentSummary.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {intentSummary.value}
                    </span>
                  </div>
                  {checkoutType === 'subscription' && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-muted-foreground">
                        Billing cycle
                      </span>
                      <span className="text-sm font-semibold text-foreground capitalize">
                        {cycle}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <Link
                  href={
                    checkoutType === 'asset_license' && assetId
                      ? `/asset/${assetId}`
                      : '/pricing'
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
                >
                  {checkoutType === 'asset_license' ? 'Back to asset' : 'Back to Pricing'}
                </Link>
              </div>
            </div>
          )}

          {/* Error state — with retry, never silent redirect to home */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Checkout unavailable
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                {errorMessage ?? 'We could not start your checkout. Please try again.'}
              </p>

              {/* Show preserved intent even on error */}
              {intentSummary && (
                <div className="w-full bg-muted/50 rounded-xl p-4 text-left">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Your selection
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {intentSummary.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {intentSummary.value}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => {
                    startedRef.current = false;
                    setState('creating_checkout');
                    initiateCheckout();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Try again
                </button>
                <Link
                  href={
                    checkoutType === 'asset_license' && assetId
                      ? `/asset/${assetId}`
                      : '/pricing'
                  }
                  className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {checkoutType === 'asset_license' ? 'Back to asset' : 'Back to Pricing'}
                </Link>
              </div>
            </div>
          )}

          {/* No intent — clear message, never redirect to home */}
          {state === 'no_intent' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                No purchase intent found
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                We could not find a purchase intent to resume. Please select a plan or
                asset to purchase.
              </p>
              <div className="flex gap-3 mt-2">
                <Link
                  href="/pricing"
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
                >
                  View Pricing <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/library"
                  className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Browse Library
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
