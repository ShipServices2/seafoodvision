'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, Clock, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

type OrderStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'disputed';

interface OrderData {
  id: string;
  orderNumber: string;
  orderType: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paidAt?: string;
}

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchOrderStatus = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/payments/order-status?order=${orderId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to fetch order');
        return;
      }
      const data = await res.json();
      setOrder(data.order);
    } catch {
      setError('Network error — please refresh');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrderStatus(); }, [fetchOrderStatus]);

  useEffect(() => {
    if (!order || order.status === 'paid' || order.status === 'failed' || pollCount >= 12) return;
    const timer = setTimeout(() => {
      setPollCount((c) => c + 1);
      fetchOrderStatus();
    }, 5000);
    return () => clearTimeout(timer);
  }, [order, pollCount, fetchOrderStatus]);

  const isPaid = order?.status === 'paid';
  const isFailed = order?.status === 'failed';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Loading order…</h1>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Unable to load order</h1>
              <p className="text-muted-foreground">{error}</p>
              <button
                onClick={() => { setLoading(true); setError(null); fetchOrderStatus(); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : isPaid ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment confirmed</h1>
              <p className="text-muted-foreground max-w-sm">
                Your order <span className="font-mono text-sm text-foreground">{order?.orderNumber}</span> has been confirmed. Your entitlements will be activated shortly.
              </p>
              <div className="bg-muted rounded-xl px-6 py-4 text-left w-full mt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Order type</span>
                  <span className="text-foreground capitalize">{order?.orderType?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-foreground font-semibold">{order?.totalAmount?.toFixed(2)} {order?.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-green-600 font-medium">Paid</span>
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Link href="/account" className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors">
                  My account <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/library" className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Browse library
                </Link>
              </div>
            </div>
          ) : isFailed ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment failed</h1>
              <p className="text-muted-foreground max-w-sm">Your payment could not be processed. No charge was made.</p>
              <Link href="/pricing" className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors">
                Try again <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Confirming your payment…</h1>
              <p className="text-muted-foreground max-w-sm">
                Your payment is being confirmed. This usually takes a few seconds. Please do not close this page.
              </p>
              {order && (
                <div className="bg-muted rounded-xl px-6 py-4 text-left w-full mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Order</span>
                    <span className="font-mono text-xs text-foreground">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Pending confirmation
                    </span>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setLoading(true); fetchOrderStatus(); }}
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors mt-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh status
              </button>
              <p className="text-xs text-muted-foreground">
                ⚠️ Entitlements are granted only after server-side webhook confirmation — not on this page.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
