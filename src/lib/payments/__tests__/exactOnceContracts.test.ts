import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260718100000_marketplace_exact_once.sql'),
  'utf8'
);
const foundation = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260715030000_phase_7_2_part_1_dodo_payments_foundation.sql'),
  'utf8'
);
const webhook = readFileSync(join(process.cwd(), 'src/lib/payments/WebhookService.ts'), 'utf8');

describe('marketplace exact-once database contracts', () => {
  test('does not recreate an existing marketplace table', () => {
    expect(migration)?.not?.toMatch(/CREATE\s+TABLE/i);
  });

  test('wraps legacy reconciliation and constraints in one transaction', () => {
    expect(migration?.trimStart())?.toContain('BEGIN;');
    expect(migration?.trimEnd())?.toMatch(/COMMIT;$/);
  });

  test('deduplicates and uniquely keys Dodo payment transactions', () => {
    expect(migration)?.toContain('marketplace_transaction_remap');
    expect(migration)?.toContain('uq_payment_transactions_dodo_payment');
  });

  test('credits each purchase order once under a per-user lock', () => {
    expect(migration)?.toContain('uq_credit_ledger_purchase_order');
    expect(migration)?.toContain('pg_advisory_xact_lock');
    expect(migration)?.toContain('apply_credit_purchase');
  });

  test('creates one entitlement per purchased license', () => {
    expect(migration)?.toContain('uq_download_entitlements_purchased_license');
  });

  test('creates one subscription per external subscription and environment', () => {
    expect(migration)?.toContain('uq_user_subscriptions_dodo_subscription');
  });

  test('remaps every known subscription foreign key before deleting duplicates', () => {
    expect(migration)?.toContain('UPDATE public.download_entitlements');
    expect(migration)?.toContain('UPDATE public.subscription_events');
    expect(migration)?.toContain('UPDATE public.payment_webhook_events');
  });

  test('keeps the existing purchased-license business key unique', () => {
    expect(foundation)?.toMatch(/UNIQUE\s*\(user_id, asset_id, license_type_id, order_id\)/);
  });

  test('deduplicates refunds before unique external refund enforcement', () => {
    expect(migration)?.toContain('marketplace_refund_remap');
    expect(migration)?.toContain('uq_refunds_external_refund');
    expect(migration)?.toContain('uq_refund_items_order_item');
  });

  test('prevents concurrent active orders for one checkout key', () => {
    expect(migration)?.toContain('uq_orders_active_checkout_key');
    expect(migration)?.toMatch(/status IN \('draft', 'pending'\)/);
  });
});

describe('marketplace exact-once webhook contracts', () => {
  test('recovers payment insert unique races', () => {
    expect(webhook)?.toContain("error?.code === '23505'");
    expect(webhook)?.toContain(".eq('external_payment_id', externalPaymentId)");
  });

  test('uses the atomic credit purchase function', () => {
    expect(webhook)?.toContain(".rpc('apply_credit_purchase'");
  });

  test('persists refunds and refund items through existing tables', () => {
    expect(webhook)?.toContain(".from('refunds')");
    expect(webhook)?.toContain(".from('refund_items')");
  });

  test('revokes licenses and entitlements only for full refunds', () => {
    expect(webhook)?.toContain("if (!isPartial)");
    expect(webhook)?.toContain("status: 'revoked'");
  });
});
