import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDodoRuntimeConfig } from '@/lib/payments/dodo/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase?.auth?.getUser();

    if (!user) {
      return NextResponse?.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase?.from('profiles')?.select('role')?.eq('id', user?.id)?.single();

    if (!profile || !['administrator', 'super_admin']?.includes(profile?.role ?? '')) {
      return NextResponse?.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Variable audit (server-side only — never expose values) ──────────────
    // DODO_PAYMENTS_API_KEY: required for checkout
    const runtimeConfig = getDodoRuntimeConfig();
    const apiKeyConfigured = runtimeConfig?.apiKeyFound;
    // DODO_PAYMENTS_WEBHOOK_SECRET: required for webhook signature verification
    const webhookSecretConfigured = runtimeConfig?.webhookSecretFound;
    const environment = runtimeConfig?.environment;
    const providerEnabled = runtimeConfig?.isEnabled;
    const returnUrlConfigured = !!(
      process.env.DODO_PAYMENTS_RETURN_URL &&
      process.env.DODO_PAYMENTS_RETURN_URL?.length > 0
    );
    const cancelUrlConfigured = !!(
      process.env.DODO_PAYMENTS_CANCEL_URL &&
      process.env.DODO_PAYMENTS_CANCEL_URL?.length > 0
    );

    // Checkout is ready when API key is present and provider is enabled
    const checkoutReady = runtimeConfig?.isCheckoutReady;
    // Webhook verification is ready when webhook secret is present
    const webhookReady = runtimeConfig?.isWebhookReady;

    // Return URLs (safe to show — not secrets)
    const returnUrl =
      process.env.DODO_PAYMENTS_RETURN_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/success`;
    const cancelUrl =
      process.env.DODO_PAYMENTS_CANCEL_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/cancel`;

    // Check product mappings for the three subscription plans
    const { data: mappings } = await supabase
      ?.from('payment_product_mappings')
      ?.select('dodo_product_id, notes, is_active, internal_product_id')
      ?.eq('internal_product_type', 'subscription_plan')
      ?.eq('environment', environment)
      ?.eq('is_active', true);

    const mappingCount = mappings?.length ?? 0;
    const mappedProductIds = mappings?.map((m) => m?.dodo_product_id)?.filter(Boolean) ?? [];

    return NextResponse?.json({
      // ── Variable presence (FOUND / MISSING — never the actual values) ──
      'DODO_PAYMENTS_API_KEY': apiKeyConfigured ? 'FOUND' : 'MISSING',
      'DODO_PAYMENTS_WEBHOOK_SECRET': webhookSecretConfigured ? 'FOUND' : 'MISSING',
      'DODO_PAYMENTS_ENVIRONMENT': 'FOUND',
      'DODO_PAYMENTS_RETURN_URL': returnUrlConfigured ? 'FOUND' : 'MISSING',
      'DODO_PAYMENTS_CANCEL_URL': cancelUrlConfigured ? 'FOUND' : 'MISSING',
      'NEXT_PUBLIC_DODO_PAYMENTS_ENABLED': providerEnabled ? 'FOUND (true)' : 'FOUND (false)',
      // ── Readiness ──
      checkoutReady,
      webhookReady,
      // ── Non-secret config ──
      environment,
      returnUrl,
      cancelUrl,
      providerEnabled,
      checkoutRouteAvailable: true,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/webhooks/dodo-payments`,
      // ── Mapping status ──
      subscriptionMappingsConfigured: mappingCount,
      subscriptionMappingsExpected: 3,
      mappedProductIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error?.message : 'Diagnostic failed';
    return NextResponse?.json({ error: message }, { status: 500 });
  }
}
