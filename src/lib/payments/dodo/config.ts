import type { PaymentProviderConfig, PaymentEnvironment } from '../types';

export type DodoRuntimeEnvironment = PaymentEnvironment | 'invalid';

export interface DodoRuntimeConfig {
  isEnabled: boolean;
  apiKeyFound: boolean;
  webhookSecretFound: boolean;
  environment: DodoRuntimeEnvironment;
  environmentValid: boolean;
  isCheckoutReady: boolean;
  isWebhookReady: boolean;
}

function runtimeValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Runtime-only, secret-safe source of truth for Dodo readiness. */
export function getDodoRuntimeConfig(): DodoRuntimeConfig {
  const apiKeyFound = runtimeValue('DODO_PAYMENTS_API_KEY') !== null;
  const webhookSecretFound = runtimeValue('DODO_PAYMENTS_WEBHOOK_SECRET') !== null;
  const rawEnvironment = runtimeValue('DODO_PAYMENTS_ENVIRONMENT')?.toLowerCase() ?? 'test';
  const environment: DodoRuntimeEnvironment = rawEnvironment === 'test'
    ? 'test'
    : rawEnvironment === 'production' || rawEnvironment === 'live'
      ? 'production'
      : 'invalid';
  const environmentValid = environment !== 'invalid';
  const enabledValue = (
    runtimeValue('DODO_PAYMENTS_ENABLED')
    ?? runtimeValue('NEXT_PUBLIC_DODO_PAYMENTS_ENABLED')
    ?? 'true'
  ).toLowerCase();
  const isEnabled = enabledValue !== 'false';

  return {
    isEnabled,
    apiKeyFound,
    webhookSecretFound,
    environment,
    environmentValid,
    isCheckoutReady: isEnabled && apiKeyFound && environmentValid,
    isWebhookReady: webhookSecretFound && environmentValid,
  };
}

/** Backward-compatible provider configuration derived from runtime truth. */
export function getDodoConfig(): PaymentProviderConfig {
  const runtime = getDodoRuntimeConfig();
  const missingKeys: string[] = [];
  if (!runtime.apiKeyFound) missingKeys.push('DODO_PAYMENTS_API_KEY');
  if (!runtime.environmentValid) missingKeys.push('DODO_PAYMENTS_ENVIRONMENT');

  return {
    isEnabled: runtime.isEnabled,
    environment: runtime.environment === 'invalid' ? 'test' : runtime.environment,
    isConfigured: runtime.isCheckoutReady,
    missingKeys,
    isCheckoutReady: runtime.isCheckoutReady,
    isWebhookReady: runtime.isWebhookReady,
    webhookSecretConfigured: runtime.webhookSecretFound,
  };
}

export function assertDodoConfigured(): void {
  const runtime = getDodoRuntimeConfig();
  if (!runtime.isEnabled) {
    throw new Error('Dodo Payments is disabled');
  }
  if (!runtime.environmentValid) {
    throw new Error('Dodo Payments environment is invalid; expected test, live, or production');
  }
  if (!runtime.apiKeyFound) {
    throw new Error('Dodo Payments configuration incomplete. Missing: DODO_PAYMENTS_API_KEY');
  }
  if (runtime.environment === 'production') {
    throw new Error('Dodo Payments production mode is not yet enabled in this phase.');
  }
}

export function getDodoReturnUrl(): string {
  return process.env.DODO_PAYMENTS_RETURN_URL?.trim()
    || `${process.env.NEXT_PUBLIC_SITE_URL?.trim()}/checkout/success`;
}

export function getDodoCancelUrl(): string {
  return process.env.DODO_PAYMENTS_CANCEL_URL?.trim()
    || `${process.env.NEXT_PUBLIC_SITE_URL?.trim()}/checkout/cancel`;
}
