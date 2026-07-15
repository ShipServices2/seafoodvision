'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, Clock } from 'lucide-react';

interface WebhookEvent {
  id: string;
  external_event_id: string;
  event_type: string;
  environment: string;
  processing_status: string;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  processed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  ignored_duplicate: 'bg-muted text-muted-foreground',
};

export default function AdminCommerceWebhooksPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/webhooks');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  const fetchEvents = async () => {
    if (!user) return;
    const supabase = createClient();
    setFetching(true);
    const { data } = await supabase
      .from('payment_webhook_events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(100);
    setEvents(data ?? []);
    setFetching(false);
  };

  useEffect(() => { fetchEvents(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const statusCounts = events.reduce((acc, e) => {
    acc[e.processing_status] = (acc[e.processing_status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
            <span>Webhooks</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Webhook Events</h1>
              <p className="text-muted-foreground text-sm mt-1">Incoming Dodo Payments webhook events and processing status</p>
            </div>
            <button onClick={fetchEvents} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {['received', 'processing', 'processed', 'failed', 'ignored_duplicate'].map((s) => (
            <div key={s} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-foreground">{statusCounts[s] ?? 0}</div>
              <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[s]}`}>{s.replace('_', ' ')}</div>
            </div>
          ))}
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No webhook events yet</p>
            <p className="text-sm mt-1">Events will appear here once Dodo Payments sends webhooks to <code className="bg-muted px-1 rounded">/api/webhooks/dodo-payments</code></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-muted-foreground font-medium">Event type</th>
                  <th className="pb-3 text-muted-foreground font-medium">External ID</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">Env</th>
                  <th className="pb-3 text-muted-foreground font-medium text-center">Status</th>
                  <th className="pb-3 text-muted-foreground font-medium">Received</th>
                  <th className="pb-3 text-muted-foreground font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 font-mono text-xs text-foreground">{e.event_type}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground truncate max-w-[140px]">{e.external_event_id}</td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.environment === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{e.environment}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[e.processing_status] ?? 'bg-muted text-muted-foreground'}`}>
                        {e.processing_status}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">{new Date(e.received_at).toLocaleString('fr-FR')}</td>
                    <td className="py-3 text-xs text-red-500 max-w-[200px] truncate">{e.error_message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
