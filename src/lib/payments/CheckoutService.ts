// ============================================================
// SEAFOOD VISION — CheckoutService
// Server-side checkout orchestration.
// Validates products, creates orders, calls PaymentProvider.
// NEVER trusts prices from the browser.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { DodoPaymentsProvider } from './dodo/DodoPaymentsProvider';
import { getDodoReturnUrl, getDodoCancelUrl } from './dodo/config';
import { createOrder, updateOrderCheckoutRef } from './PaymentService';

const provider = new DodoPaymentsProvider();

// ─── One-Time Asset License Checkout ─────────────────────────

export async function initiateAssetLicenseCheckout(params: {
  userId: string;
  userEmail: string;
  assetId: string;
  licenseTypeCode: string;
  unitProductCode: string;
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const supabase = await createClient();

  // 1. Load unit product server-side (never trust client price)
  const { data: product, error: productError } = await supabase
    .from('unit_products')
    .select('*')
    .eq('product_code', params.unitProductCode)
    .eq('is_active', true)
    .single();

  if (productError || !product) {
    throw new Error('Product not found or inactive');
  }

  // 2. Load license type
  const { data: licenseType, error: licenseError } = await supabase
    .from('license_types')
    .select('*')
    .eq('code', params.licenseTypeCode)
    .eq('is_active', true)
    .single();

  if (licenseError || !licenseType) {
    throw new Error('License type not found or inactive');
  }

  // 3. Verify asset is commercially available
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, public_asset_id, review_status, rights_status, commercial_status, is_public')
    .eq('id', params.assetId)
    .single();

  if (assetError || !asset) {
    throw new Error('Asset not found');
  }

  // TODO: Add full commercial eligibility checks when asset schema is confirmed:
  // - review_status must be 'approved'
  // - rights_status must be 'cleared'
  // - commercial_status must be 'available'
  // - original file must exist in storage

  // 4. Create local order (price from DB, not client)
  const order = await createOrder({
    userId: params.userId,
    orderType: 'asset_license',
    currency: product.currency,
    items: [
      {
        itemType: 'asset_license',
        internalProductId: product.id,
        assetId: params.assetId,
        licenseTypeId: licenseType.id,
        quantity: 1,
        unitPrice: Number(product.price),
      },
    ],
  });

  // 5. Create checkout via provider (stub — will throw until Dodo is integrated)
  const config = provider.getConfig();
  if (!config.isEnabled || !config.isConfigured) {
    // Return a pending order without a real checkout URL in test/disabled mode
    return {
      checkoutUrl: `/checkout/pending?order=${order.id}`,
      orderId: order.id,
    };
  }

  const result = await provider.createCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    amount: order.totalAmount,
    currency: order.currency,
    productName: `${product.name} — ${licenseType.name}`,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}`,
    metadata: { orderId: order.id, assetId: params.assetId },
  });

  await updateOrderCheckoutRef(order.id, result.externalCheckoutId);

  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}

// ─── Subscription Checkout ────────────────────────────────────

export async function initiateSubscriptionCheckout(params: {
  userId: string;
  userEmail: string;
  planCode: string;
  billingCycle: 'monthly' | 'annual';
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const supabase = await createClient();

  // 1. Load plan server-side
  const { data: plan, error: planError } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('plan_code', params.planCode)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    throw new Error('Subscription plan not found or inactive');
  }

  // 2. Check for existing active subscription
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('id, status')
    .eq('user_id', params.userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();

  if (existingSub) {
    throw new Error('User already has an active subscription');
  }

  // 3. Load Dodo product mapping
  const { data: mapping } = await supabase
    .from('payment_product_mappings')
    .select('*')
    .eq('internal_product_type', 'subscription_plan')
    .eq('internal_product_id', plan.id)
    .eq('environment', process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test')
    .eq('is_active', true)
    .maybeSingle();

  const price =
    params.billingCycle === 'annual'
      ? Number(plan.price_annual ?? 0)
      : Number(plan.price_monthly ?? 0);

  // 4. Create local order
  const order = await createOrder({
    userId: params.userId,
    orderType: 'subscription',
    currency: plan.currency ?? 'EUR',
    items: [
      {
        itemType: 'subscription',
        internalProductId: plan.id,
        quantity: 1,
        unitPrice: price,
      },
    ],
    metadata: { planCode: params.planCode, billingCycle: params.billingCycle },
  });

  const config = provider.getConfig();
  if (!config.isEnabled || !config.isConfigured || !mapping?.dodo_price_id) {
    return {
      checkoutUrl: `/checkout/pending?order=${order.id}&type=subscription`,
      orderId: order.id,
    };
  }

  const result = await provider.createSubscriptionCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    planId: plan.id,
    dodoPriceId: mapping.dodo_price_id,
    billingCycle: params.billingCycle,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}`,
  });

  await updateOrderCheckoutRef(order.id, result.externalCheckoutId);

  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}

// ─── Credit Pack Checkout ─────────────────────────────────────

export async function initiateCreditPackCheckout(params: {
  userId: string;
  userEmail: string;
  packCode: string;
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const supabase = await createClient();

  // 1. Load credit pack server-side
  const { data: pack, error: packError } = await supabase
    .from('credit_packs')
    .select('*')
    .eq('pack_code', params.packCode)
    .eq('is_active', true)
    .single();

  if (packError || !pack) {
    throw new Error('Credit pack not found or inactive');
  }

  // 2. Create local order
  const order = await createOrder({
    userId: params.userId,
    orderType: 'credit_pack',
    currency: pack.currency,
    items: [
      {
        itemType: 'credit_pack',
        internalProductId: pack.id,
        quantity: 1,
        unitPrice: Number(pack.price),
      },
    ],
    metadata: { packCode: params.packCode, credits: pack.credits },
  });

  const config = provider.getConfig();
  if (!config.isEnabled || !config.isConfigured) {
    return {
      checkoutUrl: `/checkout/pending?order=${order.id}&type=credits`,
      orderId: order.id,
    };
  }

  const result = await provider.createCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    amount: order.totalAmount,
    currency: order.currency,
    productName: pack.name,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}`,
    metadata: { orderId: order.id, packCode: params.packCode },
  });

  await updateOrderCheckoutRef(order.id, result.externalCheckoutId);

  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}
