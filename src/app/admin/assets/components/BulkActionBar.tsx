'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, TrendingUp, RotateCcw, Eye, ShoppingBag, Archive, Trash2, Tag, Download, ChevronDown, X, Loader2, Undo2 } from 'lucide-react';

export interface BulkActionBarProps {
  selectedIds: string[];
  totalSelected: number;
  isSuperAdmin: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onUndo: () => void;
  undoId: string | null;
  undoCountdown: number;
  onClearSelection: () => void;
}

interface ConfirmState {
  action: string;
  label: string;
  payload?: Record<string, unknown>;
}

const BULK_ACTIONS = [
  { id: 'approve', label: 'Approve Selected', icon: CheckCircle2, color: 'text-green-600', shortcut: 'A' },
  { id: 'reject', label: 'Reject Selected', icon: XCircle, color: 'text-red-600', shortcut: 'R' },
  { id: 'promote', label: 'Promote Selected', icon: TrendingUp, color: 'text-indigo-600', shortcut: 'P' },
  { id: 'under_review', label: 'Return to Under Review', icon: RotateCcw, color: 'text-amber-600', shortcut: 'U' },
  { id: 'preview_only', label: 'Set Preview Only', icon: Eye, color: 'text-teal-600' },
  { id: 'commercial_ready', label: 'Commercial Ready', icon: ShoppingBag, color: 'text-blue-600' },
  { id: 'archive', label: 'Archive Selected', icon: Archive, color: 'text-gray-600' },
];

export default function BulkActionBar({
  selectedIds,
  totalSelected,
  isSuperAdmin,
  onAction,
  onUndo,
  undoId,
  undoCountdown,
  onClearSelection,
}: BulkActionBarProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPromoteMenu, setShowPromoteMenu] = useState(false);
  const [showChangeMenu, setShowChangeMenu] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [showKeywordAdd, setShowKeywordAdd] = useState(false);
  const [showKeywordRemove, setShowKeywordRemove] = useState(false);

  if (totalSelected === 0) return null;

  const handleConfirm = async () => {
    if (!confirm) return;
    setLoading(true);
    await onAction(confirm.action, confirm.payload);
    setLoading(false);
    setConfirm(null);
    setShowMore(false);
    setShowPromoteMenu(false);
    setShowChangeMenu(false);
  };

  const requestAction = (action: string, label: string, payload?: Record<string, unknown>) => {
    setConfirm({ action, label, payload });
    setShowMore(false);
    setShowPromoteMenu(false);
    setShowChangeMenu(false);
  };

  const handleExport = async () => {
    await onAction('export');
  };

  return (
    <>
      {/* Bulk Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-2xl">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
          {/* Selection count */}
          <div className="flex items-center gap-2 mr-2">
            <span className="bg-secondary text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {totalSelected}
            </span>
            <span className="text-sm font-medium text-foreground">
              {totalSelected === 1 ? 'asset selected' : 'assets selected'}
            </span>
            <button
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>

          {/* Primary actions */}
          <button
            onClick={() => requestAction('approve', `Approve ${totalSelected} selected asset${totalSelected > 1 ? 's' : ''}`)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
          >
            <CheckCircle2 size={13} />
            Approve
          </button>

          <button
            onClick={() => requestAction('reject', `Reject ${totalSelected} selected asset${totalSelected > 1 ? 's' : ''}`)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <XCircle size={13} />
            Reject
          </button>

          {/* Promote dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPromoteMenu(!showPromoteMenu)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <TrendingUp size={13} />
              Promote
              <ChevronDown size={11} />
            </button>
            {showPromoteMenu && (
              <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-xl shadow-xl py-1 min-w-44 z-50">
                {['approved', 'preview_only', 'editorial', 'commercial'].map((s) => (
                  <button
                    key={s}
                    onClick={() => requestAction('promote', `Promote ${totalSelected} assets to ${s}`, { status: s })}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors capitalize"
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => requestAction('under_review', `Return ${totalSelected} assets to Under Review`)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <RotateCcw size={13} />
            Under Review
          </button>

          {/* More actions */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors"
            >
              More
              <ChevronDown size={11} />
            </button>
            {showMore && (
              <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-xl shadow-xl py-1 min-w-52 z-50">
                <button
                  onClick={() => requestAction('preview_only', `Set ${totalSelected} assets to Preview Only`)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Eye size={12} className="text-teal-600" /> Set Preview Only
                </button>
                <button
                  onClick={() => requestAction('commercial_ready', `Set ${totalSelected} assets as Commercial Ready`)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <ShoppingBag size={12} className="text-blue-600" /> Commercial Ready
                </button>
                <button
                  onClick={() => requestAction('archive', `Archive ${totalSelected} selected assets`)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Archive size={12} className="text-gray-600" /> Archive Selected
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { setShowKeywordAdd(true); setShowMore(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Tag size={12} className="text-purple-600" /> Add Keywords
                </button>
                <button
                  onClick={() => { setShowKeywordRemove(true); setShowMore(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Tag size={12} className="text-orange-600" /> Remove Keywords
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={handleExport}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <Download size={12} className="text-secondary" /> Export Selected
                </button>
                {isSuperAdmin && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => requestAction('delete', `Permanently delete ${totalSelected} assets`)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={12} /> Delete Selected
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Undo button */}
          {undoId && undoCountdown > 0 && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors ml-auto"
            >
              <Undo2 size={13} />
              Undo ({undoCountdown}s)
            </button>
          )}
        </div>
      </div>

      {/* Keyword Add Modal */}
      {showKeywordAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Add Keywords to {totalSelected} assets</h3>
            <p className="text-xs text-muted-foreground mb-3">Enter keywords separated by commas</p>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="salmon, fresh, atlantic..."
              className="input-base w-full text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowKeywordAdd(false); setKeywordInput(''); }} className="btn-outline flex-1 justify-center text-sm">Cancel</button>
              <button
                onClick={() => {
                  const kws = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
                  if (kws.length > 0) requestAction('add_keywords', `Add ${kws.length} keyword(s) to ${totalSelected} assets`, { keywords: kws });
                  setShowKeywordAdd(false);
                  setKeywordInput('');
                }}
                className="btn-primary flex-1 justify-center text-sm"
              >
                Add Keywords
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Remove Modal */}
      {showKeywordRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Remove Keywords from {totalSelected} assets</h3>
            <p className="text-xs text-muted-foreground mb-3">Enter keywords to remove, separated by commas</p>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="salmon, fresh..."
              className="input-base w-full text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowKeywordRemove(false); setKeywordInput(''); }} className="btn-outline flex-1 justify-center text-sm">Cancel</button>
              <button
                onClick={() => {
                  const kws = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
                  if (kws.length > 0) requestAction('remove_keywords', `Remove ${kws.length} keyword(s) from ${totalSelected} assets`, { keywords: kws });
                  setShowKeywordRemove(false);
                  setKeywordInput('');
                }}
                className="btn-primary flex-1 justify-center text-sm"
              >
                Remove Keywords
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-bold text-foreground mb-2">Confirm Bulk Action</h3>
            <p className="text-sm text-muted-foreground mb-6">{confirm.label}?</p>
            {confirm.action === 'delete' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-700 font-medium">⚠️ This action is permanent and cannot be undone.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={loading}
                className="btn-outline flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                  confirm.action === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-700' :'btn-primary'
                }`}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? 'Processing…' : 'Yes, Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
