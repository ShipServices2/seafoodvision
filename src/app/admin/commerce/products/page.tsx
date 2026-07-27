'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Package, CreditCard, Tag, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';

interface UnitProduct { id: string; product_code: string; name: string; price: number; currency: string; is_active: boolean; product_type: string; }
interface CreditPack { id: string; pack_code: string; name: string; credits: number; price: number; currency: string; is_active: boolean; is_popular: boolean; }
interface LicenseType { id: string; code: string; name: string; price: number | null; currency: string; is_active: boolean; is_exclusive: boolean; }

type Tab = 'products' | 'credits' | 'licenses';

export default function AdminCommerceProductsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<UnitProduct[]>([]);
  const [credits, setCredits] = useState<CreditPack[]>([]);
  const [licenses, setLicenses] = useState<LicenseType[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/products');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      setFetching(true);
      const [p, c, l] = await Promise.all([
        supabase.from('unit_products').select('*').order('price'),
        supabase.from('credit_packs').select('*').order('credits'),
        supabase.from('license_types').select('*').order('name'),
      ]);
      setProducts(p.data ?? []);
      setCredits(c.data ?? []);
      setLicenses(l.data ?? []);
      setFetching(false);
    })();
  }, [user]);

  if (loading) return null;

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'products', label: 'Unit Products', icon: Package, count: products.length },
    { id: 'credits', label: 'Credit Packs', icon: CreditCard, count: credits.length },
    { id: 'licenses', label: 'License Types', icon: Tag, count: licenses.length },
  ];

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
            <span>Products</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Products & Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">Unit products, credit packs and license types</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {tab === 'products' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-muted-foreground font-medium">Code</th>
                      <th className="pb-3 text-muted-foreground font-medium">Name</th>
                      <th className="pb-3 text-muted-foreground font-medium">Type</th>
                      <th className="pb-3 text-muted-foreground font-medium text-right">Price</th>
                      <th className="pb-3 text-muted-foreground font-medium text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 font-mono text-xs text-muted-foreground">{p.product_code}</td>
                        <td className="py-3 font-medium text-foreground">{p.name}</td>
                        <td className="py-3 text-muted-foreground capitalize">{p.product_type}</td>
                        <td className="py-3 text-right font-mono">{p.price.toFixed(2)} {p.currency}</td>
                        <td className="py-3 text-center">
                          {p.is_active ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'credits' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {credits.map((c) => (
                  <div key={c.id} className={`bg-card border rounded-xl p-5 ${c.is_popular ? 'border-secondary ring-1 ring-secondary/20' : 'border-border'}`}>
                    {c.is_popular && <div className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2">Popular</div>}
                    <div className="text-lg font-bold text-foreground mb-1">{c.name}</div>
                    <div className="text-3xl font-extrabold text-foreground mb-1">{c.price.toFixed(2)}<span className="text-base font-normal text-muted-foreground"> {c.currency}</span></div>
                    <div className="text-sm text-muted-foreground mb-3">{c.credits} credits</div>
                    <div className="flex items-center gap-1 text-xs">
                      {c.is_active ? <><CheckCircle2 className="w-3 h-3 text-green-500" /><span className="text-green-600">Active</span></> : <><XCircle className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Inactive</span></>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'licenses' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 text-muted-foreground font-medium">Code</th>
                      <th className="pb-3 text-muted-foreground font-medium">Name</th>
                      <th className="pb-3 text-muted-foreground font-medium text-right">Price</th>
                      <th className="pb-3 text-muted-foreground font-medium text-center">Exclusive</th>
                      <th className="pb-3 text-muted-foreground font-medium text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((l) => (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 font-mono text-xs text-muted-foreground">{l.code}</td>
                        <td className="py-3 font-medium text-foreground">{l.name}</td>
                        <td className="py-3 text-right font-mono">{l.price != null ? `${Number(l.price).toFixed(2)} ${l.currency}` : 'Negotiated'}</td>
                        <td className="py-3 text-center">{l.is_exclusive ? <CheckCircle2 className="w-4 h-4 text-amber-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}</td>
                        <td className="py-3 text-center">{l.is_active ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
