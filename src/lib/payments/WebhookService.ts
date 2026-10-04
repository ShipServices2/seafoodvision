// ============================================================
// SEAFOOD VISION — WebhookService
// Processes verified Dodo Payments webhook events.
// Idempotent — duplicate events are safely ignored.
// NEVER grants entitlements without server-side verification.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import type { WebhookEvent } from './types';

type CommerceClient = ReturnType<typeof createServiceClient>;
interface CommerceOrder {
  id: string;
  user_id: string;
  total_amount: number;
  currency: string;
  status: string;
  order_type: string;
  metadata: Record<string, unknown> | null;
}

export function isWebhookEventDuplicate(processingStatus: string): boolean {
  return ['processed', 'processing', 'ignored_duplicate'].includes(processingStatus);
}

/**
 * Record a received webhook event and check for duplicates.
 * Returns { isDuplicate: true } if already processed.
 */
export async function recordWebhookEvent(
  event: WebhookEvent,
  rawBody: string
): Promise<{ isDuplicate: boolean; webhookEventId?: string }> {
  const supabase = createServiceClient();
  const payloadHash = createHash('sha256').update(rawBody).digest('hex');

  // Check for existing event (idempotency)
  const { data: existing } = await supabase
    .from('payment_webhook_events')
    .select('id, processing_status')
    .eq('external_event_id', event.externalEventId)
    .maybeSingle();

  if (existing) {
    // Processed and in-flight events are duplicates. Failed/received events are
    // deliberately retried using the same durable event row.
    const isDuplicate = isWebhookEventDuplicate(existing.processing_status);
    return { isDuplicate, webhookEventId: existing.id };
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
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();

  // Dodo Payments wraps event data in a `data` field
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalPaymentId = String(data['payment_id'] ?? data['id'] ?? '');
  const externalCheckoutId = String(
    data['checkout_session_id'] ?? data['checkout_id'] ?? data['session_id'] ?? ''
  );
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  if (!externalPaymentId) {
    throw new Error('handlePaymentSucceeded: payment_id is required for exact-once fulfillment');
  }

  // Find order by internal order_id from metadata (most reliable)
  // Fall back to external_checkout_id
  let order: CommerceOrder | null = null;
  if (orderId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, currency, status, order_type, metadata')
      .eq('id', orderId)
      .maybeSingle();
    order = o as CommerceOrder | null;
  }
  if (!order && externalCheckoutId) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, currency, status, order_type, metadata')
      .eq('external_checkout_id', externalCheckoutId)
      .maybeSingle();
    order = o as CommerceOrder | null;
  }

  if (!order) {
    throw new Error(`handlePaymentSucceeded: order not found. orderId=${orderId}, checkoutId=${externalCheckoutId}`);
  }

  const transactionValues = {
    order_id: order.id,
    user_id: order.user_id,
    provider: 'dodo_payments',
    external_payment_id: externalPaymentId,
    amount: Number(order.total_amount),
    currency: order.currency,
    status: 'succeeded',
    payment_type:
      order.order_type === 'subscription' ?'subscription'
        : order.order_type === 'credit_pack' ?'credit_pack' :'one_time',
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as 'test' | 'production',
    raw_status: String(data['status'] ?? 'succeeded'),
    succeeded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: existingTransaction } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('provider', 'dodo_payments')
    .eq('environment', transactionValues.environment)
    .eq('external_payment_id', externalPaymentId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let transactionId = existingTransaction?.id;
  if (transactionId) {
    const { error } = await supabase
      .from('payment_transactions')
      .update(transactionValues)
      .eq('id', transactionId);
    if (error) throw new Error(`Failed to update payment transaction: ${error.message}`);
  } else {
    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .insert(transactionValues)
      .select('id')
      .single();
    if (error?.code === '23505') {
      const { data: winner } = await supabase
        .from('payment_transactions')
        .select('id')
        .eq('provider', 'dodo_payments')
        .eq('environment', transactionValues.environment)
        .eq('external_payment_id', externalPaymentId)
        .single();
      if (!winner) throw new Error('Concurrent payment transaction could not be recovered');
      transactionId = winner.id;
    } else if (error || !transaction) {
      throw new Error(`Failed to create payment transaction: ${error?.message}`);
    } else {
      transactionId = transaction.id;
    }
  }

  const { data: fulfillmentItems, error: fulfillmentItemsError } = await supabase
    .from('order_items')
    .select('item_type')
    .eq('order_id', order.id);
  if (fulfillmentItemsError) throw new Error(`Failed to load fulfillment lines: ${fulfillmentItemsError.message}`);
  const itemTypes = new Set((fulfillmentItems ?? []).map((item) => item.item_type));
  if (itemTypes.has('asset_license')) await fulfillAssetLicenseOrder(supabase, order, transactionId);
  if (itemTypes.has('credit_pack')) await fulfillCreditPackOrder(supabase, order, transactionId);
  const unsupported = [...itemTypes].filter((type) => !['asset_license', 'credit_pack'].includes(type));
  if (unsupported.length) throw new Error(`Unsupported fulfillment line types: ${unsupported.join(', ')}`);

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      external_payment_id: externalPaymentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (orderUpdateError) {
    throw new Error(`Failed to mark order paid: ${orderUpdateError.message}`);
  }

  return { orderId: order.id };
}

async function fulfillAssetLicenseOrder(
  supabase: CommerceClient,
  order: { id: string; user_id: string },
  transactionId: string
): Promise<void> {
  const { data: items, error: itemError } = await supabase
    .from('order_items')
    .select('id, asset_id, license_type_id, internal_product_id')
    .eq('order_id', order.id)
    .eq('item_type', 'asset_license');
  if (itemError || !items?.length) {
    throw new Error(`Asset license order item is incomplete: ${itemError?.message ?? order.id}`);
  }

  for (const item of items) {
    if (!item.asset_id || !item.license_type_id || !item.internal_product_id) {
      throw new Error(`Asset license order item is incomplete: ${item.id}`);
    }
    const [licenseTypeResult, productResult] = await Promise.all([
      supabase.from('license_types').select('terms_version').eq('id', item.license_type_id).single(),
      supabase.from('unit_products').select('resolution_allowed, download_quota').eq('id', item.internal_product_id).single(),
    ]);
    const licenseType = licenseTypeResult.data;
    const product = productResult.data;
    const licenseValues = {
      user_id: order.user_id,
      asset_id: item.asset_id,
      order_id: order.id,
      order_item_id: item.id,
      transaction_id: transactionId,
      license_type_id: item.license_type_id,
      terms_version: licenseType?.terms_version ?? '1.0',
      status: 'active',
      metadata: { unitProductId: item.internal_product_id, resolutionAllowed: product?.resolution_allowed ?? 'hd' },
      updated_at: new Date().toISOString(),
    };
    let licenseResult = await supabase.from('purchased_licenses')
      .upsert(licenseValues, { onConflict: 'order_item_id' }).select('id').single();
    // Backward-compatible until the Sprint 2 migration is applied remotely.
    if (licenseResult.error?.code === '42703' || licenseResult.error?.code === '42P10') {
      const { order_item_id: _orderItemId, ...legacyValues } = licenseValues;
      licenseResult = await supabase.from('purchased_licenses')
        .upsert(legacyValues, { onConflict: 'user_id,asset_id,license_type_id,order_id' }).select('id').single();
    }
    const purchasedLicense = licenseResult.data;
    if (licenseResult.error || !purchasedLicense) {
      throw new Error(`Failed to create purchased license for line ${item.id}: ${licenseResult.error?.message}`);
    }

    const resolution = product?.resolution_allowed ?? 'hd';
    const entitlementValues = {
      user_id: order.user_id,
      asset_id: item.asset_id,
      purchased_license_id: purchasedLicense.id,
      order_id: order.id,
      entitlement_type: 'purchased_license',
      status: 'active',
      resolution_allowed: resolution,
      allowed_resolution: resolution,
      max_downloads: Math.max(1, Number(product?.download_quota ?? 1)),
      updated_at: new Date().toISOString(),
    };
    const { data: existingEntitlement } = await supabase.from('download_entitlements')
      .select('id').eq('purchased_license_id', purchasedLicense.id).limit(1).maybeSingle();
    if (existingEntitlement) {
      const { error } = await supabase.from('download_entitlements').update(entitlementValues).eq('id', existingEntitlement.id);
      if (error) throw new Error(`Failed to update download entitlement: ${error.message}`);
    } else {
      const { error } = await supabase.from('download_entitlements').insert({
        ...entitlementValues, download_count: 0, downloads_used: 0,
      });
      if (error?.code === '23505') {
        const { error: retryUpdateError } = await supabase.from('download_entitlements')
          .update(entitlementValues).eq('purchased_license_id', purchasedLicense.id);
        if (retryUpdateError) throw new Error(`Failed to recover concurrent download entitlement: ${retryUpdateError.message}`);
      } else if (error) {
        throw new Error(`Failed to create download entitlement: ${error.message}`);
      }
    }
  }
}

async function fulfillCreditPackOrder(
  supabase: CommerceClient,
  order: { id: string; user_id: string; metadata: Record<string, unknown> | null },
  transactionId: string
): Promise<void> {
  const { data: existingEntry } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('order_id', order.id)
    .eq('movement_type', 'purchase')
    .limit(1)
    .maybeSingle();
  if (existingEntry) return;

  const { data: items, error: itemsError } = await supabase.from('order_items')
    .select('internal_product_id, quantity').eq('order_id', order.id).eq('item_type', 'credit_pack');
  if (itemsError) throw new Error(`Failed to load credit pack lines: ${itemsError.message}`);
  let credits = 0;
  for (const item of items ?? []) {
    const { data: pack, error: packError } = await supabase.from('credit_packs')
      .select('credits').eq('id', item.internal_product_id).single();
    if (packError || !pack) throw new Error(`Credit pack line is incomplete: ${packError?.message ?? order.id}`);
    credits += Number(pack.credits) * Number(item.quantity);
  }
  if (!credits && items?.length === 0) credits = Number(order.metadata?.credits ?? 0);
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error(`Credit pack order has invalid credit amount: ${order.id}`);
  }
  const { error } = await supabase.rpc('apply_credit_purchase', {
    p_user_id: order.user_id,
    p_order_id: order.id,
    p_transaction_id: transactionId,
    p_credits: credits,
    p_reason: 'Credit pack purchase',
  });
  if (error) throw new Error(`Failed to credit user account: ${error.message}`);
}

