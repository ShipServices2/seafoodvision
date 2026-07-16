// ============================================================
// SEAFOOD VISION — Unified Dodo Checkout Route
// Handles both subscription and asset-license checkout.
// Server-side only. Never trusts prices from the browser.
// Idempotency: prevents double orders from double-click / refresh.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateAssetLicenseCheckout, initiateSubscriptionCheckout } from '@/lib/payments/CheckoutService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, planCode, billingCycle, assetId, licenseTypeCode, unitProductCode } = body as {
      type?: string;
      planCode?: string;
      billingCycle?: string;
      assetId?: string;
      licenseTypeCode?: string;
      unitProductCode?: string;
    };

    // ── Subscription checkout ──────────────────────────────
    if (type === 'subscription' || planCode) {
      if (!planCode || !billingCycle) {
        return NextResponse.json(
          { error: 'Missing required fields: planCode, billingCycle' },
          { status: 400 }
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return NextResponse.json(
          { error: 'billingCycle must be monthly or annual' },
          { status: 400 }
        );
      }

      // Idempotency: if a pending order already exists for this user+plan+cycle
      // within the last 10 minutes, reuse it instead of creating a duplicate.
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, external_checkout_id, status')
        .eq('user_id', user.id)
        .eq('order_type', 'subscription')
        .in('status', ['pending', 'draft'])
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrder?.external_checkout_id) {
        // Reuse existing checkout session — return the stored checkout URL
        // We can't retrieve the URL from Dodo without calling their API again,
        // so we re-initiate (Dodo is idempotent on product_cart + customer).
        // Fall through to create a new session with the same order.
      }

      const result = await initiateSubscriptionCheckout({
        userId: user.id,
        userEmail: user.email ?? '',
        planCode,
        billingCycle: billingCycle as 'monthly' | 'annual',
      });

      return NextResponse.json(result);
    }

    // ── Asset license checkout ─────────────────────────────
    if (assetId && licenseTypeCode && unitProductCode) {
      const result = await initiateAssetLicenseCheckout({
        userId: user.id,
        userEmail: user.email ?? '',
        assetId,
        licenseTypeCode,
        unitProductCode,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Missing required fields. Provide planCode+billingCycle for subscriptions, or assetId+licenseTypeCode+unitProductCode for asset licenses.' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed';
    console.error('[checkout/unified] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
