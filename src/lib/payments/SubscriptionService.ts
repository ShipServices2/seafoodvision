// ============================================================
// SEAFOOD VISION — SubscriptionService
// Manages subscription lifecycle: status, cancellation, renewal.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { DodoPaymentsProvider } from './dodo/DodoPaymentsProvider';

const provider = new DodoPaymentsProvider();

export interface UserSubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  planCode?: string;
  planName?: string;
  externalSubscriptionId?: string;
  status: string;
  billingCycle: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  createdAt: string;
}

/**
 * Get the active subscription for a user.
 * Returns null if no active subscription exists.
 */
export async function getActiveSubscription(
  userId: string
): Promise<UserSubscriptionRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      id, user_id, plan_id, external_subscription_id, status,
      billing_cycle, current_period_start, current_period_end,
      cancel_at_period_end, cancelled_at, created_at,
      pricing_plans (plan_code, name)
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const plan = data.pricing_plans as { plan_code?: string; name?: string } | null;

  return {
    id: data.id,
    userId: data.user_id,
    planId: data.plan_id,
    planCode: plan?.plan_code,
    planName: plan?.name,
    externalSubscriptionId: data.external_subscription_id ?? undefined,
    status: data.status,
    billingCycle: data.billing_cycle,
    currentPeriodStart: data.current_period_start ?? undefined,
    currentPeriodEnd: data.current_period_end ?? undefined,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    cancelledAt: data.cancelled_at ?? undefined,
    createdAt: data.created_at,
  };
}

/**
 * Cancel a subscription at period end.
 * Calls the provider stub (TODO) and updates local state.
 */
export async function cancelSubscriptionAtPeriodEnd(
  userId: string,
  subscriptionId: string
): Promise<void> {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('id, external_subscription_id, status')
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .single();

  if (!sub) throw new Error('Subscription not found');
  if (sub.status === 'cancelled') throw new Error('Subscription already cancelled');

  const config = provider.getConfig();
  if (config.isEnabled && config.isConfigured && sub.external_subscription_id) {
    // TODO: Will call provider.cancelSubscription when Dodo is integrated
    // await provider.cancelSubscription({ externalSubscriptionId: sub.external_subscription_id, cancelAtPeriodEnd: true });
  }

  await supabase
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  await supabase.from('subscription_events').insert({
    subscription_id: subscriptionId,
    user_id: userId,
    event_type: 'cancellation_scheduled',
    from_status: sub.status,
    to_status: sub.status,
  });
}

/**
 * Get subscription history for a user.
 */
export async function getSubscriptionHistory(userId: string): Promise<UserSubscriptionRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      id, user_id, plan_id, external_subscription_id, status,
      billing_cycle, current_period_start, current_period_end,
      cancel_at_period_end, cancelled_at, created_at,
      pricing_plans (plan_code, name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const plan = row.pricing_plans as { plan_code?: string; name?: string } | null;
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      planCode: plan?.plan_code,
      planName: plan?.name,
      externalSubscriptionId: row.external_subscription_id ?? undefined,
      status: row.status,
      billingCycle: row.billing_cycle,
      currentPeriodStart: row.current_period_start ?? undefined,
      currentPeriodEnd: row.current_period_end ?? undefined,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      cancelledAt: row.cancelled_at ?? undefined,
      createdAt: row.created_at,
    };
  });
}
