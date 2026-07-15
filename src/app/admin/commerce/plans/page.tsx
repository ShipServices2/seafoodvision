'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  plan_code: string | null;
  price_monthly: number | null;
  price_annual: number | null;
  currency: string | null;
  downloads_monthly: number | null;
  ai_access: boolean | null;
  api_access: boolean | null;
  is_active: boolean;
  is_enterprise: boolean | null;
  sort_order: number | null;
}

export default function AdminCommercePlansPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/plans');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from('pricing_plans')
        .select('id, name, plan_code, price_monthly, price_annual, currency, downloads_monthly, ai_access, api_access, is_active, is_enterprise, sort_order')
        .order('sort_order', { ascending: true });
      setPlans(data ?? []);
      setFetching(false);
    })();
  }, [user]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/admin" className="hover:text-foreground">Admin</Link>
            <span>/</span>
            <Link href="/admin/commerce" className="hover:text-foreground">Commerce</Link>
            <span>/</span>
            <span>Plans</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage plan pricing, quotas and billing cycles</p>
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading plans…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-muted-foreground font-medium">Plan</th>
                  <th className="pb-3 text-muted-foreground font-medium">Code</th>
                  <th className="pb-3 text-muted-foreground font-medium text-right">Monthly</th>
                  <th className="pb-3 text-muted-foreground font-medium text-right">Annual</th>
                  <th className="pb-3 text-muted-foreground font-medium text-right">Downloads</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">AI</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">API</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{p.plan_code ?? '—'}</td>
                    <td className="py-3 text-right font-mono">
                      {p.price_monthly != null ? `${Number(p.price_monthly).toFixed(2)} ${p.currency ?? 'EUR'}` : 'Quote'}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {p.price_annual != null ? `${Number(p.price_annual).toFixed(2)} ${p.currency ?? 'EUR'}` : 'Quote'}
                    </td>
                    <td className="py-3 text-right">{p.downloads_monthly ?? '∞'}</td>
                    <td className="py-3 text-center">{p.ai_access ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}</td>
                    <td className="py-3 text-center">{p.api_access ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}</td>
                    <td className="py-3 text-center">{p.is_active ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
