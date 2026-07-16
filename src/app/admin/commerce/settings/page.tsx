'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Settings, Save, AlertCircle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

interface Setting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  label: string;
  description: string | null;
  category: string;
  is_public: boolean;
}

interface DodoDiagnostic {
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  returnUrlConfigured: boolean;
  cancelUrlConfigured: boolean;
  environment: string;
  returnUrl: string;
  cancelUrl: string;
  providerEnabled: boolean;
  checkoutRouteAvailable: boolean;
  webhookUrl: string;
  subscriptionMappingsConfigured: number;
  subscriptionMappingsExpected: number;
  mappedProductIds: string[];
}

const CATEGORY_ORDER = ['general', 'payments', 'downloads', 'tax', 'promotions', 'subscriptions'];

function DiagnosticRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <span className={`text-sm font-medium ${ok ? 'text-green-700' : 'text-red-600'}`}>{value}</span>
      </div>
    </div>
  );
}

function DiagnosticInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-mono text-foreground text-right break-all">{value}</span>
    </div>
  );
}

export default function AdminCommerceSettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [diagnostic, setDiagnostic] = useState<DodoDiagnostic | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/settings');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('marketplace_settings')
      .select('*')
      .order('category')
      .then(({ data }) => {
        const s = (data as Setting[]) ?? [];
        setSettings(s);
        const v: Record<string, string> = {};
        s.forEach((row) => { v[row.setting_key] = row.setting_value ?? ''; });
        setValues(v);
        setFetching(false);
      });
  }, [user]);

  const fetchDiagnostic = async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const res = await fetch('/api/payments/dodo/diagnostic');
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Diagnostic failed');
      }
      const data = await res.json();
      setDiagnostic(data);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Diagnostic failed');
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile && ['administrator', 'super_admin'].includes(profile.role ?? '')) {
      fetchDiagnostic();
    }
  }, [user, profile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const updates = Object.entries(values).map(([key, val]) =>
      supabase.from('marketplace_settings').update({ setting_value: val, updated_by: user!.id, updated_at: new Date().toISOString() }).eq('setting_key', key)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) { setError(failed.error.message); setSaving(false); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const grouped = CATEGORY_ORDER.reduce<Record<string, Setting[]>>((acc, cat) => {
    acc[cat] = settings.filter((s) => s.category === cat);
    return acc;
  }, {});

  if (loading) return null;

  const isFullyConfigured = diagnostic?.apiKeyConfigured && diagnostic?.webhookSecretConfigured && diagnostic?.providerEnabled;

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
            <span>Settings</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Marketplace Settings</h1>
                <p className="text-sm text-muted-foreground">Configure the marketplace and payment provider</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || fetching}
              className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Dodo Payments Diagnostic Panel */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Dodo Payments — Configuration Diagnostic</h2>
            <button
              onClick={fetchDiagnostic}
              disabled={diagLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {diagError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs mb-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {diagError}
            </div>
          )}

          {diagLoading && !diagnostic && (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-border border-t-secondary rounded-full animate-spin" />
            </div>
          )}

          {diagnostic && (
            <>
              {/* Overall status badge */}
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 ${
                isFullyConfigured
                  ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
              }`}>
                {isFullyConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className={`text-sm font-medium ${isFullyConfigured ? 'text-green-700' : 'text-amber-700'}`}>
                  {isFullyConfigured
                    ? `Dodo Payments configured — ${diagnostic.environment} mode`
                    : 'Dodo Payments not fully configured — checkout will not work'}
                </span>
              </div>

              {/* Config checks */}
              <div className="bg-muted/30 rounded-xl px-4 mb-4">
                <DiagnosticRow
                  label="DODO_PAYMENTS_API_KEY configured"
                  value={diagnostic.apiKeyConfigured ? 'yes' : 'no'}
                  ok={diagnostic.apiKeyConfigured}
                />
                <DiagnosticRow
                  label="DODO_PAYMENTS_WEBHOOK_SECRET configured"
                  value={diagnostic.webhookSecretConfigured ? 'yes' : 'no'}
                  ok={diagnostic.webhookSecretConfigured}
                />
                <DiagnosticRow
                  label="DODO_PAYMENTS_RETURN_URL configured"
                  value={diagnostic.returnUrlConfigured ? 'yes' : 'no'}
                  ok={diagnostic.returnUrlConfigured}
                />
                <DiagnosticRow
                  label="DODO_PAYMENTS_CANCEL_URL configured"
                  value={diagnostic.cancelUrlConfigured ? 'yes' : 'no'}
                  ok={diagnostic.cancelUrlConfigured}
                />
                <DiagnosticRow
                  label="Dodo Payments enabled"
                  value={diagnostic.providerEnabled ? 'yes' : 'no'}
                  ok={diagnostic.providerEnabled}
                />
                <DiagnosticRow
                  label="Checkout route available"
                  value={diagnostic.checkoutRouteAvailable ? 'yes' : 'no'}
                  ok={diagnostic.checkoutRouteAvailable}
                />
                <DiagnosticRow
                  label="Subscription mappings (test mode)"
                  value={`${diagnostic.subscriptionMappingsConfigured} / ${diagnostic.subscriptionMappingsExpected}`}
                  ok={diagnostic.subscriptionMappingsConfigured >= diagnostic.subscriptionMappingsExpected}
                />
              </div>

              {/* Info rows */}
              <div className="bg-muted/30 rounded-xl px-4 mb-4">
                <DiagnosticInfoRow label="DODO_PAYMENTS_ENVIRONMENT" value={diagnostic.environment} />
                <DiagnosticInfoRow label="Return URL" value={diagnostic.returnUrl} />
                <DiagnosticInfoRow label="Cancel URL" value={diagnostic.cancelUrl} />
                <DiagnosticInfoRow label="Webhook URL" value={diagnostic.webhookUrl} />
              </div>

              {/* Mapped product IDs */}
              {diagnostic.mappedProductIds.length > 0 && (
                <div className="bg-muted/30 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Mapped Dodo Product IDs ({diagnostic.environment})
                  </p>
                  {diagnostic.mappedProductIds.map((pid) => (
                    <div key={pid} className="flex items-center gap-2 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <code className="text-xs text-foreground">{pid}</code>
                    </div>
                  ))}
                </div>
              )}

              {!diagnostic.apiKeyConfigured && (
                <p className="text-xs text-muted-foreground mt-3">
                  Set <code className="bg-muted px-1 rounded">DODO_PAYMENTS_API_KEY</code> and{' '}
                  <code className="bg-muted px-1 rounded">DODO_PAYMENTS_WEBHOOK_SECRET</code> in your{' '}
                  <code className="bg-muted px-1 rounded">.env</code> file. Secrets are never displayed here.
                </p>
              )}
            </>
          )}
        </div>

        {/* Webhook endpoint */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-2">Webhook Endpoint</h2>
          <div className="bg-muted rounded-lg px-4 py-2.5">
            <code className="text-sm text-foreground break-all">
              {process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-domain.com'}/api/webhooks/dodo-payments
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Register this URL in your Dodo Payments dashboard to receive payment events.
            The route accepts POST only and verifies the Dodo signature header.
          </p>
        </div>

        {/* Database settings */}
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const catSettings = grouped[cat] ?? [];
              if (catSettings.length === 0) return null;
              return (
                <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h3 className="font-semibold text-foreground capitalize">{cat}</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {catSettings.map((s) => (
                      <div key={s.setting_key} className="px-5 py-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <label htmlFor={s.setting_key} className="text-sm font-medium text-foreground">{s.label}</label>
                            {s.is_public && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">public</span>}
                          </div>
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          <code className="text-xs text-muted-foreground">{s.setting_key}</code>
                        </div>
                        <div className="shrink-0 w-48">
                          {s.setting_type === 'boolean' ? (
                            <select
                              id={s.setting_key}
                              value={values[s.setting_key] ?? 'false'}
                              onChange={(e) => setValues({ ...values, [s.setting_key]: e.target.value })}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                            >
                              <option value="true">Enabled</option>
                              <option value="false">Disabled</option>
                            </select>
                          ) : (
                            <input
                              id={s.setting_key}
                              type={s.setting_type === 'number' ? 'number' : 'text'}
                              value={values[s.setting_key] ?? ''}
                              onChange={(e) => setValues({ ...values, [s.setting_key]: e.target.value })}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Future compatibility */}
        <div className="mt-6 bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3">Future Compatibility</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              'Seafood Encyclopedia', 'Species Center', 'Smart Search',
              'Seafood Identification AI', 'AI Assistant', 'Marketing Kit', 'Public API'
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">These modules will integrate with the marketplace once implemented.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
