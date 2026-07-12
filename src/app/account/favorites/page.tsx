'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowLeft, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserFavorites, removeFavorite } from '@/lib/supabase/queries';
import type { Favorite } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const categoryEmoji: Record<string, string> = {
  Fish: '🐟', Crustaceans: '🦐', Cephalopods: '🐙', Molluscs: '🦪',
  'Fillets & Portions': '🍣', 'Frozen Products': '🧊', Packaging: '📦', Aquaculture: '🌊',
};

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/account/favorites');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchUserFavorites(user.id).then((data) => {
      setFavorites(data);
      setFetching(false);
    });
  }, [user]);

  const handleRemove = async (favorite: Favorite) => {
    if (!user) return;
    const ok = await removeFavorite(user.id, favorite.asset_id);
    if (ok) {
      setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
      toast.success('Removed from favorites');
    } else {
      toast.error('Failed to remove favorite');
    }
  };

  if (loading || !user) {
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
        <Link href="/account" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} />
          Back to account
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Heart size={18} className="text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Favorites</h1>
            <p className="text-sm text-muted-foreground">
              {fetching ? 'Loading…' : `${favorites.length} saved asset${favorites.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {fetching ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skel-${i}`} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">💙</p>
            <h3 className="text-lg font-semibold text-foreground mb-2">No favorites yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Browse the library and click the heart icon to save assets here.
            </p>
            <Link href="/library" className="btn-primary">
              Browse library
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {favorites.map((fav) => {
              const asset = fav.assets;
              const emoji = categoryEmoji[asset?.category || ''] || '🐠';
              return (
                <div key={fav.id} className="group bg-card rounded-xl border border-border overflow-hidden shadow-card">
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    <span className="text-4xl">{emoji}</span>
                    {asset?.is_demo && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
                          Demo
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRemove(fav)}
                        aria-label="Remove from favorites"
                        className="w-7 h-7 rounded-lg bg-white text-red-500 flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors"
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
