'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CategoryWithCount {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  count: number | null;
  emoji: string;
  color: string;
  imageBg: string;
}

const categoryMeta: Record<string, { emoji: string; color: string; imageBg: string }> = {
  fish: { emoji: '🐟', color: 'from-blue-900/80 to-blue-800/60', imageBg: 'bg-gradient-to-br from-blue-100 to-blue-200' },
  crustaceans: { emoji: '🦐', color: 'from-orange-900/80 to-orange-800/60', imageBg: 'bg-gradient-to-br from-orange-100 to-orange-200' },
  cephalopods: { emoji: '🐙', color: 'from-purple-900/80 to-purple-800/60', imageBg: 'bg-gradient-to-br from-purple-100 to-purple-200' },
  molluscs: { emoji: '🦪', color: 'from-teal-900/80 to-teal-800/60', imageBg: 'bg-gradient-to-br from-teal-100 to-teal-200' },
  'fillets-portions': { emoji: '🍣', color: 'from-red-900/80 to-red-800/60', imageBg: 'bg-gradient-to-br from-red-100 to-red-200' },
  'frozen-products': { emoji: '🧊', color: 'from-cyan-900/80 to-cyan-800/60', imageBg: 'bg-gradient-to-br from-cyan-100 to-cyan-200' },
  packaging: { emoji: '📦', color: 'from-slate-900/80 to-slate-800/60', imageBg: 'bg-gradient-to-br from-slate-100 to-slate-200' },
  aquaculture: { emoji: '🌊', color: 'from-emerald-900/80 to-emerald-800/60', imageBg: 'bg-gradient-to-br from-emerald-100 to-emerald-200' },
};

const fallbackCategories: CategoryWithCount[] = [
  { id: 'cat-fish', slug: 'fish', label: 'Fish', description: 'Whole, gutted, fillets, steaks', count: null, ...categoryMeta['fish'] },
  { id: 'cat-crustaceans', slug: 'crustaceans', label: 'Crustaceans', description: 'Shrimp, crab, lobster, langoustine', count: null, ...categoryMeta['crustaceans'] },
  { id: 'cat-cephalopods', slug: 'cephalopods', label: 'Cephalopods', description: 'Octopus, squid, cuttlefish', count: null, ...categoryMeta['cephalopods'] },
  { id: 'cat-molluscs', slug: 'molluscs', label: 'Molluscs', description: 'Mussels, oysters, clams, scallops', count: null, ...categoryMeta['molluscs'] },
  { id: 'cat-fillets', slug: 'fillets-portions', label: 'Fillets & Portions', description: 'Processed cuts, portions, loins', count: null, ...categoryMeta['fillets-portions'] },
  { id: 'cat-frozen', slug: 'frozen-products', label: 'Frozen Products', description: 'IQF, block frozen, glazed', count: null, ...categoryMeta['frozen-products'] },
  { id: 'cat-packaging', slug: 'packaging', label: 'Packaging', description: 'Retail packs, bulk, vacuum, MAP', count: null, ...categoryMeta['packaging'] },
  { id: 'cat-aquaculture', slug: 'aquaculture', label: 'Aquaculture', description: 'Farmed species, production context', count: null, ...categoryMeta['aquaculture'] },
];

export default function CategoryCards() {
  const [categories, setCategories] = useState<CategoryWithCount[]>(fallbackCategories);

  useEffect(() => {
    const fetchCategoryCounts = async () => {
      try {
        const supabase = createClient();
        const { data: cats } = await supabase
          .from('categories')
          .select('id, slug, label, description')
          .eq('is_active', true)
          .order('sort_order');

        if (!cats || cats.length === 0) return;

        const countsPromises = cats.map(async (cat) => {
          const { count } = await supabase
            .from('assets')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat.label)
            .eq('is_demo', false)
            .in('review_status', ['approved', 'commercial', 'editorial']);
          return { slug: cat.slug, count: count ?? 0 };
        });

        const counts = await Promise.all(countsPromises);
        const countMap = Object.fromEntries(counts.map((c) => [c.slug, c.count]));

        setCategories(
          cats.map((cat) => ({
            id: cat.id,
            slug: cat.slug,
            label: cat.label,
            description: cat.description,
            count: countMap[cat.slug] ?? null,
            ...(categoryMeta[cat.slug] || {
              emoji: '🐠',
              color: 'from-blue-900/80 to-blue-800/60',
              imageBg: 'bg-gradient-to-br from-blue-100 to-blue-200',
            }),
          }))
        );
      } catch {
        // Keep fallback categories without counts
      }
    };

    fetchCategoryCounts();
  }, []);

  return (
    <section className="py-20 max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Browse by Category
          </p>
          <h2 className="section-title">Explore the full spectrum of seafood</h2>
          <p className="section-subtitle mt-2 max-w-xl">
            From whole fish to processed portions, every product form documented with scientific precision.
          </p>
        </div>
        <Link
          href="/library"
          className="hidden sm:flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors duration-150 shrink-0"
        >
          View all assets
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {categories?.map((cat) => (
          <Link
            key={cat?.id}
            href={`/library?category=${encodeURIComponent(cat?.slug)}`}
            className="group relative rounded-2xl overflow-hidden border border-border card-hover bg-card shadow-card"
          >
            {/* Visual area */}
            <div className={`relative h-36 ${cat?.imageBg} flex items-center justify-center overflow-hidden`}>
              <span className="text-5xl">{cat?.emoji}</span>
              {/* Hover overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${cat?.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center`}
              >
                <ArrowRight size={24} className="text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {cat?.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {cat?.description}
                  </p>
                </div>
                {cat?.count !== null && cat.count > 0 && (
                  <span className="text-xs font-mono-data font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {cat.count.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6 sm:hidden text-center">
        <Link href="/library" className="btn-outline">
          View all assets
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}