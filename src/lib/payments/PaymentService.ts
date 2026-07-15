// ============================================================
// SEAFOOD VISION — PaymentService
// Orchestrates order creation and payment verification.
// All provider calls go through PaymentProvider interface.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import type { CreateOrderParams, OrderRecord } from './types';

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
  const supabase = await createClient();

  const subtotal = params.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

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
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test',
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create order: ${error?.message}`);
  }

  // Insert order items
  if (params.items.length > 0) {
    const items = params.items.map((item) => ({
      order_id: data.id,
      item_type: item.itemType,
      internal_product_id: item.internalProductId ?? null,
      asset_id: item.assetId ?? null,
      license_type_id: item.licenseTypeId ?? null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(items);
    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }
  }

  return {
    id: data.id,
    orderNumber: data.order_number,
    userId: data.user_id,
    orderType: data.order_type,
    currency: data.currency,
    subtotal: Number(data.subtotal),
    discountAmount: Number(data.discount_amount),
    taxAmount: Number(data.tax_amount),
    totalAmount: Number(data.total_amount),
    status: data.status,
    externalCheckoutId: data.external_checkout_id ?? undefined,
    externalPaymentId: data.external_payment_id ?? undefined,
    environment: data.environment,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    paidAt: data.paid_at ?? undefined,
    cancelledAt: data.cancelled_at ?? undefined,
  };
}

/**
 * Update order status and external IDs after checkout creation.
 */
export async function updateOrderCheckoutRef(
  orderId: string,
  externalCheckoutId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'pending',
      external_checkout_id: externalCheckoutId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw new Error(`Failed to update order checkout ref: ${error.message}`);
}

/**
 * Get order by ID for the authenticated user.
 */
export async function getOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    userId: data.user_id,
    orderType: data.order_type,
    currency: data.currency,
    subtotal: Number(data.subtotal),
    discountAmount: Number(data.discount_amount),
    taxAmount: Number(data.tax_amount),
    totalAmount: Number(data.total_amount),
    status: data.status,
    externalCheckoutId: data.external_checkout_id ?? undefined,
    externalPaymentId: data.external_payment_id ?? undefined,
    environment: data.environment,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    paidAt: data.paid_at ?? undefined,
    cancelledAt: data.cancelled_at ?? undefined,
  };
}
