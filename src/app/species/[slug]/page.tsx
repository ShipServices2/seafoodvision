'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, Fish } from 'lucide-react';
import { fetchSpeciesBySlug, fetchSpeciesAssets } from '@/lib/supabase/queries';
import type { Species, Asset } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const categoryEmoji: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪',
  'Fillets & Portions': '🍣', 'Frozen Products': '🧊', Packaging: '📦', Aquaculture: '🌊',
};

const speciesEmoji: Record<string, { emoji: string; bgColor: string }> = {
  'sardina-pilchardus': { emoji: '🐠', bgColor: 'bg-gradient-to-br from-blue-100 to-blue-50' },
  'scomber-scombrus': { emoji: '🐟', bgColor: 'bg-gradient-to-br from-teal-100 to-teal-50' },
  'thunnus-albacares': { emoji: '🐡', bgColor: 'bg-gradient-to-br from-yellow-100 to-amber-50' },
  'octopus-vulgaris': { emoji: '🐙', bgColor: 'bg-gradient-to-br from-purple-100 to-purple-50' },
  'loligo-vulgaris': { emoji: '🦑', bgColor: 'bg-gradient-to-br from-indigo-100 to-indigo-50' },
  'sepia-officinalis': { emoji: '🦑', bgColor: 'bg-gradient-to-br from-slate-100 to-slate-50' },
  'penaeus-monodon': { emoji: '🦐', bgColor: 'bg-gradient-to-br from-orange-100 to-orange-50' },
};
const defaultMeta = { emoji: '🐠', bgColor: 'bg-gradient-to-br from-blue-100 to-blue-50' };

export default function SpeciesDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [species, setSpecies] = useState<Species | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      fetchSpeciesBySlug(slug),
      fetchSpeciesAssets('', 12),
    ]).then(([sp]) => {
      if (!sp) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSpecies(sp);
      fetchSpeciesAssets(sp.id, 12).then((a) => {
        setAssets(a);
        setLoading(false);
      });
    });
  }, [slug]);

  const meta = species ? (speciesEmoji[species.slug] || defaultMeta) : defaultMeta;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !species) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16 text-center">
          <p className="text-5xl mb-4">🐟</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">Species not found</h1>
          <p className="text-muted-foreground mb-6">This species page does not exist or has been removed.</p>
          <Link href="/species" className="btn-primary">View all species</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/species" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          All species
        </Link>

        {/* Hero */}
        <div className={`relative rounded-2xl overflow-hidden mb-8 ${meta.bgColor} h-48 flex items-center justify-center`}>
          <span className="text-8xl">{meta.emoji}</span>
          {species.is_demo && (
            <div className="absolute top-4 left-4">
              <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded-full font-medium">
                Demonstration species
              </span>
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">{species.common_name}</h1>
            <p className="text-lg font-mono-data text-muted-foreground italic mb-4">
              {species.scientific_name}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {species.family && (
                <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                  {species.family}
                </span>
              )}
              {species.category && (
                <span className="text-sm bg-secondary/10 text-secondary px-3 py-1 rounded-full font-medium">
                  {species.category}
                </span>
              )}
              {species.is_validated && (
                <span className="text-sm badge-verified px-3 py-1 rounded-full font-medium">
                  Validated
                </span>
              )}
            </div>

            {species.description && (
              <p className="text-muted-foreground leading-relaxed">{species.description}</p>
            )}
          </div>

          {/* Metadata card */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4 h-fit">
            <h3 className="text-sm font-semibold text-foreground">Species Data</h3>
            {[
              { label: 'Scientific Name', value: species.scientific_name, mono: true, italic: true },
              { label: 'Family', value: species.family || '—', mono: false },
              { label: 'Category', value: species.category || '—', mono: false },
              { label: 'FAO Areas', value: species.fao_areas?.join(', ') || '—', mono: true },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{row.label}</span>
                <span className={`text-sm text-foreground ${row.mono ? 'font-mono-data' : ''} ${row.italic ? 'italic' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Associated media */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">
              Associated Media
              {assets.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({assets.length} asset{assets.length !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
            <Link href={`/library?species=${encodeURIComponent(species.common_name)}`} className="text-sm text-secondary font-medium hover:underline">
              View all in library →
            </Link>
          </div>

          {assets.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <ImageIcon size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No approved media yet for this species.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {assets.map((asset) => {
                const emoji = categoryEmoji[asset.category || ''] || '🐠';
                return (
                  <Link
                    key={asset.id}
                    href={`/asset-detail?slug=${asset.slug}`}
                    className="group bg-card rounded-xl border border-border overflow-hidden card-hover shadow-card"
                  >
                    <div className="aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                      <span className="text-3xl">{emoji}</span>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-semibold text-foreground line-clamp-1">{asset.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{asset.product_form || asset.category}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