/**
 * Handle a successful credit pack purchase.
 * Inserts a credit_ledger entry. Never credits twice (idempotent via order status).
 */
export async function handleCreditPurchaseSucceeded(
  payload: Record<string, unknown>
): Promise<{ orderId?: string }> {
  return handlePaymentSucceeded(payload);
}

/**
 * Handle subscription activated/renewed event.
 * Creates or updates user_subscription row.
 */
export async function handleSubscriptionActivated(
  payload: Record<string, unknown>
): Promise<{ subscriptionId?: string }> {
  const supabase = createServiceClient();

  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalSubscriptionId = String(data['subscription_id'] ?? data['id'] ?? '');
  const externalCheckoutId = String(
    data['checkout_session_id'] ?? data['checkout_id'] ?? data['session_id'] ?? ''
  );
  const metadata = (data['metadata'] ?? {}) as Record<string, string>;
  const orderId = metadata['order_id'] ?? '';

  if (!externalSubscriptionId) {
    throw new Error('handleSubscriptionActivated: missing subscription_id in payload');
  }

  // Find order by internal order_id from metadata first
  let order: Pick<CommerceOrder, 'id' | 'user_id' | 'metadata'> | null = null;
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

  if (!plan) {
    throw new Error(`handleSubscriptionActivated: pricing plan not found for ${planCode || 'missing plan code'}`);
  }

  const periodStart = String(
    data['previous_billing_date'] ?? data['current_period_start'] ?? new Date().toISOString()
  );
  const periodEnd = data['next_billing_date'] ?? data['current_period_end']
    ? String(data['next_billing_date'] ?? data['current_period_end'])
    : null;

  const subscriptionValues = {
    user_id: order.user_id,
    plan_id: plan.id,
    order_id: order.id,
    external_subscription_id: externalSubscriptionId,
    status: 'active',
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as 'test' | 'production',
    billing_cycle: ((order.metadata as Record<string, unknown>)?.billingCycle as string) ?? 'monthly',
    current_period_start: periodStart,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };
  const { data: existingSubscription } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('environment', subscriptionValues.environment)
    .eq('external_subscription_id', externalSubscriptionId)
    .limit(1)
    .maybeSingle();

  const subscriptionResult = existingSubscription
    ? await supabase
        .from('user_subscriptions')
        .update(subscriptionValues)
        .eq('id', existingSubscription.id)
        .select('id')
        .single()
    : await supabase
        .from('user_subscriptions')
        .insert(subscriptionValues)
        .select('id')
        .single();
  let { data: sub, error: subscriptionError } = subscriptionResult;

  if (subscriptionError?.code === '23505') {
    const winner = await supabase
      .from('user_subscriptions')
      .update(subscriptionValues)
      .eq('environment', subscriptionValues.environment)
      .eq('external_subscription_id', externalSubscriptionId)
      .select('id')
      .single();
    sub = winner.data;
    subscriptionError = winner.error;
  }

  if (subscriptionError || !sub) {
    throw new Error(`Failed to activate subscription: ${subscriptionError?.message}`);
  }

  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: sub.id,
    user_id: order.user_id,
    event_type: 'activated',
    to_status: 'active',
    to_plan_id: plan.id,
    external_event_id: externalSubscriptionId,
  });
  if (eventError) throw new Error(`Failed to record subscription event: ${eventError.message}`);

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', order.id);
  if (orderUpdateError) throw new Error(`Failed to mark subscription order paid: ${orderUpdateError.message}`);

  return { subscriptionId: sub.id };
}

