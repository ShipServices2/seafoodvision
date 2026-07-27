'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Download, CircleCheck as CheckCircle2, Clock, CircleAlert as AlertCircle } from 'lucide-react';

interface Entitlement {
  id: string;
  status: string;
  entitlement_type: string;
  allowed_resolution: string | null;
  resolution_allowed: string | null;
  downloads_used: number;
  download_count: number;
  max_downloads: number;
  valid_until: string | null;
  last_downloaded_at: string | null;
  asset: { id: string; title: string; public_asset_id: string } | null;
}

export default function AccountDownloadsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/downloads');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('download_entitlements')
      .select('id, status, entitlement_type, allowed_resolution, resolution_allowed, downloads_used, download_count, max_downloads, valid_until, last_downloaded_at, asset:assets(id, title, public_asset_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntitlements((data as unknown as Entitlement[]) ?? []);
        setFetching(false);
      });
  }, [user]);

  const handleDownload = async (entitlementId: string) => {
    setDownloading(entitlementId);
    setError(null);
    try {
      const res = await fetch(`/api/downloads/${entitlementId}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'ORIGINAL_NOT_AVAILABLE') {
          setError('Original not yet available for this asset.');
        } else {
          setError(data.error ?? 'Download failed');
        }
        return;
      }
      window.open(data.signedUrl, '_blank');
      // Refresh entitlements
      const supabase = createClient();
      const { data: updated } = await supabase
        .from('download_entitlements')
        .select('id, status, entitlement_type, allowed_resolution, resolution_allowed, downloads_used, download_count, max_downloads, valid_until, last_downloaded_at, asset:assets(id, title, public_asset_id)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (updated) setEntitlements(updated as unknown as Entitlement[]);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 pt-24 pb-20">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/account" className="hover:text-foreground">Account</Link>
            <span>/</span>
            <span>Downloads</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Downloads</h1>
              <p className="text-sm text-muted-foreground">{entitlements.length} entitlement{entitlements.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : entitlements.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No download entitlements</h3>
            <p className="text-sm text-muted-foreground">Purchase a license to unlock downloads.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entitlements.map((ent) => {
              const used = ent.downloads_used ?? ent.download_count ?? 0;
              const max = ent.max_downloads ?? 1;
              const remaining = max - used;
              const isActive = ent.status === 'active';
              const isExpired = ent.valid_until && new Date(ent.valid_until) < new Date();
              const canDownload = isActive && !isExpired && remaining > 0;

              return (
                <div key={ent.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {ent.asset?.title ?? ent.asset?.public_asset_id ?? 'Unknown asset'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                          isActive && !isExpired ? 'text-green-600 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-border'
                        }`}>
                          {isActive && !isExpired ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {isExpired ? 'Expired' : ent.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ent.allowed_resolution ?? ent.resolution_allowed ?? 'HD'} · {used}/{max} downloads used
                        {ent.valid_until && ` · Expires ${new Date(ent.valid_until).toLocaleDateString()}`}
                      </p>
                      {ent.last_downloaded_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last downloaded {new Date(ent.last_downloaded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload(ent.id)}
                      disabled={!canDownload || downloading === ent.id}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        canDownload
                          ? 'bg-secondary text-white hover:bg-secondary/90' :'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      {downloading === ent.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {remaining > 0 ? `Download (${remaining} left)` : 'Quota reached'}
                    </button>
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
