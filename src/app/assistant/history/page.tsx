'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, MessageSquare, Trash2, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ConversationSummary {
  id: string;
  title?: string;
  locale: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AssistantHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/assistant/history');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/assistant/conversations')
      .then(r => r.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .finally(() => setFetching(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch('/api/assistant/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setConversations(prev => prev.filter(c => c.id !== id));
    setDeleting(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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
                <History size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Conversation History</h1>
                <p className="text-xs text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Link href="/assistant" className="btn-primary text-sm">
              New conversation
            </Link>
          </div>

          {fetching ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare size={40} className="text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No conversations yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Start asking questions to build your history</p>
              <Link href="/assistant" className="btn-primary text-sm mt-6 inline-flex">
                Start a conversation
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.title || 'Untitled conversation'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(conv.updated_at)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe size={10} />
                        {conv.locale.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/assistant?conv=${conv.id}`}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Open"
                    >
                      <ChevronRight size={15} />
                    </Link>
                    <button
                      onClick={() => handleDelete(conv.id)}
                      disabled={deleting === conv.id}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
