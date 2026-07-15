'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Package, CreditCard, Map, Webhook, Settings, BarChart2, ShoppingCart, AlertCircle } from 'lucide-react';

interface CommerceStats {
  totalOrders: number;
  paidOrders: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

const COMMERCE_SECTIONS = [
  { href: '/admin/commerce/products', icon: Package, label: 'Products & Plans', desc: 'Manage unit products, subscription plans, credit packs and license types', badge: 'Catalog' },
  { href: '/admin/commerce/plans', icon: CreditCard, label: 'Subscription Plans', desc: 'Configure plan pricing, quotas, billing cycles and trial periods', badge: 'Plans' },
  { href: '/admin/commerce/mappings', icon: Map, label: 'Dodo Mappings', desc: 'Map internal products to Dodo Payments product and price IDs', badge: 'Dodo' },
  { href: '/admin/commerce/webhooks', icon: Webhook, label: 'Webhook Events', desc: 'Monitor incoming webhook events, processing status and errors', badge: 'Events' },
  { href: '/admin/commerce/settings', icon: Settings, label: 'Payment Settings', desc: 'Configure Dodo Payments environment, keys and return URLs', badge: 'Config' },
];

export default function AdminCommercePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<CommerceStats | null>(null);
  const [dodoEnabled] = useState(process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) {
      router.replace('/admin');
    }
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const [ordersRes, subsRes] = await Promise.all([
        supabase.from('orders').select('status, total_amount'),
        supabase.from('user_subscriptions').select('status').eq('status', 'active'),
      ]);
      const orders = ordersRes.data ?? [];
      const paid = orders.filter((o) => o.status === 'paid');
      setStats({
        totalOrders: orders.length,
        paidOrders: paid.length,
        activeSubscriptions: subsRes.data?.length ?? 0,
        totalRevenue: paid.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
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
              <p className="text-muted-foreground text-sm mt-1">Dodo Payments infrastructure — Phase 7.2</p>
            </div>
            {!dodoEnabled && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Dodo Payments disabled
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total orders', value: stats.totalOrders, icon: ShoppingCart },
              { label: 'Paid orders', value: stats.paidOrders, icon: CreditCard },
              { label: 'Active subscriptions', value: stats.activeSubscriptions, icon: BarChart2 },
              { label: 'Revenue (test)', value: `${stats.totalRevenue.toFixed(2)} €`, icon: Package },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sections */}
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
