'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, FileText, Download, CreditCard, Coins, Receipt, ChevronRight, AlertCircle } from 'lucide-react';

interface PurchaseSummary {
  totalOrders: number;
  paidOrders: number;
  activeLicenses: number;
  totalDownloads: number;
  creditBalance: number;
  activeSubscription: string | null;
}

const ACCOUNT_SECTIONS = [
  { href: '/account/purchases', icon: ShoppingBag, label: 'My Purchases', desc: 'Orders and payment history' },
  { href: '/account/licenses', icon: FileText, label: 'My Licenses', desc: 'Active and past digital licenses' },
  { href: '/account/downloads', icon: Download, label: 'Downloads', desc: 'Download history and entitlements' },
  { href: '/account/subscription', icon: CreditCard, label: 'Subscription', desc: 'Plan, renewal and billing cycle' },
  { href: '/account/credits', icon: Coins, label: 'Credits', desc: 'Balance, usage and history' },
  { href: '/account/orders', icon: Receipt, label: 'Orders & Billing', desc: 'Invoices and order references' },
];

export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const [ordersRes, licensesRes, downloadsRes, subsRes, creditsRes] = await Promise.all([
        supabase.from('orders').select('status').eq('user_id', user.id),
        supabase.from('purchased_licenses').select('status').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('download_events').select('id').eq('user_id', user.id),
        supabase.from('user_subscriptions').select('status, pricing_plans(name)').eq('user_id', user.id).eq('status', 'active').limit(1),
        supabase.rpc('get_user_credit_balance', { p_user_id: user.id }),
      ]);

      const orders = ordersRes.data ?? [];
      const activeSub = subsRes.data?.[0] as { pricing_plans?: { name?: string } } | undefined;

      setSummary({
        totalOrders: orders.length,
        paidOrders: orders.filter((o) => o.status === 'paid').length,
        activeLicenses: licensesRes.data?.length ?? 0,
        totalDownloads: downloadsRes.data?.length ?? 0,
        creditBalance: typeof creditsRes.data === 'number' ? creditsRes.data : 0,
        activeSubscription: activeSub?.pricing_plans?.name ?? null,
      });
    })();
  }, [user]);

  const handleSignOut = async () => {
    try { await signOut(); router.replace('/'); } catch { /* ignore */ }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        {/* Profile header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/10 border border-secondary/20 flex items-center justify-center">
            <span className="text-xl font-bold text-secondary">
              {(profile?.display_name ?? user.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile?.display_name ?? user.email?.split('@')[0] ?? 'My Account'}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize font-medium">
                {profile?.role ?? 'member'}
              </span>
              {summary?.activeSubscription && (
                <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
                  {summary.activeSubscription}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Orders', value: summary.totalOrders },
              { label: 'Licenses', value: summary.activeLicenses },
              { label: 'Downloads', value: summary.totalDownloads },
              { label: 'Credits', value: summary.creditBalance },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ACCOUNT_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:border-secondary/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-secondary/10 transition-colors">
                <section.icon className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{section.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-secondary transition-colors" />
            </Link>
          ))}
        </div>

        {/* Profile & collections links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { href: '/account/profile', label: 'Profile Settings', desc: 'Name, company, preferences' },
            { href: '/account/collections', label: 'My Collections', desc: 'Private asset collections' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-secondary/30 transition-all"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {/* Admin link */}
        {profile && ['reviewer', 'administrator', 'super_admin'].includes(profile.role ?? '') && (
          <div className="mb-6">
            <Link
              href="/admin"
              className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors"
            >
              <AlertCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-primary">Administration</p>
                <p className="text-xs text-muted-foreground">Access the admin dashboard</p>
              </div>
              <ChevronRight className="w-4 h-4 text-primary ml-auto" />
            </Link>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="text-sm text-muted-foreground hover:text-red-500 transition-colors font-medium"
        >
          Sign out
        </button>
      </main>
      <Footer />
    </div>
  );
}
