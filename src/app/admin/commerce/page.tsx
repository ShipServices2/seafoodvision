'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart2, ShoppingCart, CreditCard, FileText, Download, Coins,
  Package, Map, Webhook, Settings, Users, Tag, Layers, RefreshCw,
  TrendingUp, AlertCircle
} from 'lucide-react';

interface CommerceStats {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  activeSubscriptions: number;
  totalRevenue: number;
  activeLicenses: number;
  totalDownloads: number;
  totalCustomers: number;
}

const COMMERCE_SECTIONS = [
  { href: '/admin/commerce/orders', icon: ShoppingCart, label: 'Orders', desc: 'All orders, statuses and payment references', badge: 'Orders' },
  { href: '/admin/commerce/payments', icon: CreditCard, label: 'Payments', desc: 'Payment transactions and provider status', badge: 'Payments' },
  { href: '/admin/commerce/licenses', icon: FileText, label: 'Licenses', desc: 'Purchased licenses and entitlements', badge: 'Licenses' },
  { href: '/admin/commerce/downloads', icon: Download, label: 'Downloads', desc: 'Download events and quota monitoring', badge: 'Downloads' },
  { href: '/admin/commerce/dodo-credit-config', icon: Coins, label: 'Credits', desc: 'Credit ledger and pack management', badge: 'Credits' },
  { href: '/admin/commerce/products', icon: Package, label: 'Products', desc: 'Unit products, plans and credit packs', badge: 'Catalog' },
  { href: '/admin/commerce/plans', icon: TrendingUp, label: 'Plans', desc: 'Subscription plans, pricing and quotas', badge: 'Plans' },
  { href: '/admin/commerce/coupons', icon: Tag, label: 'Coupons & Promotions', desc: 'Discount codes, campaigns and promotions', badge: 'Promos' },
  { href: '/admin/commerce/collections', icon: Layers, label: 'Collections', desc: 'Commercial collections and packs', badge: 'Collections' },
  { href: '/admin/commerce/customers', icon: Users, label: 'Customers', desc: 'Customer accounts and purchase history', badge: 'Customers' },
  { href: '/admin/commerce/refunds', icon: RefreshCw, label: 'Refunds', desc: 'Refund requests and workflow', badge: 'Refunds' },
  { href: '/admin/commerce/reports', icon: BarChart2, label: 'Reports', desc: 'Revenue, sales, downloads and license reports', badge: 'Reports' },
  { href: '/admin/commerce/mappings', icon: Map, label: 'Dodo Mappings', desc: 'Map internal products to Dodo Payments IDs', badge: 'Dodo' },
  { href: '/admin/commerce/webhooks', icon: Webhook, label: 'Webhooks', desc: 'Incoming webhook events and processing status', badge: 'Events' },
  { href: '/admin/commerce/settings', icon: Settings, label: 'Settings', desc: 'Marketplace configuration and payment provider', badge: 'Config' },
];

export default function AdminCommercePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<CommerceStats | null>(null);
  const dodoEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const [ordersRes, subsRes, licensesRes, downloadsRes, customersRes] = await Promise.all([
        supabase.from('orders').select('status, total_amount'),
        supabase.from('user_subscriptions').select('status').eq('status', 'active'),
        supabase.from('purchased_licenses').select('status').eq('status', 'active'),
        supabase.from('download_events').select('id'),
        supabase.from('orders').select('user_id'),
      ]);
      const orders = ordersRes.data ?? [];
      const paid = orders.filter((o) => o.status === 'paid');
      const pending = orders.filter((o) => o.status === 'pending');
      const uniqueCustomers = new Set((customersRes.data ?? []).map((o) => o.user_id)).size;
      setStats({
        totalOrders: orders.length,
        paidOrders: paid.length,
        pendingOrders: pending.length,
        activeSubscriptions: subsRes.data?.length ?? 0,
        totalRevenue: paid.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
        activeLicenses: licensesRes.data?.length ?? 0,
        totalDownloads: downloadsRes.data?.length ?? 0,
        totalCustomers: uniqueCustomers,
      });
    })();
  }, [user]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/admin" className="hover:text-foreground">Admin</Link>
            <span>/</span>
            <span>Commerce</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Commerce</h1>
              <p className="text-muted-foreground text-sm mt-1">Marketplace — Phase 7.2 · Dodo Payments (future)</p>
            </div>
            {!dodoEnabled && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Dodo Payments (Not Configured)
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total orders', value: stats.totalOrders },
              { label: 'Paid orders', value: stats.paidOrders },
              { label: 'Active subscriptions', value: stats.activeSubscriptions },
              { label: `Revenue (test)`, value: `${stats.totalRevenue.toFixed(2)} €` },
              { label: 'Active licenses', value: stats.activeLicenses },
              { label: 'Total downloads', value: stats.totalDownloads },
              { label: 'Customers', value: stats.totalCustomers },
              { label: 'Pending orders', value: stats.pendingOrders },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sections grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMMERCE_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bg-card border border-border rounded-xl p-5 hover:border-secondary/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <section.icon className="w-5 h-5 text-secondary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {section.badge}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{section.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{section.desc}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
