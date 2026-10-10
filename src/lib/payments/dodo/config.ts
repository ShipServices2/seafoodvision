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
  const environment: DodoRuntimeEnvironment = rawEnvironment === 'test' ?'test'
    : rawEnvironment === 'production'|| rawEnvironment === 'live' ?'production' :'invalid';
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

/** Removes accidental double-scheme prefixes like "https://https://" */
function sanitizeUrl(raw: string): string {
  return raw.replace(/^(https?:\/\/)+/, (match) => {
    // Keep only the last occurrence of the scheme
    const scheme = match.endsWith('https://') ? 'https://' : 'http://';
    return scheme;
  });
}

function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.host;
  } catch {
    return false;
  }
}

/**
 * Base of the return/cancel URLs: NEXT_PUBLIC_SITE_URL when it is a valid absolute URL, else the origin of the
 * current request. Dodo rejects relative URLs ("return_url: must be a valid URL"), so there is no relative fallback.
 */
export function resolveSiteBase(requestOrigin?: string | null): string {
  const configured = sanitizeUrl(process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '');
  const candidate = isAbsoluteHttpUrl(configured) ? configured : (requestOrigin?.trim() ?? '');
  if (!isAbsoluteHttpUrl(candidate)) {
    throw new Error('Cannot build Dodo return URLs: set NEXT_PUBLIC_SITE_URL to an absolute URL (e.g. https://example.com).');
  }
  return candidate.replace(/\/+$/, '');
}

function absoluteReturnUrl(envName: string, path: string, requestOrigin?: string | null): string {
  // A dedicated variable is honoured only when it is absolute; empty or relative values fall back to the base.
  const configured = sanitizeUrl(process.env[envName]?.trim() ?? '');
  if (isAbsoluteHttpUrl(configured)) return configured;
  return `${resolveSiteBase(requestOrigin)}${path}`;
}

export function getDodoReturnUrl(requestOrigin?: string | null): string {
  return absoluteReturnUrl('DODO_PAYMENTS_RETURN_URL', '/checkout/success', requestOrigin);
}

export function getDodoCancelUrl(requestOrigin?: string | null): string {
  return absoluteReturnUrl('DODO_PAYMENTS_CANCEL_URL', '/checkout/cancel', requestOrigin);
}

/** Last line of defence before Dodo is called: the return/cancel URLs must be absolute http(s) URLs. */
export function assertAbsoluteReturnUrls(urls: { successUrl: string; cancelUrl: string }): void {
  if (!isAbsoluteHttpUrl(urls.successUrl) || !isAbsoluteHttpUrl(urls.cancelUrl)) {
    throw new Error('Dodo return_url and cancel_url must be absolute http(s) URLs.');
  }
}
