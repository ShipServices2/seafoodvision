'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface ConfigRow {
  label: string;
  envKey: string;
  value: string;
  isSecret: boolean;
  isPublic: boolean;
  required: boolean;
}

const CONFIG_ROWS: ConfigRow[] = [
  { label: 'Provider enabled', envKey: 'NEXT_PUBLIC_DODO_PAYMENTS_ENABLED', value: process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED ?? 'false', isSecret: false, isPublic: true, required: true },
  { label: 'Environment', envKey: 'DODO_PAYMENTS_ENVIRONMENT', value: process.env.DODO_PAYMENTS_ENVIRONMENT ?? '(not set)', isSecret: false, isPublic: false, required: true },
  { label: 'API Key', envKey: 'DODO_PAYMENTS_API_KEY', value: process.env.DODO_PAYMENTS_API_KEY ? '••••••••' : '(not set)', isSecret: true, isPublic: false, required: true },
  { label: 'Webhook Secret', envKey: 'DODO_PAYMENTS_WEBHOOK_SECRET', value: process.env.DODO_PAYMENTS_WEBHOOK_SECRET ? '••••••••' : '(not set)', isSecret: true, isPublic: false, required: true },
  { label: 'Return URL', envKey: 'DODO_PAYMENTS_RETURN_URL', value: process.env.DODO_PAYMENTS_RETURN_URL ?? '(uses NEXT_PUBLIC_SITE_URL/checkout/success)', isSecret: false, isPublic: false, required: false },
  { label: 'Cancel URL', envKey: 'DODO_PAYMENTS_CANCEL_URL', value: process.env.DODO_PAYMENTS_CANCEL_URL ?? '(uses NEXT_PUBLIC_SITE_URL/checkout/cancel)', isSecret: false, isPublic: false, required: false },
  { label: 'Webhook URL', envKey: 'DODO_PAYMENTS_WEBHOOK_URL', value: process.env.DODO_PAYMENTS_WEBHOOK_URL ?? '(uses NEXT_PUBLIC_SITE_URL/api/webhooks/dodo-payments)', isSecret: false, isPublic: false, required: false },
];

export default function AdminCommerceSettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/commerce/settings');
    if (!loading && profile && !['administrator', 'super_admin'].includes(profile.role ?? '')) router.replace('/admin');
  }, [loading, user, profile, router]);

  if (loading) return null;

  const isEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
  const hasApiKey = !!process.env.DODO_PAYMENTS_API_KEY;
  const hasWebhookSecret = !!process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  const isConfigured = hasApiKey && hasWebhookSecret;

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
          <h1 className="text-2xl font-bold text-foreground">Payment Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Dodo Payments configuration and environment status</p>
        </div>

        {/* Status banner */}
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm mb-6 border ${
          isEnabled && isConfigured && environment === 'test' ?'bg-amber-50 border-amber-200 text-amber-700'
            : isEnabled && isConfigured
            ? 'bg-green-50 border-green-200 text-green-700' :'bg-muted border-border text-muted-foreground'
        }`}>
          {isEnabled && isConfigured ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <div>
            {!isEnabled && <p><strong>Dodo Payments is disabled.</strong> Set <code className="bg-muted px-1 rounded">NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=true</code> to enable checkout.</p>}
            {isEnabled && !isConfigured && <p><strong>Configuration incomplete.</strong> API key and webhook secret are required.</p>}
            {isEnabled && isConfigured && environment === 'test' && <p><strong>Test mode active.</strong> No real payments will be processed. Production mode is not yet enabled in Phase 7.2.</p>}
            {isEnabled && isConfigured && environment === 'production' && <p><strong>⚠️ Production mode is not yet enabled in Phase 7.2.</strong> Switch to test mode.</p>}
          </div>
        </div>

        {/* Config table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Environment Variables</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure these in your <code>.env</code> file. Never commit secrets to Git.</p>
          </div>
          <div className="divide-y divide-border">
            {CONFIG_ROWS.map((row) => {
              const isSet = !row.value.includes('(not set)');
              const isMissing = row.required && !isSet;
              return (
                <div key={row.envKey} className="flex items-center justify-between px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{row.label}</span>
                      {row.isPublic && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">public</span>}
                      {row.isSecret && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">secret</span>}
                      {row.required && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">required</span>}
                    </div>
                    <code className="text-xs text-muted-foreground">{row.envKey}</code>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-sm font-mono ${isMissing ? 'text-red-500' : 'text-foreground'}`}>
                      {row.value}
                    </span>
                    {isMissing ? (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : isSet ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Webhook endpoint */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-2">Webhook Endpoint</h2>
          <p className="text-sm text-muted-foreground mb-3">Register this URL in your Dodo Payments dashboard to receive events:</p>
          <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2.5">
            <code className="text-sm text-foreground flex-1 break-all">
              {process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-domain.com'}/api/webhooks/dodo-payments
            </code>
            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        {/* Next steps */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3">Next steps to activate Dodo Payments</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Create a Dodo Payments account and access the test dashboard</li>
            <li>Create products matching your subscription plans, unit products and credit packs</li>
            <li>Copy the API key and webhook secret to your <code className="bg-muted px-1 rounded">.env</code> file</li>
            <li>Register the webhook URL above in the Dodo Payments dashboard</li>
            <li>Add product mappings in <Link href="/admin/commerce/mappings" className="text-secondary hover:underline">Commerce → Mappings</Link></li>
            <li>Set <code className="bg-muted px-1 rounded">NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=true</code></li>
            <li>Implement <code className="bg-muted px-1 rounded">DodoPaymentsProvider</code> methods with the official Dodo Payments API</li>
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  );
}
