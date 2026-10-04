'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle, Clock } from 'lucide-react';

interface Refund {
  id: string;
  refund_number: string;
  status: string;
  reason: string;
  amount: number;
  currency: string;
  is_partial: boolean;
  requested_at: string;
  reviewed_at: string | null;
  order_id: string;
  user_id: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  requested: { label: 'Requested', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
  approved: { label: 'Approved', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  processing: { label: 'Processing', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: RefreshCw },
  completed: { label: 'Completed', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 },
};

export default function AdminRefundsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/refunds');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  const loadRefunds = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('refunds')
      .select('id, refund_number, status, reason, amount, currency, is_partial, requested_at, reviewed_at, order_id, user_id')
      .order('requested_at', { ascending: false });
    setRefunds((data as Refund[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user) loadRefunds(); }, [user]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    const supabase = createClient();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'approved' || newStatus === 'rejected') {
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = user!.id;
    }
    if (newStatus === 'processing') updates.processed_at = new Date().toISOString();
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString();

    await supabase.from('refunds').update(updates).eq('id', id);
    setRefunds((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    setUpdating(null);
  };

  const filtered = refunds.filter((r) => statusFilter === 'all' || r.status === statusFilter);

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
            <span>Refunds</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Refunds</h1>
              <p className="text-sm text-muted-foreground">{refunds.length} refund request{refunds.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
          >
            <option value="all">All statuses</option>
            {Object.keys(STATUS_CONFIG).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No refund requests</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((refund) => {
              const cfg = STATUS_CONFIG[refund.status] ?? STATUS_CONFIG.requested;
              const StatusIcon = cfg.icon;
              return (
                <div key={refund.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-semibold text-foreground">{refund.refund_number}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {refund.is_partial && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Partial</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground mb-1">{refund.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(refund.requested_at).toLocaleDateString()}
                        {refund.reviewed_at && ` · Reviewed ${new Date(refund.reviewed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">{Number(refund.amount).toFixed(2)} {refund.currency}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {refund.status === 'requested' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => updateStatus(refund.id, 'approved')}
                        disabled={updating === refund.id}
                        className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(refund.id, 'rejected')}
                        disabled={updating === refund.id}
                        className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  )}
                  {refund.status === 'approved' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => updateStatus(refund.id, 'processing')}
                        disabled={updating === refund.id}
                        className="flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Mark Processing
                      </button>
                    </div>
                  )}
                  {refund.status === 'processing' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => updateStatus(refund.id, 'completed')}
                        disabled={updating === refund.id}
                        className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Mark Completed
                      </button>
                      <p className="text-xs text-muted-foreground self-center">License/entitlement revocation will be available once Dodo Payments is connected.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
