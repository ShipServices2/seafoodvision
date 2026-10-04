'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, FolderOpen, Library } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// V1 /discover: collections only. No semantic search call. The previous knowledge-style
// page is kept, unused, in DiscoverKnowledgeView.tsx.

interface PublicCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  asset_count: number | null;
}

interface MyCollection {
  id: string;
  name: string;
  description: string | null;
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const [publicCollections, setPublicCollections] = useState<PublicCollection[] | null>(null);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from('commercial_collections')
        .select('id, name, slug, description, cover_image_url, asset_count')
        .eq('is_active', true)
        .order('name');
      if (active) setPublicCollections((data as PublicCollection[] | null) ?? []);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) { setMyCollections([]); return; }
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from('collections')
        .select('id, name, description')
        .order('updated_at', { ascending: false });
      if (active) setMyCollections((data as MyCollection[] | null) ?? []);
    })();
    return () => { active = false; };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-3xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Collections</p>
          <h1 className="text-3xl font-bold text-foreground mb-3">Curated collections</h1>
          <p className="text-muted-foreground leading-relaxed">
            Themed selections of verified seafood photographs. Browse the library to find individual assets, or build your own collection from your account.
          </p>
        </div>

        <section className="mb-14" aria-labelledby="curated-heading">
          <h2 id="curated-heading" className="text-lg font-bold text-foreground mb-4">Featured collections</h2>
          {publicCollections === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : publicCollections.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <FolderOpen size={28} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No featured collection yet</p>
              <p className="text-sm text-muted-foreground mb-5">Curated collections will appear here. In the meantime, explore the library or the species index.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/library" className="btn-secondary"><Library size={16} />Explore the library</Link>
                <Link href="/species" className="btn-outline"><BookOpen size={16} />View species</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicCollections.map((collection) => (
                <div key={collection.id} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold text-foreground">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{collection.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">{collection.asset_count ?? 0} assets</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-lg font-bold text-foreground mb-4">Your collections</h2>
          {!user ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/auth" className="font-semibold text-secondary hover:underline">Sign in</Link> to save assets in your own collections.
            </p>
          ) : myCollections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no collection yet. Open an asset and use “Add to collection”, or go to{' '}
              <Link href="/account/collections" className="font-semibold text-secondary hover:underline">your collections</Link>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCollections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/account/collections/${collection.id}`}
                  className="group rounded-xl border border-border bg-card p-5 hover:border-secondary/40 transition-colors"
                >
                  <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{collection.description}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary mt-3">Open <ArrowRight size={12} /></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
