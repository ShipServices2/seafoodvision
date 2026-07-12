'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, Trash2, ChevronLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface SavedAnswer {
  id: string;
  title?: string;
  created_at: string;
  assistant_messages?: {
    id: string;
    content: string;
    confidence_level?: string;
    created_at: string;
  };
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-emerald-700 bg-emerald-50',
  moderate: 'text-amber-700 bg-amber-50',
  limited: 'text-orange-700 bg-orange-50',
  none: 'text-red-700 bg-red-50',
};

const CONFIDENCE_ICONS: Record<string, React.ElementType> = {
  high: CheckCircle,
  moderate: Clock,
  limited: AlertTriangle,
  none: AlertTriangle,
};

export default function AssistantSavedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedAnswer[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/assistant/saved');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/assistant/saved')
      .then(r => r.json())
      .then(data => setSaved(Array.isArray(data) ? data : []))
      .finally(() => setFetching(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch('/api/assistant/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setSaved(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Link href="/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Back to Assistant
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bookmark size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Saved Answers</h1>
                <p className="text-xs text-muted-foreground">{saved.length} saved answer{saved.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Link href="/assistant" className="btn-primary text-sm">
              New question
            </Link>
          </div>

          {fetching ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : saved.length === 0 ? (
            <div className="text-center py-16">
              <Bookmark size={40} className="text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No saved answers yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Save useful answers from the assistant</p>
              <Link href="/assistant" className="btn-primary text-sm mt-6 inline-flex">
                Ask a question
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {saved.map((item) => {
                const msg = item.assistant_messages;
                const conf = msg?.confidence_level || 'limited';
                const ConfIcon = CONFIDENCE_ICONS[conf] || AlertTriangle;
                return (
                  <div key={item.id} className="p-4 rounded-xl border border-border bg-card group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS.limited}`}>
                            <ConfIcon size={10} />
                            {conf}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                        </div>
                        {item.title && (
                          <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                        )}
                        {msg?.content && (
                          <p className="text-sm text-muted-foreground line-clamp-3">{msg.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
