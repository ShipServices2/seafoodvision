'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Circle as XCircle, Search } from 'lucide-react';

interface DodoProduct {
  product_id: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  is_recurring: boolean;
}

interface DbMapping {
  dodo_product_id: string | null;
  internal_product_type: string;
  environment: string;
  is_active: boolean;
  credit_packs: {
    pack_code: string;
    credits: number;
    price: number;
  } | null;
}

interface ProductsResponse {
  environment: string;
  dodo_mode: string;
  one_time_products: DodoProduct[];
  recurring_products: DodoProduct[];
  current_db_credit_mappings: DbMapping[];
  total_one_time: number;
  total_recurring: number;
}

const EXPECTED_CREDIT_PACKS = [
  { pack_code: 'credits_100', credits: 100, price_eur: 9 },
  { pack_code: 'credits_250', credits: 250, price_eur: 19 },
  { pack_code: 'credits_500', credits: 500, price_eur: 35 },
  { pack_code: 'credits_1000', credits: 1000, price_eur: 59 },
];

export default function DodoProductsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/dodo-products');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  const fetchProducts = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/dodo/list-products');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setFetching(false);
    }
  };

  const filteredOneTime = (data?.one_time_products ?? []).filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.product_id.toLowerCase().includes(q) ||
      (p.name ?? '').toLowerCase().includes(q)
    );
  });

  const currentMappedIds = new Set(
    (data?.current_db_credit_mappings ?? []).map((m) => m.dodo_product_id).filter(Boolean)
  );

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
            <Link href="/admin/commerce/mappings" className="hover:text-foreground">Mappings</Link>
            <span>/</span>
            <span>Dodo Products</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dodo TEST Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lists all real products in your connected Dodo TEST account. Use these Product IDs to fix credit pack mappings.
          </p>
        </div>

        {/* Context banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800">
              <p className="font-semibold mb-1">422 Error — Product IDs in DB do not exist in Dodo TEST</p>
              <p className="mb-2">
                The 4 credit pack mappings currently stored in <code className="bg-amber-100 px-1 rounded">payment_product_mappings</code> reference
                Product IDs that were never created in Dodo. Use this page to find the real Product IDs from your Dodo TEST account,
                then update the migration below.
              </p>
              <p className="font-medium">Expected credit packs:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {EXPECTED_CREDIT_PACKS.map((p) => (
                  <li key={p.pack_code}>
                    <code className="bg-amber-100 px-1 rounded">{p.pack_code}</code> — {p.credits} crédits — {p.price_eur} EUR
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Fetch button */}
        {!data && !fetching && (
          <div className="text-center py-12">
            <button
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <Search className="w-4 h-4" />
              Charger les produits Dodo TEST
            </button>
            <p className="text-xs text-muted-foreground mt-3">Appelle l&apos;API Dodo TEST avec votre clé configurée</p>
          </div>
        )}

        {fetching && (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Chargement des produits Dodo TEST…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <div>
              <strong>Erreur :</strong> {error}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Environnement</p>
                <p className="text-lg font-bold text-foreground capitalize">{data.environment}</p>
                <p className="text-xs text-muted-foreground">{data.dodo_mode}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Produits one-time</p>
                <p className="text-lg font-bold text-foreground">{data.total_one_time}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Produits récurrents</p>
                <p className="text-lg font-bold text-foreground">{data.total_recurring}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Mappings crédits DB</p>
                <p className="text-lg font-bold text-foreground">{data.current_db_credit_mappings.length}</p>
              </div>
            </div>

            {/* Current DB mappings vs Dodo */}
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h2 className="font-semibold text-foreground mb-3">Mappings crédits actuels en DB</h2>
              {data.current_db_credit_mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun mapping crédit actif trouvé en DB pour l&apos;environnement {data.environment}.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 text-muted-foreground font-medium">Pack code</th>
                      <th className="pb-2 text-muted-foreground font-medium">Crédits</th>
                      <th className="pb-2 text-muted-foreground font-medium">Prix</th>
                      <th className="pb-2 text-muted-foreground font-medium">Dodo Product ID (DB)</th>
                      <th className="pb-2 text-muted-foreground font-medium text-center">Existe dans Dodo?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.current_db_credit_mappings.map((m, i) => {
                      const existsInDodo = m.dodo_product_id
                        ? data.one_time_products.some((p) => p.product_id === m.dodo_product_id)
                        : false;
                      return (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 font-mono text-xs">{m.credit_packs?.pack_code ?? '—'}</td>
                          <td className="py-2 text-xs">{m.credit_packs?.credits ?? '—'}</td>
                          <td className="py-2 text-xs">{m.credit_packs?.price ?? '—'} EUR</td>
                          <td className="py-2 font-mono text-xs text-muted-foreground">{m.dodo_product_id ?? 'Non défini'}</td>
                          <td className="py-2 text-center">
                            {existsInDodo
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* One-time products from Dodo */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground">
                  Produits one-time dans Dodo TEST ({data.total_one_time})
                </h2>
                <button
                  onClick={fetchProducts}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Rafraîchir
                </button>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrer par nom ou Product ID…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {filteredOneTime.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {data.total_one_time === 0
                      ? 'Aucun produit one-time trouvé dans votre compte Dodo TEST. Créez les 4 packs crédits dans le dashboard Dodo.'
                      : 'Aucun résultat pour ce filtre.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-3 text-muted-foreground font-medium">Product ID</th>
                        <th className="pb-3 text-muted-foreground font-medium">Nom</th>
                        <th className="pb-3 text-muted-foreground font-medium">Prix</th>
                        <th className="pb-3 text-muted-foreground font-medium">Devise</th>
                        <th className="pb-3 text-muted-foreground font-medium text-center">Mappé en DB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOneTime.map((p) => (
                        <tr key={p.product_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3">
                            <code
                              className="font-mono text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => navigator.clipboard?.writeText(p.product_id)}
                              title="Cliquer pour copier"
                            >
                              {p.product_id}
                            </code>
                          </td>
                          <td className="py-3 text-sm">{p.name ?? <span className="text-muted-foreground italic">Sans nom</span>}</td>
                          <td className="py-3 text-sm">
                            {p.price !== null ? (p.price / 100).toFixed(2) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">{p.currency ?? '—'}</td>
                          <td className="py-3 text-center">
                            {currentMappedIds.has(p.product_id)
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">Comment corriger les mappings</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Identifiez les 4 Product IDs one-time correspondant aux packs 9€, 19€, 35€, 59€ EUR ci-dessus.</li>
                <li>
                  Créez une nouvelle migration SQL dans <code className="bg-blue-100 px-1 rounded">supabase/migrations/</code> avec les vrais Product IDs.
                </li>
                <li>Appliquez la migration via Supabase (Push to Supabase).</li>
                <li>Testez les 4 checkouts crédits.</li>
              </ol>
              <p className="mt-3 text-xs text-blue-600">
                Si aucun produit one-time n&apos;apparaît, créez d&apos;abord les 4 produits dans votre{' '}
                <a
                  href="https://dashboard.dodopayments.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-800"
                >
                  dashboard Dodo TEST
                </a>.
              </p>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
