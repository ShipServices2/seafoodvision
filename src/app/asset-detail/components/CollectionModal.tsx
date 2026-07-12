'use client';

import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  assetTitle: string;
  assetId: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  itemCount?: number;
}

export default function CollectionModal({ open, onClose, assetTitle, assetId }: CollectionModalProps) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingCollections(true);
    const supabase = createClient();
    supabase
      .from('collections')
      .select('id, name, description, is_private')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCollections((data as Collection[]) || []);
        setLoadingCollections(false);
      });
  }, [open, user]);

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save to collections');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const inserts = selectedCollections.map((collectionId) => ({
        collection_id: collectionId,
        asset_id: assetId,
      }));
      const { error } = await supabase.from('collection_items').upsert(inserts, {
        onConflict: 'collection_id,asset_id',
        ignoreDuplicates: true,
      });
      if (error) throw error;
      toast.success(
        `Added to ${selectedCollections.length} collection${selectedCollections.length !== 1 ? 's' : ''}`
      );
      onClose();
      setSelectedCollections([]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newCollectionName.trim() || !user) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collections')
        .insert({ user_id: user.id, name: newCollectionName.trim(), is_private: true })
        .select('id, name, description, is_private')
        .single();
      if (error) throw error;
      const newCol = data as Collection;
      setCollections((prev) => [newCol, ...prev]);
      setSelectedCollections((prev) => [...prev, newCol.id]);
      toast.success(`Collection "${newCollectionName}" created`);
      setNewCollectionName('');
      setCreatingNew(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create collection';
      toast.error(message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to Collection" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          Adding: <span className="font-medium text-foreground">{assetTitle}</span>
        </p>

        {!user ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Lock size={24} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sign in to save assets to collections</p>
            <a href="/auth" className="btn-primary text-sm">Sign In</a>
          </div>
        ) : loadingCollections ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`skel-${i}`} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : collections.length === 0 && !creatingNew ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No collections yet. Create your first one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {collections.map((col) => {
              const selected = selectedCollections.includes(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => toggleCollection(col.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-150 ${
                    selected
                      ? 'border-secondary bg-secondary/8 text-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    selected ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {selected ? <Check size={13} /> : <FolderOpen size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{col.name}</p>
                    {col.is_private && (
                      <p className="text-xs text-muted-foreground">Private</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {user && (
          <>
            {creatingNew ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name…"
                  className="input-base flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNew(); }}
                  aria-label="New collection name"
                />
                <button onClick={handleCreateNew} className="btn-secondary shrink-0">
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreatingNew(true)}
                className="flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors font-medium"
              >
                <Plus size={14} />
                Create new collection
              </button>
            )}

            <div className="flex gap-2 pt-2 border-t border-border">
              <button onClick={onClose} className="btn-outline flex-1 justify-center">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedCollections.length === 0 || saving}
                className="btn-primary flex-1 justify-center"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving…
                  </span>
                ) : (
                  `Add to ${selectedCollections.length || ''} collection${selectedCollections.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}