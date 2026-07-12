import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Camera } from 'lucide-react';

const similarAssets = [
  {
    id: 'asset-demo-002',
    slug: 'common-octopus-whole-fresh-sv002',
    title: 'Common Octopus — Whole, Fresh',
    scientificName: 'Octopus vulgaris',
    category: 'Cephalopods',
    isVerified: true,
    isRealPhoto: true,
    emoji: '🐙',
    bgColor: 'from-purple-200 to-purple-100',
  },
  {
    id: 'asset-demo-008',
    slug: 'atlantic-mackerel-fillet-frozen-sv008',
    title: 'Atlantic Mackerel — Fillet, Frozen',
    scientificName: 'Scomber scombrus',
    category: 'Fillets & Portions',
    isVerified: true,
    isRealPhoto: true,
    emoji: '🐟',
    bgColor: 'from-cyan-200 to-blue-100',
  },
  {
    id: 'asset-demo-004',
    slug: 'yellowfin-tuna-steak-sv004',
    title: 'Yellowfin Tuna — Steak, Fresh',
    scientificName: 'Thunnus albacares',
    category: 'Fish',
    isVerified: true,
    isRealPhoto: true,
    emoji: '🍣',
    bgColor: 'from-red-200 to-red-100',
  },
  {
    id: 'asset-demo-005',
    slug: 'european-sardine-whole-sv005',
    title: 'European Sardine — Whole, Fresh',
    scientificName: 'Sardina pilchardus',
    category: 'Fish',
    isVerified: false,
    isRealPhoto: true,
    emoji: '🐠',
    bgColor: 'from-slate-200 to-slate-100',
  },
  {
    id: 'asset-demo-011',
    slug: 'tuna-loin-frozen-sv011',
    title: 'Yellowfin Tuna — Loin, Frozen',
    scientificName: 'Thunnus albacares',
    category: 'Fillets & Portions',
    isVerified: true,
    isRealPhoto: true,
    emoji: '🍣',
    bgColor: 'from-rose-200 to-red-100',
  },
  {
    id: 'asset-demo-006',
    slug: 'common-cuttlefish-whole-sv006',
    title: 'Common Cuttlefish — Whole, Fresh',
    scientificName: 'Sepia officinalis',
    category: 'Cephalopods',
    isVerified: true,
    isRealPhoto: true,
    emoji: '🦑',
    bgColor: 'from-slate-200 to-indigo-100',
  },
];

interface SimilarAssetsProps {
  currentId: string;
  category: string;
}

export default function SimilarAssets({ currentId }: SimilarAssetsProps) {
  const shown = similarAssets.filter((a) => a.id !== currentId).slice(0, 6);

  return (
    <section className="mt-12 pt-10 border-t border-border">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Similar assets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Other seafood assets you might need
          </p>
        </div>
        <Link
          href="/library"
          className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          View all
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {shown.map((asset) => (
          <Link
            key={asset.id}
            href={`/asset-detail?slug=${asset.slug}`}
            className="group bg-card rounded-xl border border-border overflow-hidden card-hover shadow-card"
          >
            <div className={`relative aspect-[4/3] bg-gradient-to-br ${asset.bgColor} flex items-center justify-center overflow-hidden`}>
              <span className="text-3xl select-none">{asset.emoji}</span>
              <div className="absolute inset-0 bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <div className="absolute top-1.5 left-1.5 flex gap-1">
                {asset.isRealPhoto && (
                  <span className="w-4 h-4 rounded-full badge-real-photo flex items-center justify-center">
                    <Camera size={8} />
                  </span>
                )}
                {asset.isVerified && (
                  <span className="w-4 h-4 rounded-full badge-verified flex items-center justify-center">
                    <CheckCircle2 size={8} />
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5">
              <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                {asset.title}
              </h3>
              <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5 line-clamp-1">
                {asset.scientificName}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}