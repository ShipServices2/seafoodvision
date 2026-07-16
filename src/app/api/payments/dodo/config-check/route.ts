// ============================================================
// SEAFOOD VISION — Dodo Payments Server-Side Config Check
// Returns whether Dodo is configured for checkout.
// Runs server-side only — never exposes secret values.
// ============================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // All checks are server-side — process.env is only available here, never on the client.
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const isEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';

  const isCheckoutReady = isEnabled && !!apiKey && apiKey?.trim()?.length > 0;

  return NextResponse?.json({
    isCheckoutReady,
    isEnabled,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test',
  });
}
