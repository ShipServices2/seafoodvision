'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, ChevronLeft, Globe } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  id: string;
  title?: string;
  locale: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  anonymous_session_id?: string;
}

export default function AdminAssistantConversationsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/assistant/conversations');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role)) router.replace('/admin/assistant');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile || !['administrator', 'super_admin'].includes(profile.role)) return;
    const supabase = createClient();
    supabase
      .from('assistant_conversations')
      .select('id, title, locale, status, created_at, updated_at, user_id, anonymous_session_id')
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setConversations(data || []);
        setFetching(false);
      });
  }, [profile]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Link href="/admin/assistant" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft size={16} />
            Assistant Admin
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Conversations</h1>
              <p className="text-xs text-muted-foreground">{conversations.length} total</p>
            </div>
          </div>

          {fetching ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Locale</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {conversations.map((conv) => (
                    <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate max-w-xs">{conv.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{conv.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {conv.user_id ? conv.user_id.slice(0, 8) + '…' : conv.anonymous_session_id ? 'Guest' : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <Globe size={10} />
                          {conv.locale.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conv.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                          {conv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(conv.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {conversations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No conversations yet</div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
