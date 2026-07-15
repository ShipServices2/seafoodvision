'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Coins, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface LedgerEntry {
  id: string;
  movement_type: string;
  amount: number;
  reason: string | null;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

const MOVEMENT_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  purchase: { label: 'Purchase', color: 'text-green-600', sign: '+' },
  grant: { label: 'Grant', color: 'text-blue-600', sign: '+' },
  usage: { label: 'Usage', color: 'text-red-600', sign: '' },
  refund: { label: 'Refund', color: 'text-green-600', sign: '+' },
  expiration: { label: 'Expired', color: 'text-muted-foreground', sign: '' },
  admin_adjustment: { label: 'Adjustment', color: 'text-amber-600', sign: '' },
};

export default function AccountCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/credits');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.rpc('get_user_credit_balance', { p_user_id: user.id }),
      supabase
        .from('credit_ledger')
        .select('id, movement_type, amount, reason, balance_before, balance_after, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([balRes, ledgerRes]) => {
      setBalance(typeof balRes.data === 'number' ? balRes.data : 0);
      setLedger((ledgerRes.data as LedgerEntry[]) ?? []);
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
            <span>Credits</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Coins className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Credits</h1>
              <p className="text-sm text-muted-foreground">Balance and transaction history</p>
            </div>
          </div>
        </div>

        {/* Balance card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
              <p className="text-4xl font-bold text-foreground">{balance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">credits</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <Coins className="w-8 h-8 text-secondary" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link href="/pricing" className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors">
              Buy Credits
            </Link>
          </div>
        </div>

        {/* Ledger */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Transaction History</h2>
          </div>
          {fetching ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
            </div>
          ) : ledger.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No credit transactions yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ledger.map((entry) => {
                const cfg = MOVEMENT_CONFIG[entry.movement_type] ?? { label: entry.movement_type, color: 'text-foreground', sign: '' };
                const isPositive = entry.amount > 0;
                return (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                        {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${cfg.color}`}>
                        {cfg.sign}{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Balance: {entry.balance_after.toLocaleString()}</p>
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
