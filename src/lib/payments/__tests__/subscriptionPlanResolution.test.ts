import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalPlanCode,
  isPurchasableSubscriptionPlan,
  resolveSubscriptionSelection,
} from '../subscriptionPlanResolution';

describe('subscription plan resolution', () => {
  test.each([
    ['explorer', 'explorer'],
    ['explorer_monthly', 'explorer'],
    ['professional-monthly', 'professional'],
    ['professional_annual', 'professional'],
    ['business', 'business'],
  ])('normalizes %s to canonical code %s', (input, expected) => {
    expect(canonicalPlanCode(input)).toBe(expected);
  });

  test('Pricing Professional Monthly remains professional plus monthly', () => {
    expect(resolveSubscriptionSelection('professional', 'monthly')).toEqual({
      planCode: 'professional',
      billingCycle: 'monthly',
    });
  });

  test('historical monthly purchase intent remains monthly', () => {
    expect(resolveSubscriptionSelection('professional_monthly')).toEqual({
      planCode: 'professional',
      billingCycle: 'monthly',
    });
  });

  test('historical annual purchase intent preserves its cycle', () => {
    expect(resolveSubscriptionSelection('professional_annual')).toEqual({
      planCode: 'professional',
      billingCycle: 'annual',
    });
  });

  test.each(['explorer', 'professional', 'business'])(
    '%s is a purchasable subscription plan',
    (planCode) => expect(isPurchasableSubscriptionPlan(planCode)).toBe(true)
  );

  test.each(['free', 'enterprise', 'unknown'])(
    '%s is not routed to automated subscription checkout',
    (planCode) => expect(isPurchasableSubscriptionPlan(planCode)).toBe(false)
  );
});

describe('subscription correction contracts', () => {
  const root = process.cwd();
  const resumeSource = readFileSync(
    join(root, 'src/app/checkout/resume/CheckoutResumeContent.tsx'),
    'utf8'
  );
  const validationSource = readFileSync(
    join(root, 'src/lib/payments/CommercialValidationService.ts'),
    'utf8'
  );
  const migrationSource = readFileSync(
    join(root, 'supabase/migrations/20260720180000_normalize_subscription_plan_codes.sql'),
    'utf8'
  );

  test('checkout resume sends only canonical plan code and separate cycle', () => {
    expect(resumeSource).toContain('resolveSubscriptionSelection');
    expect(resumeSource).toContain('planCode: subscriptionSelection?.planCode');
    expect(resumeSource).toContain('billingCycle: cycle');
    expect(resumeSource).not.toContain('dodoProductId');
  });

  test('catalog lookup retains explicit legacy compatibility and reports query errors', () => {
    expect(validationSource).toContain('`${canonicalCode}_monthly`');
    expect(validationSource).toContain('`${canonicalCode}_annual`');
    expect(validationSource).toContain('subscription catalog lookup failed');
  });

  test('migration normalizes all paid plans without changing Dodo Product IDs', () => {
    for (const code of ['explorer', 'professional', 'business']) {
      expect(migrationSource).toContain(`('${code}', '${code}_monthly')`);
    }
    expect(migrationSource).toContain('six active Dodo TEST mappings are required');
    expect(migrationSource).not.toMatch(/UPDATE public\.payment_product_mappings/i);
    expect(migrationSource).not.toMatch(/pdt_[A-Za-z0-9]+/);
  });
});
