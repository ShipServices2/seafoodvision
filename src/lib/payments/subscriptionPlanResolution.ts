export type SubscriptionBillingCycle = 'monthly' | 'annual';

export const PURCHASABLE_SUBSCRIPTION_PLAN_CODES = [
  'explorer',
  'professional',
  'business',
] as const;

export type PurchasableSubscriptionPlanCode =
  (typeof PURCHASABLE_SUBSCRIPTION_PLAN_CODES)[number];

const CYCLE_SUFFIX = /[-_](monthly|annual)$/i;

export function canonicalPlanCode(planCode: string): string {
  return planCode.trim().toLowerCase().replace(CYCLE_SUFFIX, '');
}

export function resolveSubscriptionSelection(
  rawPlanCode: string,
  rawBillingCycle?: string | null
): { planCode: string; billingCycle: SubscriptionBillingCycle } {
  const suffixCycle = rawPlanCode.trim().toLowerCase().match(CYCLE_SUFFIX)?.[1];
  const billingCycle: SubscriptionBillingCycle =
    rawBillingCycle === 'annual' || rawBillingCycle === 'monthly'
      ? rawBillingCycle
      : suffixCycle === 'annual' ?'annual' :'monthly';

  return {
    planCode: canonicalPlanCode(rawPlanCode),
    billingCycle,
  };
}

export function isPurchasableSubscriptionPlan(
  planCode: string
): planCode is PurchasableSubscriptionPlanCode {
  return (PURCHASABLE_SUBSCRIPTION_PLAN_CODES as readonly string[]).includes(planCode);
}
