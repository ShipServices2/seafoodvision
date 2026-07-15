// ============================================================
// SEAFOOD VISION — Dodo Payments Configuration
// Detects: disabled | test | missing_config | valid
// ============================================================

import type { PaymentProviderConfig, PaymentEnvironment } from '../types';

export function getDodoConfig(): PaymentProviderConfig {
  const isEnabled = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENABLED === 'true';
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as PaymentEnvironment;
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  const missingKeys: string[] = [];
  if (!apiKey) missingKeys.push('DODO_PAYMENTS_API_KEY');
  if (!webhookSecret) missingKeys.push('DODO_PAYMENTS_WEBHOOK_SECRET');

  const isConfigured = missingKeys.length === 0;

  return {
    isEnabled,
    environment,
    isConfigured,
    missingKeys,
  };
}

export function assertDodoConfigured(): void {
  const config = getDodoConfig();
  if (!config.isEnabled) {
    throw new Error('Dodo Payments is disabled (NEXT_PUBLIC_DODO_PAYMENTS_ENABLED=false)');
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
