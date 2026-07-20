import { describe, expect, test } from '@jest/globals';
import {
  canonicalPlanCode,
  isValidCurrency,
  isValidMoney,
  validateAssetLicensePurchase,
  validateCreditPackPurchase,
  validateSubscriptionPurchase,
} from '../CommercialValidationService';
import { areOrderItemsEquivalent, isReusableOrderCandidate } from '../PaymentService';

type QueryResult = { data: unknown; error: null };

function mockCommerceClient(results: Record<string, QueryResult[]>) {
  return {
    from(table: string) {
      const result = results[table]?.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'is', 'limit', 'order']) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = async () => result;
      builder.single = async () => result;
      builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  };
}

function result(data: unknown): QueryResult {
  return { data, error: null };
}

const activePack = (code: string) => ({
  id: `pack-${code}`,
  pack_code: code,
  credits: Number(code.split('_')[1]),
  price: 19,
  currency: 'EUR',
  is_active: true,
});

const activePlan = {
  id: 'plan-professional',
  plan_code: 'professional',
  price_monthly: 79,
  price_annual: 790,
  currency: 'EUR',
  is_active: true,
};

const commercialAsset = {
  id: 'asset-1',
  media_type: 'photo',
  review_status: 'approved',
  publication_status: 'published',
  commercial_use: true,
  license_type: 'commercial',
  restrictions: null,
  is_demo: false,
  asset_readiness: {
    technical_quality: true,
    rights_verified: true,
    original_available: true,
    license_ready: true,
    publication_ready: true,
  },
  asset_files: [{ file_level: 'original', storage_bucket: 'originals', storage_path: 'a.jpg' }],
};

describe('normalized commercial rules', () => {
  test.each([
    ['professional', 'professional'],
    ['professional_monthly', 'professional'],
    ['professional_annual', 'professional'],
  ])('canonicalizes plan code %s', (input, expected) => {
    expect(canonicalPlanCode(input)).toBe(expected);
  });

  test('accepts only positive finite prices', () => {
    expect(isValidMoney(20)).toBe(true);
    expect(isValidMoney(0)).toBe(false);
    expect(isValidMoney(Number.NaN)).toBe(false);
  });

  test('accepts ISO-style uppercase currency codes', () => {
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('eur')).toBe(false);
  });
});

