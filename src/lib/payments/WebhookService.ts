// ============================================================
// SEAFOOD VISION — WebhookService
// Processes verified Dodo Payments webhook events.
// Idempotent — duplicate events are safely ignored.
// NEVER grants entitlements without server-side verification.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import type { WebhookEvent } from './types';

/**
 * Record a received webhook event and check for duplicates.
 * Returns { isDuplicate: true } if already processed.
 */
export async function recordWebhookEvent(
  event: WebhookEvent,
  rawBody: string
): Promise<{ isDuplicate: boolean; webhookEventId?: string }> {
  const supabase = await createClient();
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');

  // Check for existing event (idempotency)
  const { data: existing } = await supabase
    .from('payment_webhook_events')
    .select('id, processing_status')
    .eq('external_event_id', event.externalEventId)
    .maybeSingle();

  if (existing) {
    // Mark as duplicate if already processed
    if (existing.processing_status === 'processed') {
      await supabase
        .from('payment_webhook_events')
        .update({ processing_status: 'ignored_duplicate' })
        .eq('id', existing.id);
    }
    return { isDuplicate: true, webhookEventId: existing.id };
  }

  // Insert new event record
  const { data: inserted, error } = await supabase
    .from('payment_webhook_events')
    .insert({
      external_event_id: event.externalEventId,
      event_type: event.eventType,
      payload_hash: payloadHash,
      environment: event.environment,
      processing_status: 'received',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to record webhook event: ${error?.message}`);
  }

  return { isDuplicate: false, webhookEventId: inserted.id };
}

/**
 * Mark a webhook event as processing.
 */
export async function markWebhookProcessing(webhookEventId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('payment_webhook_events')
    .update({ processing_status: 'processing' })
    .eq('id', webhookEventId);
}

/**
 * Mark a webhook event as processed.
 */
export async function markWebhookProcessed(
  webhookEventId: string,
  relatedOrderId?: string,
  relatedSubscriptionId?: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('payment_webhook_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
      related_order_id: relatedOrderId ?? null,
      related_subscription_id: relatedSubscriptionId ?? null,
    })
    .eq('id', webhookEventId);
}

/**
 * Mark a webhook event as failed.
 */
export async function markWebhookFailed(
  webhookEventId: string,
  errorMessage: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('payment_webhook_events')
    .update({
      processing_status: 'failed',
      error_message: errorMessage,
      retry_count: supabase.rpc('increment_retry_count', { event_id: webhookEventId }),
    })
    .eq('id', webhookEventId);
}

// ─── Event Handlers ──────────────────────────────────────────

/**
 * Handle a successful one-time payment.
 * Updates order → paid, transaction → succeeded.
 * Prepared for future: purchased_license + download_entitlement creation.
 */
export async function handlePaymentSucceeded(
  payload: Record<string, unknown>
): Promise<{ orderId?: string }> {
  const supabase = await createClient();

  // TODO: Extract actual field names from Dodo Payments webhook payload
  // These field names are placeholders — update when Dodo API docs are confirmed
  const externalPaymentId = payload['payment_id'] as string | undefined;
  const externalCheckoutId = payload['checkout_id'] as string | undefined;

  if (!externalPaymentId && !externalCheckoutId) {
    throw new Error('handlePaymentSucceeded: missing payment_id or checkout_id in payload');
  }

  // Find order by external checkout ID
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, currency, status')
    .eq('external_checkout_id', externalCheckoutId ?? '')
    .maybeSingle();

  if (!order) {
    throw new Error(`handlePaymentSucceeded: order not found for checkout ${externalCheckoutId}`);
  }

  if (order.status === 'paid') {
    // Already processed — idempotent
    return { orderId: order.id };
  }

  // Update order to paid
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      external_payment_id: externalPaymentId ?? null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Update or create payment transaction
  await supabase.from('payment_transactions').upsert(
    {
      order_id: order.id,
      user_id: order.user_id,
      provider: 'dodo_payments',
      external_payment_id: externalPaymentId ?? null,
      amount: Number(order.total_amount),
      currency: order.currency,
      status: 'succeeded',
      payment_type: 'one_time',
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as 'test' | 'production',
      succeeded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  );

  // TODO (Phase 7.2 Part 2): Create purchased_license and download_entitlement rows
  // after verifying asset commercial eligibility server-side

  return { orderId: order.id };
}

/**
 * Handle a successful credit pack purchase.
 * Inserts a credit_ledger entry. Never credits twice (idempotent via order status).
 */
export async function handleCreditPurchaseSucceeded(
  payload: Record<string, unknown>
): Promise<{ orderId?: string }> {
  const supabase = await createClient();

  const externalCheckoutId = payload['checkout_id'] as string | undefined;

  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, status, metadata')
    .eq('external_checkout_id', externalCheckoutId ?? '')
    .eq('order_type', 'credit_pack')
    .maybeSingle();

  if (!order) {
    throw new Error(`handleCreditPurchaseSucceeded: order not found for checkout ${externalCheckoutId}`);
  }

  if (order.status === 'paid') {
    // Already credited — idempotent
    return { orderId: order.id };
  }

  // Mark order paid
  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', order.id);

  // Get current balance
  const { data: lastEntry } = await supabase
    .from('credit_ledger')
    .select('balance_after')
    .eq('user_id', order.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const balanceBefore = lastEntry?.balance_after ?? 0;
  const credits = (order.metadata as Record<string, unknown>)?.credits as number ?? 0;

  // Insert credit ledger entry
  await supabase.from('credit_ledger').insert({
    user_id: order.user_id,
    movement_type: 'purchase',
    amount: credits,
    reason: 'Credit pack purchase',
    reference: order.id,
    balance_before: balanceBefore,
    balance_after: balanceBefore + credits,
    order_id: order.id,
  });

  return { orderId: order.id };
}

/**
 * Handle subscription activated/renewed event.
 * Creates or updates user_subscription row.
 */
export async function handleSubscriptionActivated(
  payload: Record<string, unknown>
): Promise<{ subscriptionId?: string }> {
  const supabase = await createClient();

  // TODO: Extract actual field names from Dodo Payments subscription webhook
  const externalSubscriptionId = payload['subscription_id'] as string | undefined;
  const externalCheckoutId = payload['checkout_id'] as string | undefined;

  if (!externalSubscriptionId) {
    throw new Error('handleSubscriptionActivated: missing subscription_id in payload');
  }

  // Find order
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, metadata')
    .eq('external_checkout_id', externalCheckoutId ?? '')
    .maybeSingle();

  if (!order) {
    throw new Error(`handleSubscriptionActivated: order not found for checkout ${externalCheckoutId}`);
  }

  // Find plan
  const planCode = (order.metadata as Record<string, unknown>)?.planCode as string;
  const { data: plan } = await supabase
    .from('pricing_plans')
    .select('id')
    .eq('plan_code', planCode)
    .maybeSingle();

  // Upsert user_subscription
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: order.user_id,
        plan_id: plan?.id ?? null,
        order_id: order.id,
        external_subscription_id: externalSubscriptionId,
        status: 'active',
        environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as 'test' | 'production',
        billing_cycle: ((order.metadata as Record<string, unknown>)?.billingCycle as string) ?? 'monthly',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'external_subscription_id' }
    )
    .select('id')
    .single();

  // Record subscription event
  if (sub) {
    await supabase.from('subscription_events').insert({
      subscription_id: sub.id,
      user_id: order.user_id,
      event_type: 'activated',
      to_status: 'active',
      to_plan_id: plan?.id ?? null,
      external_event_id: externalSubscriptionId,
    });
  }

  // Mark order paid
  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', order.id);

  return { subscriptionId: sub?.id };
}

/**
 * Handle payment failed event.
 * Updates transaction and order status. No entitlements created.
 */
export async function handlePaymentFailed(
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  const externalCheckoutId = payload['checkout_id'] as string | undefined;

  if (!externalCheckoutId) return;

  await supabase
    .from('orders')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('external_checkout_id', externalCheckoutId);
}

/**
 * Handle refund event.
 * Records the event and updates payment status.
 * Full refund workflow (entitlement revocation) is Phase 7.2 Part 2.
 */
export async function handleRefundIssued(
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  const externalPaymentId = payload['payment_id'] as string | undefined;

  if (!externalPaymentId) return;

  await supabase
    .from('payment_transactions')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('external_payment_id', externalPaymentId);

  // TODO (Phase 7.2 Part 2): Revoke purchased_license and download_entitlement
}
