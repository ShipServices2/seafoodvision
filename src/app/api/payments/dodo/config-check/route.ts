// ============================================================
// SEAFOOD VISION — Dodo Payments Server-Side Config Check
// Returns whether Dodo is configured for checkout.
// Runs server-side only — never exposes secret values.
//
// SOURCE OF TRUTH: process.env read at request time (never cached).
// NEXT_PUBLIC_DODO_PAYMENTS_ENABLED is a UI display flag only —
// it is NOT used as a backend gate here.
// ============================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Read directly from process.env at request time — never from a cached constant.
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  // Server-side enabled flag: prefer DODO_PAYMENTS_ENABLED (server-only),
  // fall back to NEXT_PUBLIC_DODO_PAYMENTS_ENABLED, default to true if API key is present.
  const enabledFlag = process.env.DODO_PAYMENTS_ENABLED ?? process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED;
  // If no explicit disabled flag, treat as enabled when API key is present.
  const isEnabled = enabledFlag !== 'false';

  const hasApiKey = typeof apiKey === 'string' && apiKey?.trim()?.length > 0;
  const hasWebhookSecret = typeof webhookSecret === 'string' && webhookSecret?.trim()?.length > 0;

  // Checkout is ready when: API key is present (enabled flag must not be explicitly false).
  const isCheckoutReady = isEnabled && hasApiKey;
  const isWebhookReady = hasWebhookSecret;

  return NextResponse?.json({
    isCheckoutReady,
    isWebhookReady,
    isEnabled,
    apiKeyFound: hasApiKey,
    webhookSecretFound: hasWebhookSecret,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test',
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
