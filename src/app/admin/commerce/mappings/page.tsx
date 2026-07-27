'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Circle as XCircle, ExternalLink } from 'lucide-react';

interface Mapping {
  id: string;
  internal_product_type: string;
  internal_product_id: string;
  dodo_product_id: string | null;
  dodo_price_id: string | null;
  environment: string;
  currency: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminCommerceMappingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [fetching, setFetching] = useState(true);
  const dodoEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/mappings');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from('payment_product_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      setMappings(data ?? []);
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
            <span>Mappings</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dodo Payments Mappings</h1>
          <p className="text-muted-foreground text-sm mt-1">Map internal products to Dodo Payments product and price IDs</p>
        </div>

        {!dodoEnabled && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div>
              <strong>Dodo Payments is disabled.</strong> Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=true</code> and configure your API keys to enable checkout.
            </div>
          </div>
        )}

        {/* Dodo product lookup shortcut */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm mb-6">
          <div className="text-blue-800">
            <span className="font-medium">422 sur les packs crédits ?</span>{' '}
            Vérifiez les Product IDs réels dans votre compte Dodo TEST.
          </div>
          <Link
            href="/admin/commerce/dodo-products"
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex-shrink-0 ml-4"
          >
            <ExternalLink className="w-3 h-3" />
            Voir les produits Dodo
          </Link>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-6 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">How to add a mapping</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Create a product in your Dodo Payments test dashboard</li>
            <li>Copy the Dodo product ID and price ID</li>
            <li>Insert a row in <code className="bg-muted px-1 rounded">payment_product_mappings</code> via Supabase Studio</li>
            <li>Set <code className="bg-muted px-1 rounded">is_active = true</code> and <code className="bg-muted px-1 rounded">environment = test</code></li>
          </ol>
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading mappings…
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No mappings configured yet</p>
            <p className="text-sm mt-1">Add mappings via Supabase Studio once your Dodo Payments products are created.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-muted-foreground font-medium">Type</th>
                  <th className="pb-3 text-muted-foreground font-medium">Internal ID</th>
                  <th className="pb-3 text-muted-foreground font-medium">Dodo Product ID</th>
                  <th className="pb-3 text-muted-foreground font-medium">Dodo Price ID</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">Env</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">Active</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 text-xs font-mono text-muted-foreground">{m.internal_product_type}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">{m.internal_product_id}</td>
                    <td className="py-3 font-mono text-xs">{m.dodo_product_id ?? <span className="text-amber-500">Not set</span>}</td>
                    <td className="py-3 font-mono text-xs">{m.dodo_price_id ?? <span className="text-amber-500">Not set</span>}</td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.environment === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {m.environment}
                      </span>
                    </td>
                    <td className="py-3 text-center">{m.is_active ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}</td>
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
