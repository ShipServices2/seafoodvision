'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface PurchasedLicense {
  id: string;
  status: string;
  purchased_at: string;
  terms_version: string;
  asset: { id: string; title: string; public_asset_id: string } | null;
  license_type: { name: string; code: string; territory: string } | null;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  active: CheckCircle2,
  expired: Clock,
  revoked: XCircle,
  pending: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-600 bg-green-50 border-green-200',
  expired: 'text-amber-600 bg-amber-50 border-amber-200',
  revoked: 'text-red-600 bg-red-50 border-red-200',
  pending: 'text-muted-foreground bg-muted border-border',
};

export default function AccountLicensesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [licenses, setLicenses] = useState<PurchasedLicense[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/licenses');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('purchased_licenses')
      .select('id, status, purchased_at, terms_version, asset:assets(id, title, public_asset_id), license_type:license_types(name, code, territory)')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false })
      .then(({ data }) => {
        setLicenses((data as unknown as PurchasedLicense[]) ?? []);
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
            <span>Licenses</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Licenses</h1>
              <p className="text-sm text-muted-foreground">{licenses.length} license{licenses.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No licenses yet</h3>
            <p className="text-sm text-muted-foreground">Purchase an asset to receive a digital license.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {licenses.map((lic) => {
              const StatusIcon = STATUS_ICON[lic.status] ?? Clock;
              const statusColor = STATUS_COLOR[lic.status] ?? STATUS_COLOR.pending;
              return (
                <div key={lic.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {lic.asset?.title ?? lic.asset?.public_asset_id ?? 'Unknown asset'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
                          <StatusIcon className="w-3 h-3" />
                          {lic.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lic.license_type?.name ?? 'License'} · {lic.license_type?.territory ?? 'worldwide'} · v{lic.terms_version}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Purchased {new Date(lic.purchased_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
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
