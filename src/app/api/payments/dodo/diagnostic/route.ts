import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Server-side only — never expose actual key values
    const apiKeyConfigured = !!(
      process.env.DODO_PAYMENTS_API_KEY &&
      process.env.DODO_PAYMENTS_API_KEY?.length > 0
    );
    const webhookSecretConfigured = !!(
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET &&
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET?.length > 0
    );
    const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
    const providerEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';
    const returnUrlConfigured = !!(
      process.env.DODO_PAYMENTS_RETURN_URL &&
      process.env.DODO_PAYMENTS_RETURN_URL?.length > 0
    );
    const cancelUrlConfigured = !!(
      process.env.DODO_PAYMENTS_CANCEL_URL &&
      process.env.DODO_PAYMENTS_CANCEL_URL?.length > 0
    );

    // Return URLs (safe to show — not secrets)
    const returnUrl =
      process.env.DODO_PAYMENTS_RETURN_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/success`;
    const cancelUrl =
      process.env.DODO_PAYMENTS_CANCEL_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/checkout/cancel`;

    // Check product mappings for the three subscription plans
    const { data: mappings } = await supabase?.from('payment_product_mappings')?.select('dodo_product_id, notes, is_active, internal_product_id')?.eq('internal_product_type', 'subscription_plan')?.eq('environment', environment)?.eq('is_active', true);

    const mappingCount = mappings?.length ?? 0;
    const mappedProductIds = mappings?.map((m) => m?.dodo_product_id)?.filter(Boolean) ?? [];

    return NextResponse?.json({
      // Key presence — yes/no only, never the actual values
      apiKeyConfigured,
      webhookSecretConfigured,
      returnUrlConfigured,
      cancelUrlConfigured,
      // Non-secret config
      environment,
      returnUrl,
      cancelUrl,
      providerEnabled,
      checkoutRouteAvailable: true,
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/webhooks/dodo-payments`,
      // Mapping status
      subscriptionMappingsConfigured: mappingCount,
      subscriptionMappingsExpected: 3,
      mappedProductIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error?.message : 'Diagnostic failed';
    return NextResponse?.json({ error: message }, { status: 500 });
  }
}
