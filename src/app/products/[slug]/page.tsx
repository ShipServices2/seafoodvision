'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, CheckCircle, Globe, Layers, Fish } from 'lucide-react';
import {
  fetchEncProductBySlug,
  fetchProductSpecies,
  fetchProductMarkets,
  type EncProduct,
  type EncSpecies,
  type EncMarket,
} from '@/lib/supabase/encyclopediaQueries';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  under_review: 'bg-amber-100 text-amber-700 border-amber-200',
  suggested: 'bg-blue-100 text-blue-700 border-blue-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

type Tab = 'overview' | 'species' | 'markets';

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [product, setProduct] = useState<EncProduct | null>(null);
  const [species, setSpecies] = useState<EncSpecies[]>([]);
  const [markets, setMarkets] = useState<EncMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!slug) return;
    fetchEncProductBySlug(slug).then(async (p) => {
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProduct(p);
      const [sp, mk] = await Promise.all([fetchProductSpecies(p.id), fetchProductMarkets(p.id)]);
      setSpecies(sp); setMarkets(mk);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-muted rounded w-48" />
            <div className="h-40 bg-muted rounded-2xl" />
            <div className="h-6 bg-muted rounded w-1/3" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 pt-24 pb-16 text-center">
          <p className="text-5xl mb-4">🐟</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">Product not found</h1>
          <p className="text-muted-foreground mb-6">This product page does not exist or is not publicly available.</p>
          <Link href="/products" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-ocean-800 transition-colors">View all products</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'species', label: 'Species', count: species.length },
    { key: 'markets', label: 'Markets', count: markets.length },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/knowledge" className="hover:text-foreground transition-colors">Knowledge</Link>
          <ChevronRight size={12} />
          <Link href="/products" className="hover:text-foreground transition-colors">Products</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.public_name}</span>
        </nav>

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-ocean-900 to-ocean-700 h-40 flex items-center justify-center">
          <span className="text-8xl">🐟</span>
          <div className="absolute top-4 left-4 flex gap-2">
            {product.status === 'verified' && (
              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold">
                <CheckCircle size={11} /> Verified
              </span>
            )}
            {product.is_demo && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-semibold">
                <Layers size={11} /> Demo
              </span>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-3">{product.public_name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_BADGE[product.status] || STATUS_BADGE.draft}`}>
                {product.status.replace('_', ' ')}
              </span>
            </div>
            {product.description && (
              <p className="text-muted-foreground leading-relaxed text-sm max-w-2xl">{product.description}</p>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-3 h-fit">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Product Data</h3>
            {[
              { label: 'Presentation', value: product.product_forms?.name || '—' },
              { label: 'Processing', value: product.processing_methods?.name || '—' },
              { label: 'Preservation', value: product.preservation_methods?.name || '—' },
              { label: 'Freezing', value: product.freezing_methods?.name || '—' },
              { label: 'Status', value: product.status },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{row.label}</span>
                <span className="text-sm text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-8">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground'}`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Species', value: species.length, icon: Fish },
              { label: 'Markets', value: markets.length, icon: Globe },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                  <Icon size={18} className="text-muted-foreground mb-2" />
                  <div className="text-2xl font-bold text-foreground font-mono-data">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'species' && (
          <div>
            {species.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Fish size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No species linked to this product yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {species.map((sp) => (
                  <Link key={sp.id} href={`/species/${sp.slug}`} className="bg-card rounded-xl border border-border p-4 hover:border-secondary/40 transition-all">
                    <h4 className="text-sm font-semibold text-foreground">{sp.common_name}</h4>
                    <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5">{sp.scientific_name}</p>
                    <div className="flex gap-1.5 mt-2">
                      {sp.family && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{sp.family}</span>}
                      {sp.is_validated && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'markets' && (
          <div>
            {markets.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Globe size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No verified market links for this product.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {markets.map((m) => (
                  <Link key={m.id} href={`/markets/${m.slug}`} className="bg-card rounded-xl border border-border p-4 hover:border-secondary/40 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{m.name}</h4>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">{m.market_type}</span>
                    </div>
                    {m.region && <p className="text-xs text-muted-foreground">{m.region}</p>}
                  </Link>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              ⚠️ Market information is for professional reference and may require independent verification.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
