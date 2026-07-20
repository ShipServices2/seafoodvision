// ============================================================
// SEAFOOD VISION — Unified Dodo Checkout Route
// Handles both subscription and asset-license checkout.
// Server-side only. Never trusts prices from the browser.
// Idempotency: prevents double orders from double-click / refresh.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateAssetLicenseCheckout, initiateSubscriptionCheckout } from '@/lib/payments/CheckoutService';
import { getDodoRuntimeConfig } from '@/lib/payments/dodo/config';

export const dynamic = 'force-dynamic';

function configurationError() {
  const config = getDodoRuntimeConfig();
  if (!config.isEnabled) return { errorCode: 'provider_disabled', error: 'Dodo Payments is disabled' };
  if (!config.environmentValid) return { errorCode: 'environment_invalid', error: 'Dodo Payments environment is invalid' };
  if (!config.apiKeyFound) return { errorCode: 'api_key_missing', error: 'Dodo Payments API key is not configured' };
  return null;
}

function checkoutErrorCode(message: string): string {
  if (/subscription plan .*not found or inactive/i.test(message)) return 'plan_unavailable';
  if (/mapping is missing/i.test(message)) return 'mapping_missing';
  return 'checkout_failed';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providerBlocker = configurationError();
    if (providerBlocker) {
      return NextResponse.json(providerBlocker, { status: 503 });
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
    return NextResponse.json({ error: message, errorCode: checkoutErrorCode(message) }, { status: 500 });
  }
}
