'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order');
  const orderType = searchParams?.get('type');

  const resumeHref =
    orderType === 'subscription' ? '/pricing' :
    orderType === 'credits'? '/pricing#credits' : '/library';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-28 pb-20">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <XCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Checkout cancelled</h1>
            <p className="text-muted-foreground max-w-sm">
              Your checkout was cancelled. No payment was taken and your order has not been confirmed.
            </p>
            {orderId && (
              <div className="bg-muted rounded-xl px-6 py-3 text-sm text-muted-foreground w-full">
                Order reference: <span className="font-mono text-xs text-foreground">{orderId}</span>
              </div>
            )}
            <div className="flex gap-3 mt-2">
              <Link href={resumeHref} className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 transition-colors">
                <RefreshCw className="w-4 h-4" /> Try again
              </Link>
              <Link href="/" className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
