// ============================================================
// SEAFOOD VISION — PaymentService
// Orchestrates order creation and payment verification.
// All provider calls go through PaymentProvider interface.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server';
import type { CreateOrderParams, OrderRecord } from './types';

const DRAFT_REUSE_WINDOW_MS = 10 * 60 * 1000;
const PENDING_REUSE_WINDOW_MS = 2 * 60 * 60 * 1000;

type StoredOrderItem = {
  item_type: string;
  internal_product_id: string | null;
  asset_id: string | null;
  license_type_id: string | null;
  quantity: number;
  unit_price: number | string;
};

function itemSignature(item: StoredOrderItem): string {
  return [
    item.item_type,
    item.internal_product_id ?? '',
    item.asset_id ?? '',
    item.license_type_id ?? '',
    String(item.quantity),
    Number(item.unit_price).toFixed(2),
  ].join('|');
}

export function areOrderItemsEquivalent(
  storedItems: StoredOrderItem[],
  requestedItems: CreateOrderParams['items']
): boolean {
  const stored = storedItems.map(itemSignature).sort();
  const requested = requestedItems.map((item) => itemSignature({
    item_type: item.itemType,
    internal_product_id: item.internalProductId ?? null,
    asset_id: item.assetId ?? null,
    license_type_id: item.licenseTypeId ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  })).sort();
  return stored.length === requested.length && stored.every((value, index) => value === requested[index]);
}

export function isReusableOrderCandidate(
  order: { status: string; created_at: string; external_checkout_id?: string | null; metadata?: Record<string, unknown> | null },
  now = Date.now()
): boolean {
  const age = now - new Date(order.created_at).getTime();
  if (order.status === 'draft') return age >= 0 && age <= DRAFT_REUSE_WINDOW_MS && !order.external_checkout_id;
  if (order.status === 'pending') {
    return age >= 0
      && age <= PENDING_REUSE_WINDOW_MS
      && Boolean(order.external_checkout_id)
      && typeof order.metadata?.checkout_url === 'string';
  }
  return false;
}

/**
 * Generate a unique order number.
 */
function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `SV-${date}-${rand}`;
}

/**
 * Create a local order record in Supabase before initiating checkout.
 * The price is ALWAYS calculated server-side from Supabase data.
 * Never trust prices from the browser.
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderRecord> {
  const supabase = createServiceClient();
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
  const metadata = {
    ...(params.metadata ?? {}),
    ...(params.checkoutKey ? { checkout_key: params.checkoutKey } : {}),
  };

  const subtotal = params.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  if (params.checkoutKey) {
    const { data: candidates } = await supabase
      .from('orders')
      .select('*, order_items(item_type, internal_product_id, asset_id, license_type_id, quantity, unit_price)')
      .eq('user_id', params.userId)
      .eq('environment', environment)
      .eq('order_type', params.orderType)
      .in('status', ['draft', 'pending'])
      .contains('metadata', { checkout_key: params.checkoutKey })
      .order('created_at', { ascending: false });

    for (const candidate of candidates ?? []) {
      const compatible = areOrderItemsEquivalent(
        (candidate.order_items ?? []) as StoredOrderItem[],
        params.items
      );
      if (compatible && isReusableOrderCandidate(candidate)) {
        if (candidate.status === 'draft') {
          const { error: updateError } = await supabase.from('orders').update({
            currency: params.currency,
            subtotal,
            total_amount: subtotal,
            metadata,
            updated_at: new Date().toISOString(),
          }).eq('id', candidate.id).eq('status', 'draft');
          if (updateError) throw new Error(`Failed to refresh draft order: ${updateError.message}`);
          await supabase.from('order_items').delete().eq('order_id', candidate.id);
          await insertOrderItems(supabase, candidate.id, params.items);
        }
        return mapOrderRecord({ ...candidate, metadata }, true);
      }

      // An expired or incompatible active order must not block the exact checkout key.
      const { error: cancelError } = await supabase.from('orders').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', candidate.id).in('status', ['draft', 'pending']);
      if (cancelError) throw new Error(`Failed to retire incompatible draft order: ${cancelError.message}`);
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: params.userId,
      order_number: generateOrderNumber(),
      order_type: params.orderType,
      currency: params.currency,
      subtotal,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: subtotal,
      status: 'draft',
      environment,
      metadata,
    })
    .select()
    .single();

  if (error?.code === '23505' && params.checkoutKey) {
    const { data: winner } = await supabase
      .from('orders')
      .select('*, order_items(item_type, internal_product_id, asset_id, license_type_id, quantity, unit_price)')
      .eq('user_id', params.userId)
      .eq('environment', environment)
      .contains('metadata', { checkout_key: params.checkoutKey })
      .in('status', ['draft', 'pending'])
      .maybeSingle();
    if (winner && areOrderItemsEquivalent((winner.order_items ?? []) as StoredOrderItem[], params.items)) {
      return mapOrderRecord(winner, true);
    }
  }
  if (error || !data) {
    throw new Error(`Failed to create order: ${error?.message}`);
  }

  // Insert order items
  if (params.items.length > 0) {
    try {
      await insertOrderItems(supabase, data.id, params.items);
    } catch (itemsError) {
      // Do not leave an unusable draft behind when the second half of order
      // creation fails. This is safe because no provider checkout exists yet.
      await supabase.from('orders').delete().eq('id', data.id);
      throw itemsError;
    }
  }

  return mapOrderRecord(data, false);
}

async function insertOrderItems(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  items: CreateOrderParams['items']
): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((item) => ({
    order_id: orderId,
    item_type: item.itemType,
    internal_product_id: item.internalProductId ?? null,
    asset_id: item.assetId ?? null,
    license_type_id: item.licenseTypeId ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.unitPrice * item.quantity,
  }));
  const { error } = await supabase.from('order_items').insert(rows);
  if (error) throw new Error(`Failed to create order items: ${error.message}`);
}

function mapOrderRecord(data: Record<string, unknown>, reused: boolean): OrderRecord {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(data.id),
    orderNumber: String(data.order_number),
    userId: String(data.user_id),
    orderType: String(data.order_type),
    currency: String(data.currency),
    subtotal: Number(data.subtotal),
    discountAmount: Number(data.discount_amount),
    taxAmount: Number(data.tax_amount),
    totalAmount: Number(data.total_amount),
    status: String(data.status) as OrderRecord['status'],
    externalCheckoutId: data.external_checkout_id ? String(data.external_checkout_id) : undefined,
    externalPaymentId: data.external_payment_id ? String(data.external_payment_id) : undefined,
    environment: String(data.environment) as OrderRecord['environment'],
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
    paidAt: data.paid_at ? String(data.paid_at) : undefined,
    cancelledAt: data.cancelled_at ? String(data.cancelled_at) : undefined,
    checkoutUrl: typeof metadata.checkout_url === 'string' ? metadata.checkout_url : undefined,
    reused,
  };
}

/**
 * Update order status and external IDs after checkout creation.
 */
export async function updateOrderCheckoutRef(
  orderId: string,
  externalCheckoutId: string,
  checkoutUrl: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data: order } = await supabase.from('orders').select('metadata').eq('id', orderId).single();
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'pending',
      external_checkout_id: externalCheckoutId,
      metadata: { ...((order?.metadata ?? {}) as Record<string, unknown>), checkout_url: checkoutUrl },
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw new Error(`Failed to update order checkout ref: ${error.message}`);
}

/**
 * Get order by ID for the authenticated user.
 */
export async function getOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return mapOrderRecord(data, false);
}
