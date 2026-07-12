'use client';

import React, { useState } from 'react';
import { Plus, FolderOpen, Check } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';

interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  assetTitle: string;
}

const existingCollections = [
  { id: 'col-001', name: 'Atlantic Species Reference', count: 14 },
  { id: 'col-002', name: 'Frozen Products — Buyers Guide', count: 8 },
  { id: 'col-003', name: 'Editorial — Magazine Spring 2024', count: 22 },
];

export default function CollectionModal({ open, onClose, assetTitle }: CollectionModalProps) {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // Backend integration point: POST /api/collections/add-asset
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success(
      `Added to ${selectedCollections.length} collection${selectedCollections.length !== 1 ? 's' : ''}`
    );
    onClose();
    setSelectedCollections([]);
  };

  const handleCreateNew = () => {
    if (!newCollectionName.trim()) return;
    toast.success(`Collection "${newCollectionName}" created and asset added`);
    setNewCollectionName('');
    setCreatingNew(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to Collection" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          Adding: <span className="font-medium text-foreground">{assetTitle}</span>
        </p>

        {/* Existing collections */}
        <div className="flex flex-col gap-2">
          {existingCollections.map((col) => {
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
                  <p className="text-xs text-muted-foreground">{col.count} assets</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Create new */}
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

        {/* Footer actions */}
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
      </div>
    </Modal>
  );
}