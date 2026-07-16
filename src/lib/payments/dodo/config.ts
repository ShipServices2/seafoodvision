// ============================================================
// SEAFOOD VISION — Dodo Payments Configuration
// Detects: disabled | test | missing_config | valid
//
// SERVER-SIDE ONLY. All values read from process.env at call time.
// NEXT_PUBLIC_DODO_PAYMENTS_ENABLED is a UI display flag only —
// it is NOT used as a backend gate for checkout readiness.
//
// VARIABLE AUDIT (server-side only):
//   DODO_PAYMENTS_API_KEY         → required for checkout
//   DODO_PAYMENTS_WEBHOOK_SECRET  → required for webhook verification
//   DODO_PAYMENTS_ENVIRONMENT     → defaults to 'test'
//   DODO_PAYMENTS_RETURN_URL      → return URL after checkout
//   DODO_PAYMENTS_CANCEL_URL      → cancel URL
//   DODO_PAYMENTS_ENABLED         → server-side enabled flag (optional, defaults to true)
//   NEXT_PUBLIC_DODO_PAYMENTS_ENABLED → UI display flag only, never a backend gate
// ============================================================

import type { PaymentProviderConfig, PaymentEnvironment } from '../types';

export function getDodoConfig(): PaymentProviderConfig {
  // Read directly from process.env at call time — never from a module-level constant.
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as PaymentEnvironment;

  // Server-side enabled flag: prefer DODO_PAYMENTS_ENABLED (server-only),
  // fall back to NEXT_PUBLIC_DODO_PAYMENTS_ENABLED, default to true if not explicitly disabled.
  const enabledFlag = process.env.DODO_PAYMENTS_ENABLED ?? process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED;
  const isEnabled = enabledFlag !== 'false';

  const hasApiKey = typeof apiKey === 'string' && apiKey.trim().length > 0;
  const hasWebhookSecret = typeof webhookSecret === 'string' && webhookSecret.trim().length > 0;

  // Checkout only requires the API key — webhook secret is for signature verification only.
  const missingKeys: string[] = [];
  if (!hasApiKey) missingKeys.push('DODO_PAYMENTS_API_KEY');

  // isConfigured = checkout is ready (API key present, not explicitly disabled)
  const isConfigured = isEnabled && hasApiKey;

  return {
    isEnabled,
    environment,
    isConfigured,
    missingKeys,
    // Extra fields for internal use
    isCheckoutReady: isEnabled && hasApiKey,
    isWebhookReady: hasWebhookSecret,
    webhookSecretConfigured: hasWebhookSecret,
  };
}

export function assertDodoConfigured(): void {
  const config = getDodoConfig();
  if (!config.isEnabled) {
    throw new Error('Dodo Payments is disabled (set DODO_PAYMENTS_ENABLED=false or NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=false)');
  }
  if (!config.isConfigured) {
    throw new Error(
      `Dodo Payments configuration incomplete. Missing: ${config.missingKeys.join(', ')}`
    );
  }
  if (config.environment === 'production') {
    throw new Error('Dodo Payments production mode is not yet enabled in this phase.');
  }
}

export function getDodoReturnUrl(): string {
  return (
    process.env.DODO_PAYMENTS_RETURN_URL ??
    `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success`
  );
}

export function getDodoCancelUrl(): string {
  return (
    process.env.DODO_PAYMENTS_CANCEL_URL ??
    `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`
  );
}
