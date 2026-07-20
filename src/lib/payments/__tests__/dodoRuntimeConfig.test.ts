import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { getDodoRuntimeConfig } from '../dodo/config';

const DODO_ENV_KEYS = [
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_SECRET',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PAYMENTS_ENABLED',
  'NEXT_PUBLIC_DODO_PAYMENTS_ENABLED',
] as const;

describe('getDodoRuntimeConfig', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of DODO_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of DODO_ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('reports checkout and webhook ready from the same runtime state', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.DODO_PAYMENTS_ENVIRONMENT = 'test';
    expect(getDodoRuntimeConfig()).toMatchObject({
      isCheckoutReady: true,
      isWebhookReady: true,
      apiKeyFound: true,
      webhookSecretFound: true,
      environment: 'test',
    });
  });

  test('allows checkout without a webhook secret', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    expect(getDodoRuntimeConfig()).toMatchObject({
      isCheckoutReady: true,
      isWebhookReady: false,
    });
  });

  test('blocks checkout when API key is absent', () => {
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
    expect(getDodoRuntimeConfig()).toMatchObject({
      isCheckoutReady: false,
      isWebhookReady: true,
    });
  });

  test('trims surrounding whitespace', () => {
    process.env.DODO_PAYMENTS_API_KEY = '  test-api-key  ';
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = '  test-secret  ';
    process.env.DODO_PAYMENTS_ENVIRONMENT = '  test  ';
    expect(getDodoRuntimeConfig()).toMatchObject({
      isCheckoutReady: true,
      isWebhookReady: true,
      environment: 'test',
    });
  });

  test('treats whitespace-only credentials as absent', () => {
    process.env.DODO_PAYMENTS_API_KEY = '   ';
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = '';
    expect(getDodoRuntimeConfig()).toMatchObject({
      apiKeyFound: false,
      webhookSecretFound: false,
      isCheckoutReady: false,
      isWebhookReady: false,
    });
  });

  test('rejects an invalid environment for both operations', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = 'test-secret';
    process.env.DODO_PAYMENTS_ENVIRONMENT = 'staging';
    expect(getDodoRuntimeConfig()).toMatchObject({
      environment: 'invalid',
      environmentValid: false,
      isCheckoutReady: false,
      isWebhookReady: false,
    });
  });

  test('normalizes live to the production runtime environment', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    process.env.DODO_PAYMENTS_ENVIRONMENT = 'live';
    expect(getDodoRuntimeConfig()).toMatchObject({
      environment: 'production',
      environmentValid: true,
    });
  });

  test('honors an explicitly disabled provider flag', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    process.env.DODO_PAYMENTS_ENABLED = ' false ';
    expect(getDodoRuntimeConfig()).toMatchObject({
      isEnabled: false,
      isCheckoutReady: false,
    });
  });

  test('never returns credential values', () => {
    process.env.DODO_PAYMENTS_API_KEY = 'secret-api-value';
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = 'secret-webhook-value';
    const serialized = JSON.stringify(getDodoRuntimeConfig());
    expect(serialized).not.toContain('secret-api-value');
    expect(serialized).not.toContain('secret-webhook-value');
  });
});

describe('Dodo runtime source contracts', () => {
  const root = process.cwd();
  const configRoute = readFileSync(join(root, 'src/app/api/payments/dodo/config-check/route.ts'), 'utf8');
  const checkoutRoute = readFileSync(join(root, 'src/app/api/payments/dodo/checkout/route.ts'), 'utf8');
  const resume = readFileSync(join(root, 'src/app/checkout/resume/CheckoutResumeContent.tsx'), 'utf8');
  const checkoutService = readFileSync(join(root, 'src/lib/payments/CheckoutService.ts'), 'utf8');
  const provider = readFileSync(join(root, 'src/lib/payments/dodo/DodoPaymentsProvider.ts'), 'utf8');
  const webhook = readFileSync(join(root, 'src/app/api/webhooks/dodo-payments/route.ts'), 'utf8');
  const supabaseServer = readFileSync(join(root, 'src/lib/supabase/server.ts'), 'utf8');

  test('config-check delegates to runtime truth and disables caching', () => {
    expect(configRoute).toContain('getDodoRuntimeConfig');
    expect(configRoute).not.toContain('process.env');
    expect(configRoute).toContain('no-store, no-cache, must-revalidate');
  });

  test('checkout route and CheckoutService use runtime truth', () => {
    expect(checkoutRoute).toContain('getDodoRuntimeConfig');
    expect(checkoutService).toContain('getDodoRuntimeConfig().isCheckoutReady');
    expect(provider).toContain('getDodoConfig()');
  });

  test('resume requests fresh status and reacts only to configuration error codes', () => {
    expect(resume).toContain("cache: 'no-store'");
    expect(resume).toContain("'provider_disabled', 'api_key_missing', 'environment_invalid'");
    expect(resume).not.toContain("errMsg.toLowerCase().includes('dodo payments')");
  });

  test('Explorer Monthly purchase intent is preserved', () => {
    expect(resume).toContain('resolveSubscriptionSelection(plan');
    expect(resume).toContain('planCode: subscriptionSelection?.planCode');
    expect(resume).toContain('billingCycle: cycle');
  });

  test('plan and mapping failures have codes distinct from configuration', () => {
    expect(checkoutRoute).toContain("return 'plan_unavailable'");
    expect(checkoutRoute).toContain("return 'mapping_missing'");
  });

  test('webhook checks runtime webhook readiness before verification', () => {
    expect(webhook).toContain('getDodoRuntimeConfig');
    expect(webhook).toContain('if (!runtimeConfig.isWebhookReady)');
    expect(webhook).toContain("{ status: 503 }");
  });

  test('Supabase service-role values are read and trimmed at runtime', () => {
    expect(supabaseServer).toContain("process.env[name]?.trim()");
    expect(supabaseServer).toContain("runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')");
    expect(supabaseServer).not.toContain('const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY');
  });
});