describe('credit pack checkout rules', () => {
  test.each(['credits_100', 'credits_250', 'credits_500', 'credits_1000'])(
    'validates %s from authoritative server data',
    async (packCode) => {
      const pack = activePack(packCode);
      const client = mockCommerceClient({
        credit_packs: [result(pack)],
        payment_product_mappings: [result({ dodo_product_id: `dodo-${packCode}` })],
      });
      const validation = await validateCreditPackPurchase(
        { packCode, environment: 'test' },
        client as never
      );
      expect(validation.valid).toBe(true);
      expect(validation.fulfillment_metadata.credits).toBe(pack.credits);
    }
  );

  test('blocks a missing Dodo credit mapping', async () => {
    const client = mockCommerceClient({
      credit_packs: [result(activePack('credits_100'))],
      payment_product_mappings: [result(null)],
    });
    const validation = await validateCreditPackPurchase(
      { packCode: 'credits_100', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('Dodo mapping is missing for the credit pack');
  });

  test('blocks an inactive credit pack', async () => {
    const client = mockCommerceClient({
      credit_packs: [result({ ...activePack('credits_100'), is_active: false })],
      payment_product_mappings: [result({ dodo_product_id: 'dodo-pack' })],
    });
    const validation = await validateCreditPackPurchase(
      { packCode: 'credits_100', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('credit pack is inactive');
  });
});

describe('subscription checkout rules', () => {
  test.each([
    ['monthly' as const, 79],
    ['annual' as const, 790],
  ])('uses the authoritative %s price and cycle-specific mapping', async (billingCycle, price) => {
    const client = mockCommerceClient({
      pricing_plans: [result([activePlan])],
      payment_product_mappings: [result({ dodo_product_id: `dodo-${billingCycle}` })],
      user_subscriptions: [result(null)],
    });
    const validation = await validateSubscriptionPurchase(
      { userId: 'user-1', planCode: `professional_${billingCycle}`, billingCycle, environment: 'test' },
      client as never
    );
    expect(validation.valid).toBe(true);
    expect(validation.authoritative_price).toBe(price);
    expect(validation.fulfillment_metadata.billingCycle).toBe(billingCycle);
  });

  test('disables an annual plan whose annual Dodo mapping is absent', async () => {
    const client = mockCommerceClient({
      pricing_plans: [result([activePlan])],
      payment_product_mappings: [result(null)],
      user_subscriptions: [result(null)],
    });
    const validation = await validateSubscriptionPurchase(
      { userId: 'user-1', planCode: 'professional', billingCycle: 'annual', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('Dodo annual mapping is missing for this plan');
  });

  test('blocks a second active subscription', async () => {
    const client = mockCommerceClient({
      pricing_plans: [result([activePlan])],
      payment_product_mappings: [result({ dodo_product_id: 'dodo-monthly' })],
      user_subscriptions: [result({ id: 'subscription-1' })],
    });
    const validation = await validateSubscriptionPurchase(
      { userId: 'user-1', planCode: 'professional', billingCycle: 'monthly', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('user already has an active subscription');
  });
});

describe('asset checkout rules', () => {
  test('ignores frontend price and returns the unit product server price', async () => {
    const client = mockCommerceClient({
      assets: [result(commercialAsset)],
      license_types: [result({ id: 'license-1', code: 'commercial', is_active: true, is_exclusive: false })],
      unit_products: [result({
        id: 'product-1', product_code: 'photo_hd', price: 20, currency: 'EUR', is_active: true,
        license_type_code: 'commercial', resolution_allowed: 'hd', download_quota: 1,
      })],
      payment_product_mappings: [result({ dodo_product_id: 'dodo-photo-hd' })],
    });
    const validation = await validateAssetLicensePurchase(
      { assetId: 'asset-1', licenseTypeCode: 'commercial', unitProductCode: 'photo_hd', environment: 'test' },
      client as never
    );
    expect(validation.valid).toBe(true);
    expect(validation.authoritative_price).toBe(20);
  });

  test('blocks an inactive unit product', async () => {
    const client = mockCommerceClient({
      assets: [result(commercialAsset)],
      license_types: [result({ id: 'license-1', code: 'commercial', is_active: true, is_exclusive: false })],
      unit_products: [result({ id: 'product-1', price: 20, currency: 'EUR', is_active: false, license_type_code: 'commercial' })],
      payment_product_mappings: [result({ dodo_product_id: 'dodo-photo-hd' })],
    });
    const validation = await validateAssetLicensePurchase(
      { assetId: 'asset-1', licenseTypeCode: 'commercial', unitProductCode: 'photo_hd', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('unit product is inactive');
  });

  test('blocks a non-commercial asset', async () => {
    const client = mockCommerceClient({
      assets: [result({ ...commercialAsset, commercial_use: false })],
      license_types: [result({ id: 'license-1', code: 'commercial', is_active: true, is_exclusive: false })],
      unit_products: [result({ id: 'product-1', price: 20, currency: 'EUR', is_active: true, license_type_code: 'commercial' })],
      payment_product_mappings: [result({ dodo_product_id: 'dodo-photo-hd' })],
    });
    const validation = await validateAssetLicensePurchase(
      { assetId: 'asset-1', licenseTypeCode: 'commercial', unitProductCode: 'photo_hd', environment: 'test' },
      client as never
    );
    expect(validation.blockers).toContain('commercial use is not permitted');
  });
});

describe('draft order reuse rules', () => {
  const now = Date.parse('2026-07-19T12:00:00Z');
  const recent = '2026-07-19T11:55:00Z';

  test('reuses a compatible recent draft without provider checkout', () => {
    expect(isReusableOrderCandidate({ status: 'draft', created_at: recent }, now)).toBe(true);
  });

  test.each(['paid', 'cancelled', 'expired', 'refunded'])(
    'never reuses a %s order',
    (status) => expect(isReusableOrderCandidate({ status, created_at: recent }, now)).toBe(false)
  );

  test('reuses a recent pending order only with checkout id and stored URL', () => {
    expect(isReusableOrderCandidate({
      status: 'pending',
      created_at: recent,
      external_checkout_id: 'checkout-1',
      metadata: { checkout_url: 'https://checkout.example.test/1' },
    }, now)).toBe(true);
  });

  test('rejects incompatible order item signatures', () => {
    expect(areOrderItemsEquivalent(
      [{ item_type: 'credit_pack', internal_product_id: 'pack-1', asset_id: null, license_type_id: null, quantity: 1, unit_price: 9 }],
      [{ itemType: 'credit_pack', internalProductId: 'pack-2', quantity: 1, unitPrice: 9 }]
    )).toBe(false);
  });
});
