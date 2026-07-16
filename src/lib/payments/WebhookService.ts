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
  // Fetch current retry count first to avoid RPC dependency
  const { data: existing } = await supabase
    .from('payment_webhook_events')
    .select('retry_count')
    .eq('id', webhookEventId)
    .maybeSingle();

  await supabase
    .from('payment_webhook_events')
    .update({
      processing_status: 'failed',
      error_message: errorMessage,
      retry_count: (existing?.retry_count ?? 0) + 1,
    })
    .eq('id', webhookEventId);
}

// ─── Event Handlers ──────────────────────────────────────────

/**
 * Handle a successful one-time payment.
 * Updates order → paid, transaction → succeeded.
 * Dodo Payments payload structure: { type, data: { payment_id, checkout_id, ... } }
 */
export async function handlePaymentSucceeded(
  payload: Record<string, unknown>
): Promise<{ orderId?: string }> {
  const supabase = await createClient();

  // Dodo Payments wraps event data in a `data` field
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalPaymentId = String(data['payment_id'] ?? data['id'] ?? '');
  const externalCheckoutId = String(data['checkout_id'] ?? data['session_id'] ?? '');
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  // Find order by internal order_id from metadata (most reliable)
  // Fall back to external_checkout_id
  let order = null;
  if (orderId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, currency, status')
      .eq('id', orderId)
      .maybeSingle();
    order = o;
  }
  if (!order && externalCheckoutId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, currency, status')
      .eq('external_checkout_id', externalCheckoutId)
      .maybeSingle();
    order = o;
  }

  if (!order) {
    throw new Error(`handlePaymentSucceeded: order not found. orderId=${orderId}, checkoutId=${externalCheckoutId}`);
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
      external_payment_id: externalPaymentId || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Upsert payment transaction
  await supabase.from('payment_transactions').upsert(
    {
      order_id: order.id,
      user_id: order.user_id,
      provider: 'dodo_payments',
      external_payment_id: externalPaymentId || null,
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

  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalCheckoutId = String(data['checkout_id'] ?? data['session_id'] ?? '');
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  let order = null;
  if (orderId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, status, metadata')
      .eq('id', orderId)
      .eq('order_type', 'credit_pack')
      .maybeSingle();
    order = o;
  }
  if (!order && externalCheckoutId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, status, metadata')
      .eq('external_checkout_id', externalCheckoutId)
      .eq('order_type', 'credit_pack')
      .maybeSingle();
    order = o;
  }

  if (!order) {
    throw new Error(`handleCreditPurchaseSucceeded: order not found. orderId=${orderId}`);
  }

  if (order.status === 'paid') {
    return { orderId: order.id };
  }

  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', order.id);

  const { data: lastEntry } = await supabase
    .from('credit_ledger')
    .select('balance_after')
    .eq('user_id', order.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const balanceBefore = lastEntry?.balance_after ?? 0;
  const credits = (order.metadata as Record<string, unknown>)?.credits as number ?? 0;

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

  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalSubscriptionId = String(data['subscription_id'] ?? data['id'] ?? '');
  const externalCheckoutId = String(data['checkout_id'] ?? data['session_id'] ?? '');
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  if (!externalSubscriptionId) {
    throw new Error('handleSubscriptionActivated: missing subscription_id in payload');
  }

  // Find order by internal order_id from metadata first
  let order = null;
  if (orderId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, metadata')
      .eq('id', orderId)
      .maybeSingle();
    order = o;
  }
  if (!order && externalCheckoutId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, metadata')
      .eq('external_checkout_id', externalCheckoutId)
      .maybeSingle();
    order = o;
  }

  if (!order) {
    throw new Error(`handleSubscriptionActivated: order not found. orderId=${orderId}`);
  }

  const planCode = (order.metadata as Record<string, unknown>)?.planCode as string;
  const { data: plan } = await supabase
    .from('pricing_plans')
    .select('id')
    .eq('plan_code', planCode)
    .maybeSingle();

  const periodStart = data['current_period_start'] ? String(data['current_period_start']) : new Date().toISOString();
  const periodEnd = data['current_period_end'] ? String(data['current_period_end']) : null;

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
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'external_subscription_id' }
    )
    .select('id')
    .single();

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
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalCheckoutId = String(data['checkout_id'] ?? data['session_id'] ?? '');
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  if (orderId) {
    await supabase
      .from('orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', orderId);
  } else if (externalCheckoutId) {
    await supabase
      .from('orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('external_checkout_id', externalCheckoutId);
  }
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
