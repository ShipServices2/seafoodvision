'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Receipt, CircleCheck as CheckCircle2, Clock, Circle as XCircle } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid: { label: 'Paid', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 },
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  failed: { label: 'Failed', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  refunded: { label: 'Refunded', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Receipt },
  draft: { label: 'Draft', color: 'text-muted-foreground bg-muted border-border', icon: Clock },
};

export default function AccountOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/orders');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('orders')
      .select('id, order_number, order_type, total_amount, currency, status, created_at, paid_at, subtotal, discount_amount, tax_amount')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setFetching(false);
      });
  }, [user]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/account" className="hover:text-foreground">Account</Link>
            <span>/</span>
            <span>Orders & Billing</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Orders & Billing</h1>
              <p className="text-sm text-muted-foreground">Order summaries and references</p>
            </div>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground">Your order history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              const isExpanded = expanded === order.id;
              return (
                <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-semibold text-foreground">{order.order_number}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">
                        {order.order_type.replace(/_/g, ' ')} · {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-bold text-foreground">{Number(order.total_amount).toFixed(2)} {order.currency}</p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-border pt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Subtotal</p>
                          <p className="font-medium text-foreground">{Number(order.subtotal).toFixed(2)} {order.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Discount</p>
                          <p className="font-medium text-foreground">-{Number(order.discount_amount).toFixed(2)} {order.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tax</p>
                          <p className="font-medium text-foreground">{Number(order.tax_amount).toFixed(2)} {order.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-bold text-foreground">{Number(order.total_amount).toFixed(2)} {order.currency}</p>
                        </div>
                        {order.paid_at && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Paid at</p>
                            <p className="font-medium text-foreground">{new Date(order.paid_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Official invoice will be available once Dodo Payments is connected.
                      </p>
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