/** Synchronize non-activation subscription lifecycle events from Dodo. */
export async function handleSubscriptionStatusChanged(
  payload: Record<string, unknown>,
  eventType: string
): Promise<{ subscriptionId?: string }> {
  const supabase = createServiceClient();
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalSubscriptionId = String(data['subscription_id'] ?? data['id'] ?? '');
  if (!externalSubscriptionId) {
    throw new Error('Subscription lifecycle event is missing subscription_id');
  }

  const statusMap: Record<string, string> = {
    active: 'active',
    pending: 'pending',
    on_hold: 'past_due',
    failed: 'past_due',
    cancelled: 'cancelled',
    expired: 'expired',
  };
  const providerStatus = String(data['status'] ?? eventType.split('.')[1] ?? 'pending');
  const localStatus = statusMap[providerStatus] ?? 'pending';
  const now = new Date().toISOString();
  const changes: Record<string, unknown> = {
    status: localStatus,
    cancel_at_period_end: Boolean(data['cancel_at_next_billing_date']),
    current_period_start: data['previous_billing_date'] ?? null,
    current_period_end: data['next_billing_date'] ?? null,
    updated_at: now,
  };
  if (localStatus === 'cancelled') changes.cancelled_at = String(data['cancelled_at'] ?? now);

  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .update(changes)
    .eq('external_subscription_id', externalSubscriptionId)
    .select('id, user_id, status')
    .maybeSingle();
  if (error || !subscription) {
    throw new Error(`Subscription not found or update failed: ${error?.message ?? externalSubscriptionId}`);
  }

  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: subscription.id,
    user_id: subscription.user_id,
    event_type: eventType,
    to_status: localStatus,
    external_event_id: externalSubscriptionId,
  });
  if (eventError) throw new Error(`Failed to record subscription lifecycle event: ${eventError.message}`);

  return { subscriptionId: subscription.id };
}

