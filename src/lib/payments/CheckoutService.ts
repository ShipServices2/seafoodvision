// ============================================================
// SEAFOOD VISION — CheckoutService
// Server-side checkout orchestration.
// Validates products, creates orders, calls PaymentProvider.
// NEVER trusts prices from the browser.
// Uses dodo_product_id for subscription checkout (Dodo product_cart API).
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

  // 5. Create checkout via provider
  const config = provider.getConfig();
  if (!config.isEnabled || !config.isConfigured) {
    throw new Error(
      'Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_WEBHOOK_SECRET.'
    );
  }

  // Load Dodo product mapping for this unit product
  const { data: mapping } = await supabase
    .from('payment_product_mappings')
    .select('dodo_product_id')
    .eq('internal_product_type', 'one_time_asset_license')
    .eq('internal_product_id', product.id)
    .eq('environment', process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test')
    .eq('is_active', true)
    .maybeSingle();

  if (!mapping?.dodo_product_id) {
    throw new Error(
      `No Dodo product mapping found for unit product "${params.unitProductCode}" in ${process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test'} environment.`
    );
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
    metadata: {
      orderId: order.id,
      assetId: params.assetId,
      dodoProductId: mapping.dodo_product_id,
    },
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

  // 1. Load plan server-side — never trust client-supplied price
  const { data: plan, error: planError } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('plan_code', params.planCode)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    throw new Error(`Subscription plan "${params.planCode}" not found or inactive`);
  }

  // 2. Check for existing active subscription (prevent double-subscribe)
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('id, status')
    .eq('user_id', params.userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();

  if (existingSub) {
    throw new Error('User already has an active subscription');
  }

  // 3. Load Dodo product mapping (uses dodo_product_id for product_cart API)
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test';
  const { data: mapping } = await supabase
    .from('payment_product_mappings')
    .select('dodo_product_id, dodo_price_id')
    .eq('internal_product_type', 'subscription_plan')
    .eq('internal_product_id', plan.id)
    .eq('environment', environment)
    .eq('is_active', true)
    .maybeSingle();

  // 4. Verify Dodo is configured
  const config = provider.getConfig();
  if (!config.isEnabled || !config.isConfigured) {
    throw new Error(
      'Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_WEBHOOK_SECRET.'
    );
  }

  if (!mapping?.dodo_product_id) {
    throw new Error(
      `No Dodo product mapping found for plan "${params.planCode}" in ${environment} environment. ` +
      `Please add the mapping in Admin → Commerce → Mappings.`
    );
  }

  // 5. Determine price server-side
  const price =
    params.billingCycle === 'annual'
      ? Number(plan.price_annual ?? 0)
      : Number(plan.price_monthly ?? 0);

  // 6. Create local order (price from DB)
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
    metadata: {
      planCode: params.planCode,
      billingCycle: params.billingCycle,
      dodoProductId: mapping.dodo_product_id,
    },
  });

  // 7. Create Dodo Checkout Session using product_cart with dodo_product_id
  const result = await provider.createSubscriptionCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    planId: plan.id,
    dodoPriceId: mapping.dodo_product_id, // Dodo uses product_id in product_cart
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
    throw new Error(
      'Dodo Payments is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_WEBHOOK_SECRET.'
    );
  }

  // Load Dodo product mapping
  const { data: mapping } = await supabase
    .from('payment_product_mappings')
    .select('dodo_product_id')
    .eq('internal_product_type', 'credit_pack')
    .eq('internal_product_id', pack.id)
    .eq('environment', process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test')
    .eq('is_active', true)
    .maybeSingle();

  if (!mapping?.dodo_product_id) {
    throw new Error(
      `No Dodo product mapping found for credit pack "${params.packCode}".`
    );
  }

  const result = await provider.createCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    amount: order.totalAmount,
    currency: order.currency,
    productName: pack.name,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}&type=credits`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}&type=credits`,
    metadata: {
      orderId: order.id,
      packCode: params.packCode,
      dodoProductId: mapping.dodo_product_id,
    },
  });

  await updateOrderCheckoutRef(order.id, result.externalCheckoutId);

  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}
