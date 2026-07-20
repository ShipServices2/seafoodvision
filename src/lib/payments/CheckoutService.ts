// ============================================================
// SEAFOOD VISION — CheckoutService
// Existing server-side checkout orchestration, backed by the centralized
// commercial validator. Browser prices and rights are never trusted.
// ============================================================

import { DodoPaymentsProvider } from './dodo/DodoPaymentsProvider';
import { getDodoReturnUrl, getDodoCancelUrl } from './dodo/config';
import { createOrder, updateOrderCheckoutRef } from './PaymentService';
import {
  assertCommercialValidation,
  canonicalPlanCode,
  validateAssetLicensePurchase,
  validateCreditPackPurchase,
  validateSubscriptionPurchase,
} from './CommercialValidationService';
import { getDodoRuntimeConfig } from './dodo/config';

export {
  getCommercialAssetBlockers,
} from './CommercialValidationService';
import type { CommercialAssetSnapshot } from './CommercialValidationService';

export { getCommercialAssetBlockers };
export type { CommercialAssetSnapshot };

const provider = new DodoPaymentsProvider();

function environment(): 'test' | 'production' {
  return getDodoRuntimeConfig().environment === 'production' ? 'production' : 'test';
}

function assertProviderReady(): void {
  if (!getDodoRuntimeConfig().isCheckoutReady) {
    throw new Error('Dodo Payments is not configured for checkout');
  }
}

function reuseCheckout(order: { id: string; reused?: boolean; checkoutUrl?: string }): { checkoutUrl: string; orderId: string } | null {
  if (!order.reused) return null;
  if (order.checkoutUrl) return { checkoutUrl: order.checkoutUrl, orderId: order.id };
  throw new Error('An identical checkout is already being initialized; retry shortly');
}

export async function initiateAssetLicenseCheckout(params: {
  userId: string;
  userEmail: string;
  assetId: string;
  licenseTypeCode: string;
  unitProductCode: string;
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const validation = await validateAssetLicensePurchase({
    assetId: params.assetId,
    licenseTypeCode: params.licenseTypeCode,
    unitProductCode: params.unitProductCode,
    environment: environment(),
  });
  assertCommercialValidation(validation, 'Asset is not commercially available');
  assertProviderReady();

  const normalized = validation.normalized_product as {
    asset: { id: string };
    license: { id: string; name: string };
    product: { id: string; name: string };
  };
  const order = await createOrder({
    userId: params.userId,
    orderType: 'asset_license',
    currency: validation.currency,
    checkoutKey: `asset:${normalized.asset.id}:${normalized.license.id}:${normalized.product.id}`,
    metadata: {
      ...validation.fulfillment_metadata,
      dodoProductId: validation.dodo_product_id,
    },
    items: [{
      itemType: 'asset_license',
      internalProductId: normalized.product.id,
      assetId: normalized.asset.id,
      licenseTypeId: normalized.license.id,
      quantity: 1,
      unitPrice: validation.authoritative_price,
    }],
  });
  const reused = reuseCheckout(order);
  if (reused) return reused;

  const result = await provider.createCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    amount: order.totalAmount,
    currency: order.currency,
    productName: `${normalized.product.name} — ${normalized.license.name}`,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}`,
    metadata: {
      orderId: order.id,
      assetId: normalized.asset.id,
      dodoProductId: validation.dodo_product_id,
    },
  });
  await updateOrderCheckoutRef(order.id, result.externalCheckoutId, result.checkoutUrl);
  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}

export async function initiateSubscriptionCheckout(params: {
  userId: string;
  userEmail: string;
  planCode: string;
  billingCycle: 'monthly' | 'annual';
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const planCode = canonicalPlanCode(params.planCode);
  const validation = await validateSubscriptionPurchase({
    userId: params.userId,
    planCode,
    billingCycle: params.billingCycle,
    environment: environment(),
  });
  assertCommercialValidation(validation, 'Subscription checkout is unavailable');
  assertProviderReady();

  const plan = validation.normalized_product as { id: string; name: string };
  const order = await createOrder({
    userId: params.userId,
    orderType: 'subscription',
    currency: validation.currency,
    checkoutKey: `subscription:${plan.id}:${params.billingCycle}`,
    metadata: {
      ...validation.fulfillment_metadata,
      dodoProductId: validation.dodo_product_id,
    },
    items: [{
      itemType: 'subscription',
      internalProductId: plan.id,
      quantity: 1,
      unitPrice: validation.authoritative_price,
    }],
  });
  const reused = reuseCheckout(order);
  if (reused) return reused;

  const result = await provider.createSubscriptionCheckout({
    orderId: order.id,
    userId: params.userId,
    userEmail: params.userEmail,
    planId: plan.id,
    dodoPriceId: validation.dodo_product_id,
    billingCycle: params.billingCycle,
    successUrl: `${getDodoReturnUrl()}?order=${order.id}`,
    cancelUrl: `${getDodoCancelUrl()}?order=${order.id}`,
  });
  await updateOrderCheckoutRef(order.id, result.externalCheckoutId, result.checkoutUrl);
  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}

export async function initiateCreditPackCheckout(params: {
  userId: string;
  userEmail: string;
  packCode: string;
}): Promise<{ checkoutUrl: string; orderId: string }> {
  const validation = await validateCreditPackPurchase({
    packCode: params.packCode,
    environment: environment(),
  });
  assertCommercialValidation(validation, 'Credit checkout is unavailable');
  assertProviderReady();

  const pack = validation.normalized_product as {
    id: string;
    name: string;
    pack_code: string;
    credits: number;
  };
  const order = await createOrder({
    userId: params.userId,
    orderType: 'credit_pack',
    currency: validation.currency,
    checkoutKey: `credit_pack:${pack.id}`,
    metadata: {
      ...validation.fulfillment_metadata,
      dodoProductId: validation.dodo_product_id,
    },
    items: [{
      itemType: 'credit_pack',
      internalProductId: pack.id,
      quantity: 1,
      unitPrice: validation.authoritative_price,
    }],
  });
  const reused = reuseCheckout(order);
  if (reused) return reused;

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
      packCode: pack.pack_code,
      dodoProductId: validation.dodo_product_id,
    },
  });
  await updateOrderCheckoutRef(order.id, result.externalCheckoutId, result.checkoutUrl);
  return { checkoutUrl: result.checkoutUrl, orderId: order.id };
}