/**
 * Handle payment failed event.
 * Updates transaction and order status. No entitlements created.
 */
export async function handlePaymentFailed(
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalCheckoutId = String(
    data['checkout_session_id'] ?? data['checkout_id'] ?? data['session_id'] ?? ''
  );
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

function amountFromMinorUnits(amount: number, currency: string): number {
  const zeroDecimalCurrencies = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
  return zeroDecimalCurrencies.has(currency) ? amount : amount / 100;
}

/** Persist the existing administrative refund records and revoke on full refund. */
export async function handleRefundIssued(
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  const data = (payload['data'] ?? payload) as Record<string, unknown>;
  const externalPaymentId = String(data['payment_id'] ?? '');
  const externalRefundId = String(data['refund_id'] ?? data['id'] ?? '');

  if (!externalPaymentId || !externalRefundId) {
    throw new Error('Refund payload is missing payment_id or refund_id');
  }

  const { data: transaction, error: transactionError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'dodo_payments')
    .eq('environment', (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as 'test' | 'production')
    .eq('external_payment_id', externalPaymentId)
    .select('id, order_id, user_id, currency, amount')
    .maybeSingle();

  if (transactionError) {
    throw new Error(`Failed to record refund: ${transactionError.message}`);
  }
  if (!transaction?.order_id) {
    throw new Error(`Refund payment transaction not found: ${externalPaymentId}`);
  }

  const refundedAt = new Date().toISOString();
  const isPartial = data['is_partial'] === true;
  const currency = String(data['currency'] ?? transaction.currency ?? 'EUR').toUpperCase();
  const rawAmount = Number(data['amount']);
  const refundAmount = Number.isFinite(rawAmount) && rawAmount > 0
    ? amountFromMinorUnits(rawAmount, currency)
    : Number(transaction.amount);
  const reason = typeof data['reason'] === 'string' && data['reason'].trim()
    ? data['reason'].trim()
    : 'not_provided';

  const refundValues = {
    order_id: transaction.order_id,
    user_id: transaction.user_id,
    transaction_id: transaction.id,
    status: 'completed',
    reason,
    amount: refundAmount,
    currency,
    is_partial: isPartial,
    revoke_licenses: !isPartial,
    revoke_entitlements: !isPartial,
    external_refund_id: externalRefundId,
    processed_at: refundedAt,
    completed_at: refundedAt,
    updated_at: refundedAt,
  };
  const { data: existingRefund } = await supabase
    .from('refunds')
    .select('id')
    .eq('external_refund_id', externalRefundId)
    .maybeSingle();
  let refundId = existingRefund?.id;
  if (refundId) {
    const { error } = await supabase.from('refunds').update(refundValues).eq('id', refundId);
    if (error) throw new Error(`Failed to update administrative refund: ${error.message}`);
  } else {
    const inserted = await supabase.from('refunds').insert(refundValues).select('id').single();
    if (inserted.error?.code === '23505') {
      const winner = await supabase.from('refunds').select('id').eq('external_refund_id', externalRefundId).single();
      refundId = winner.data?.id;
    } else if (inserted.error || !inserted.data) {
      throw new Error(`Failed to create administrative refund: ${inserted.error?.message}`);
    } else {
      refundId = inserted.data.id;
    }
  }
  if (!refundId) throw new Error('Concurrent refund could not be recovered');

  const { count: existingItemCount } = await supabase
    .from('refund_items')
    .select('id', { count: 'exact', head: true })
    .eq('refund_id', refundId);
  if (!existingItemCount) {
    const metadata = (data['metadata'] ?? {}) as Record<string, unknown>;
    const requestedOrderItemId = typeof metadata['order_item_id'] === 'string'
      ? metadata['order_item_id']
      : null;
    let refundItems: Array<Record<string, unknown>> = [];
    if (requestedOrderItemId) {
      const { data: item } = await supabase
        .from('order_items')
        .select('id, item_type, asset_id, internal_product_id')
        .eq('id', requestedOrderItemId)
        .eq('order_id', transaction.order_id)
        .maybeSingle();
      if (item) {
        refundItems = [{
          refund_id: refundId,
          order_item_id: item.id,
          item_type: item.item_type,
          item_id: item.asset_id ?? item.internal_product_id,
          amount: refundAmount,
        }];
      }
    } else if (!isPartial) {
      const { data: items } = await supabase
        .from('order_items')
        .select('id, item_type, asset_id, internal_product_id, total_price')
        .eq('order_id', transaction.order_id)
        .order('created_at', { ascending: true });
      const total = (items ?? []).reduce((sum, item) => sum + Number(item.total_price), 0);
      let allocated = 0;
      refundItems = total > 0 ? (items ?? []).map((item, index, all) => {
        const amount = index === all.length - 1
          ? Number((refundAmount - allocated).toFixed(2))
          : Number((refundAmount * (Number(item.total_price) / total)).toFixed(2));
        allocated += amount;
        return {
          refund_id: refundId,
          order_item_id: item.id,
          item_type: item.item_type,
          item_id: item.asset_id ?? item.internal_product_id,
          amount,
        };
      }) : [];
    }
    if (refundItems.length === 0) {
      refundItems = [{
        refund_id: refundId,
        order_item_id: null,
        item_type: 'order',
        item_id: transaction.order_id,
        amount: refundAmount,
        notes: 'Dodo payload did not identify a specific order item',
      }];
    }
    const { error } = await supabase.from('refund_items').insert(refundItems);
    if (error && error.code !== '23505') throw new Error(`Failed to create refund items: ${error.message}`);
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: isPartial ? 'partially_refunded' : 'refunded',
      updated_at: refundedAt,
    })
    .eq('id', transaction.order_id);
  if (orderError) throw new Error(`Failed to update refunded order: ${orderError.message}`);

  if (!isPartial) {
    const { error: licenseError } = await supabase
      .from('purchased_licenses')
      .update({
        status: 'revoked',
        revoked_at: refundedAt,
        revocation_reason: 'payment_refunded',
        updated_at: refundedAt,
      })
      .eq('order_id', transaction.order_id);
    if (licenseError) throw new Error(`Failed to revoke purchased license: ${licenseError.message}`);

    const { error: entitlementError } = await supabase
      .from('download_entitlements')
      .update({
        status: 'revoked',
        revoked_at: refundedAt,
        revoked_reason: 'payment_refunded',
        updated_at: refundedAt,
      })
      .eq('order_id', transaction.order_id);
    if (entitlementError) throw new Error(`Failed to revoke download entitlement: ${entitlementError.message}`);
  }
}
