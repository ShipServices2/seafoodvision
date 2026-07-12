'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderOpen, ArrowLeft, Plus, Trash2, Edit2, ChevronRight, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchUserCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '@/lib/supabase/queries';
import type { Collection } from '@/lib/supabase/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CollectionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/account/collections');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetchUserCollections(user.id).then((data) => {
      setCollections(data);
      setFetching(false);
    });
  }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const col = await createCollection(user.id, newName.trim());
    if (col) {
      setCollections((prev) => [col, ...prev]);
      setNewName('');
      setCreating(false);
      toast.success('Collection created');
    } else {
      toast.error('Failed to create collection');
    }
  };

  const handleRename = async (id: string) => {
    if (!user || !editName.trim()) return;
    const ok = await updateCollection(id, user.id, { name: editName.trim() });
    if (ok) {
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c))
      );
      setEditingId(null);
      toast.success('Collection renamed');
    } else {
      toast.error('Failed to rename collection');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const ok = await deleteCollection(id, user.id);
    if (ok) {
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast.success('Collection deleted');
    } else {
      toast.error('Failed to delete collection');
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

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <FolderOpen size={18} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Collections</h1>
              <p className="text-sm text-muted-foreground">
                {fetching ? 'Loading…' : `${collections.length} collection${collections.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="btn-primary"
          >
            <Plus size={15} />
            New collection
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-card rounded-xl border border-secondary/30 p-4 mb-4 flex items-center gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="input-base flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button onClick={handleCreate} className="btn-primary px-3 py-2">
              <Check size={15} />
            </button>
            <button onClick={() => setCreating(false)} className="btn-outline px-3 py-2">
              <X size={15} />
            </button>
          </div>
        )}

        {fetching ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📁</p>
            <h3 className="text-lg font-semibold text-foreground mb-2">No collections yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create collections to organize assets by project, client, or theme.
            </p>
            <button onClick={() => setCreating(true)} className="btn-primary">
              <Plus size={15} />
              Create first collection
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {collections.map((col) => (
              <div
                key={col.id}
                className="group bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-secondary/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <FolderOpen size={16} className="text-muted-foreground" />
                </div>

                {editingId === col.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-base flex-1 py-1.5 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(col.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button onClick={() => handleRename(col.id)} className="btn-primary px-2 py-1.5 text-xs">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-outline px-2 py-1.5 text-xs">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link href={`/account/collections/${col.id}`} className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{col.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {col.is_private ? 'Private' : 'Shared'} ·{' '}
                        {new Date(col.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(col.id); setEditName(col.name); }}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="Rename"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(col.id)}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <Link href={`/account/collections/${col.id}`}>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
