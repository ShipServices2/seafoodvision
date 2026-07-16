'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, RefreshCw, AlertCircle, ShoppingCart } from 'lucide-react';

type ResumeState = 'loading' | 'creating_checkout' | 'redirecting' | 'error' | 'no_intent';

export default function CheckoutResumeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const plan = searchParams.get('plan');
  const cycle = (searchParams.get('cycle') ?? 'monthly') as 'monthly' | 'annual';

  const [state, setState] = useState<ResumeState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Not authenticated — redirect to sign-in with params preserved
    if (!user) {
      const params = new URLSearchParams({
        return_to: '/checkout/resume',
        checkout_intent: '1',
        ...(plan ? { plan } : {}),
        cycle,
      });
      router.replace(`/auth/sign-in?${params.toString()}`);
      return;
    }

    // No plan selected
    if (!plan) {
      setState('no_intent');
      return;
    }

    // Prevent double-execution in StrictMode
    if (startedRef.current) return;
    startedRef.current = true;

    setState('creating_checkout');
    initiateCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  async function initiateCheckout() {
    try {
      const res = await fetch('/api/payments/dodo/subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: plan, billingCycle: cycle }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed');
      }

      const { checkoutUrl } = data as { checkoutUrl: string; orderId: string };

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-28 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">

          {state === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Preparing your checkout…</h1>
            </div>
          )}

          {state === 'creating_checkout' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-secondary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Setting up your <span className="capitalize">{plan}</span> plan
              </h1>
              <p className="text-sm text-muted-foreground">
                Creating your order and opening the checkout…
              </p>
              <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin mt-2" />
            </div>
          )}

          {state === 'redirecting' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                <ArrowRight className="w-8 h-8 text-secondary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Redirecting to checkout…</h1>
              <p className="text-sm text-muted-foreground">You are being redirected to the secure payment page.</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Checkout unavailable</h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                {errorMessage ?? 'We could not start your checkout. Please try again.'}
              </p>
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
                  href="/pricing"
                  className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Back to Pricing
                </Link>
              </div>
            </div>
          )}

          {state === 'no_intent' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">No plan selected</h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                It looks like your plan selection was lost. Please choose a plan to continue.
              </p>
              <Link
                href="/pricing"
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors mt-2"
              >
                View Plans <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}
