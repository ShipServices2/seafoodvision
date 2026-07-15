'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  plan: { name: string; price_monthly: number; currency: string; downloads_monthly: number } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-green-600 bg-green-50 border-green-200' },
  trialing: { label: 'Trial', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  past_due: { label: 'Past Due', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50 border-red-200' },
  expired: { label: 'Expired', color: 'text-muted-foreground bg-muted border-border' },
  pending: { label: 'Pending', color: 'text-muted-foreground bg-muted border-border' },
};

export default function AccountSubscriptionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/subscription');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('user_subscriptions')
      .select('id, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, plan:pricing_plans(name, price_monthly, currency, downloads_monthly)')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setSubscription((data?.[0] as unknown as Subscription) ?? null);
        setFetching(false);
      });
  }, [user]);

  if (loading) return null;

  const cfg = subscription ? (STATUS_CONFIG[subscription.status] ?? STATUS_CONFIG.pending) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/account" className="hover:text-foreground">Account</Link>
            <span>/</span>
            <span>Subscription</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
              <p className="text-sm text-muted-foreground">Manage your plan and billing</p>
            </div>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : !subscription ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No active subscription</h3>
            <p className="text-sm text-muted-foreground mb-6">Upgrade to a paid plan to unlock downloads, HD access and more.</p>
            <Link href="/pricing" className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors">
              View Plans
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current plan card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{subscription.plan?.name ?? 'Unknown Plan'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg?.color}`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {cfg?.label}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{subscription.billing_cycle}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {subscription.plan?.price_monthly?.toFixed(2) ?? '—'} {subscription.plan?.currency ?? 'EUR'}
                  </p>
                  <p className="text-xs text-muted-foreground">/ month</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                {subscription.current_period_start && (
                  <div>
                    <p className="text-xs text-muted-foreground">Period start</p>
                    <p className="text-sm font-medium text-foreground">{new Date(subscription.current_period_start).toLocaleDateString()}</p>
                  </div>
                )}
                {subscription.current_period_end && (
                  <div>
                    <p className="text-xs text-muted-foreground">Renewal date</p>
                    <p className="text-sm font-medium text-foreground">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
                  </div>
                )}
                {subscription.plan?.downloads_monthly !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly downloads</p>
                    <p className="text-sm font-medium text-foreground">{subscription.plan.downloads_monthly}</p>
                  </div>
                )}
              </div>

              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Subscription will cancel at the end of the current period.
                </div>
              )}
            </div>

            {/* Manage subscription — future Dodo Payments */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">Manage Subscription</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Subscription management (upgrade, downgrade, cancellation) will be available once Dodo Payments is connected.
              </p>
              <button
                disabled
                className="inline-flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Manage Subscription — Coming Soon
              </button>
            </div>

            {/* Upgrade */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">Change Plan</h3>
              <Link href="/pricing" className="inline-flex items-center gap-2 border border-secondary text-secondary px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/5 transition-colors">
                View All Plans
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
