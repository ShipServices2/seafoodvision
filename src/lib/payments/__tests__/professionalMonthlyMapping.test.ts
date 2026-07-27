import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { validateSubscriptionPurchase } from '../CommercialValidationService';

const root = process.cwd();
const repairMigration = readFileSync(join(
  root,
  'supabase/migrations/20260720220000_repair_professional_monthly_test_mapping.sql' ),'utf8');
const certainMappingsMigration = readFileSync(join(
  root,
  'supabase/migrations/20260719120000_dodo_test_certain_mappings.sql'
), 'utf8');
const checkoutService = readFileSync(join(root, 'src/lib/payments/CheckoutService.ts'), 'utf8');
const resume = readFileSync(join(root, 'src/app/checkout/resume/CheckoutResumeContent.tsx'), 'utf8');

const TEST_IDS = {
  explorerMonthly: 'pdt_0NjJwwWYNVeTj06MeYCGW',
  professionalMonthly: 'pdt_0NjJxdsjq65AH2w2HuWDL',
  businessMonthly: 'pdt_0NjJyA1OFHe9XEuAT6AIR',
  explorerAnnual: 'pdt_0NjX0mLZim94JaL68vey',
  professionalAnnual: 'pdt_0NjX0x2DixcGgjMFi2Ml2',
  businessAnnual: 'pdt_0NjX1AAHCwtq0QNpDgY8r',
} as const;

type QueryResult = { data: unknown; error: null };

function result(data: unknown): QueryResult {
  return { data, error: null };
}

function mockSubscriptionClient(
  planCode: 'explorer' | 'professional' | 'business',
  mapping: string | null,
  filters: Array<[string, unknown]> = []
) {
  const prices = {
    explorer: [29, 290],
    professional: [79, 790],
    business: [199, 1990],
  } as const;
  const queue: Record<string, QueryResult[]> = {
    pricing_plans: [result([{
      id: `plan-${planCode}`,
      plan_code: planCode,
      price_monthly: prices[planCode][0],
      price_annual: prices[planCode][1],
      currency: 'EUR',
      is_active: true,
    }])],
    payment_product_mappings: [result(mapping ? { dodo_product_id: mapping } : null)],
    user_subscriptions: [result(null)],
  };

  return {
    from(table: string) {
      const queryResult = queue[table]?.shift() ?? result(null);
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      for (const method of ['in', 'limit']) builder[method] = () => builder;
      builder.maybeSingle = async () => queryResult;
      builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(queryResult).then(resolve, reject);
      return builder;
    },
  };
}

async function validate(
  planCode: 'explorer' | 'professional' | 'business',
  productId: string | null,
  environment: 'test' | 'production' = 'test',
  filters: Array<[string, unknown]> = []
) {
  return validateSubscriptionPurchase({
    userId: 'user-1',
    planCode,
    billingCycle: 'monthly',
    environment,
  }, mockSubscriptionClient(planCode, productId, filters) as never);
}

describe('Professional Monthly Dodo mapping repair', () => {
  test('Professional Monthly mapping is found with its validated TEST Product ID', async () => {
    const validation = await validate('professional', TEST_IDS.professionalMonthly);
    expect(validation).toMatchObject({
      valid: true,
      authoritative_price: 79,
      currency: 'EUR',
      dodo_product_id: TEST_IDS.professionalMonthly,
    });
    expect(repairMigration).toContain(TEST_IDS.professionalMonthly);
  });

  test('Professional Monthly checkout forwards only the server-resolved mapping', () => {
    expect(checkoutService).toContain('const validation = await validateSubscriptionPurchase({');
    expect(checkoutService).toContain('provider.createSubscriptionCheckout({');
    expect(checkoutService).toContain('dodoPriceId: validation.dodo_product_id');
    expect(checkoutService.indexOf('assertCommercialValidation(validation')).toBeLessThan(
      checkoutService.indexOf('provider.createSubscriptionCheckout({')
    );
  });

  test('Explorer Monthly mapping remains resolvable', async () => {
    const validation = await validate('explorer', TEST_IDS.explorerMonthly);
    expect(validation.valid).toBe(true);
    expect(validation.dodo_product_id).toBe(TEST_IDS.explorerMonthly);
  });

  test('Business Monthly mapping remains resolvable', async () => {
    const validation = await validate('business', TEST_IDS.businessMonthly);
    expect(validation.valid).toBe(true);
    expect(validation.dodo_product_id).toBe(TEST_IDS.businessMonthly);
  });

  test('all three annual TEST mappings remain unchanged', () => {
    for (const productId of [
      TEST_IDS.explorerAnnual,
      TEST_IDS.professionalAnnual,
      TEST_IDS.businessAnnual,
    ]) {
      expect(certainMappingsMigration).toContain(productId);
      expect(repairMigration).not.toContain(productId);
    }
  });

  test('a missing mapping returns the precise monthly mapping error', async () => {
    const validation = await validate('professional', null);
    expect(validation.valid).toBe(false);
    expect(validation.blockers).toEqual(['Dodo monthly mapping is missing for this plan']);
  });

  test('a production lookup never falls back to the TEST mapping', async () => {
    const filters: Array<[string, unknown]> = [];
    const validation = await validate('professional', null, 'production', filters);
    expect(validation.valid).toBe(false);
    expect(filters).toContainEqual(['environment', 'production']);
    expect(validation.dodo_product_id).toBeNull();
  });

  test('the frontend supplies no Dodo Product ID', () => {
    expect(resume).toContain('planCode: subscriptionSelection?.planCode');
    expect(resume).toContain('billingCycle: cycle');
    expect(resume).not.toMatch(/pdt_[A-Za-z0-9]+|dodoProductId/);
  });

  test('the repair is idempotent, TEST-only, and never calls Dodo LIVE', () => {
    const executableSql = repairMigration.replace(/--.*$/gm, '');
    expect(executableSql).toContain('ON CONFLICT (internal_product_id, environment, billing_cycle)');
    expect(executableSql).toContain("'test'::public.dodo_environment");
    expect(executableSql).not.toMatch(/'production'|'live'/i);
  });

  test('the repair and client contract expose no credential or secret', () => {
    const reviewedText = `${repairMigration}\n${resume}`;
    expect(reviewedText).not.toMatch(/DODO_PAYMENTS_API_KEY|DODO_PAYMENTS_WEBHOOK_SECRET/);
    expect(reviewedText).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  });
});
