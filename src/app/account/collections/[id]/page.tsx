'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { FolderOpen, ArrowLeft, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCollectionById,
  fetchCollectionItems,
  removeFromCollection,
} from '@/lib/supabase/queries';
import type { Collection, CollectionItem } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const categoryEmoji: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪',
  'Fillets & Portions': '🍣', 'Frozen Products': '🧊', Packaging: '📦', Aquaculture: '🌊',
};

export default function CollectionDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const collectionId = params?.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/account/collections');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !collectionId) return;
    Promise.all([
      fetchCollectionById(collectionId, user.id),
      fetchCollectionItems(collectionId),
    ]).then(([col, colItems]) => {
      if (!col) {
        router.replace('/account/collections');
        return;
      }
      setCollection(col);
      setItems(colItems);
      setFetching(false);
    });
  }, [user, collectionId, router]);

  const handleRemove = async (item: CollectionItem) => {
    const ok = await removeFromCollection(collectionId, item.asset_id);
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('Removed from collection');
    } else {
      toast.error('Failed to remove item');
    }
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <Link href="/account/collections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to collections
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <FolderOpen size={18} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{collection?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} asset{items.length !== 1 ? 's' : ''} · {collection?.is_private ? 'Private' : 'Shared'}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📂</p>
            <h3 className="text-lg font-semibold text-foreground mb-2">Collection is empty</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Browse the library and add assets to this collection.
            </p>
            <Link href="/library" className="btn-primary">Browse library</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => {
              const asset = item.assets;
              const emoji = categoryEmoji[asset?.category || ''] || '🐠';
              return (
                <div key={item.id} className="group bg-card rounded-xl border border-border overflow-hidden shadow-card">
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    <span className="text-4xl">{emoji}</span>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRemove(item)}
                        className="w-7 h-7 rounded-lg bg-white text-red-500 flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors"
                        aria-label="Remove from collection"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                      {asset?.title || 'Untitled'}
                    </h3>
                    <p className="text-xs font-mono-data text-muted-foreground italic mt-0.5 line-clamp-1">
                      {asset?.species?.scientific_name || asset?.category || ''}
                    </p>
                    <Link
                      href={`/asset-detail?slug=${asset?.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-secondary hover:underline mt-2"
                    >
                      View asset
                      <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
