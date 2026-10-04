'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Layers, Plus, CircleCheck as CheckCircle2, Circle as XCircle, ShoppingBag } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_for_sale: boolean;
  price: number | null;
  currency: string;
  discount_pct: number;
  requires_subscription: boolean;
  asset_count: number;
  created_at: string;
}

export default function AdminCollectionsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', price: '', is_for_sale: false, discount_pct: '0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/collections');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  const loadCollections = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('commercial_collections').select('*').order('created_at', { ascending: false });
    setCollections((data as Collection[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user) loadCollections(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('commercial_collections').insert({
      name: form.name,
      slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
      description: form.description || null,
      price: form.price ? parseFloat(form.price) : null,
      is_for_sale: form.is_for_sale,
      discount_pct: parseFloat(form.discount_pct) || 0,
      created_by: user!.id,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    await loadCollections();
    setShowForm(false);
    setForm({ name: '', slug: '', description: '', price: '', is_for_sale: false, discount_pct: '0' });
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from('commercial_collections').update({ is_active: !current }).eq('id', id);
    setCollections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c));
  };

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
            <span>Collections</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Commercial Collections</h1>
                <p className="text-sm text-muted-foreground">{collections.length} collection{collections.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-foreground mb-4">New Collection</h3>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Slug *</label>
                <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Price (€)</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Discount %</label>
                <input type="number" min="0" max="100" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="for_sale" checked={form.is_for_sale} onChange={(e) => setForm({ ...form, is_for_sale: e.target.checked })}
                  className="rounded" />
                <label htmlFor="for_sale" className="text-sm text-foreground">Available for sale</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Collection'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No collections yet</h3>
            <p className="text-sm text-muted-foreground">Create a commercial collection to bundle and sell assets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((col) => (
              <div key={col.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{col.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{col.slug}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                      col.is_active ? 'text-green-600 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-border'
                    }`}>
                      {col.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {col.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {col.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{col.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" />
                    {col.asset_count} assets
                  </span>
                  {col.is_for_sale && col.price && (
                    <span className="font-semibold text-foreground">
                      {col.discount_pct > 0 ? (
                        <span className="text-secondary">{(col.price * (1 - col.discount_pct / 100)).toFixed(2)} {col.currency}</span>
                      ) : (
                        `${col.price.toFixed(2)} ${col.currency}`
                      )}
                    </span>
                  )}
                  {!col.is_for_sale && <span className="text-muted-foreground">Not for sale</span>}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex gap-2">
                  <button onClick={() => toggleActive(col.id, col.is_active)}
                    className="text-xs text-secondary hover:underline">
                    {col.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
