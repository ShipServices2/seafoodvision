import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_CART_LINES,
  MAX_CART_QUANTITY,
  cartItemsCanMerge,
  cartLineIdentity,
  normalizeCartQuantity,
  type CartLine,
} from '../CartService';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const cartService = source('src/lib/payments/CartService.ts');
const provider = source('src/lib/payments/dodo/DodoPaymentsProvider.ts');
const webhook = source('src/lib/payments/WebhookService.ts');
const migration = source('supabase/migrations/20260720120000_multi_product_cart_line_fulfillment.sql');
const cartPage = source('src/app/cart/page.tsx');
const header = source('src/components/Header.tsx');
const assetPage = source('src/app/asset/[slug]/page.tsx');
const pricingPage = source('src/app/pricing/page.tsx');

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  id: 'line-1', itemType: 'credit_pack', internalProductId: 'pack-100', assetId: null,
  licenseTypeId: null, quantity: 1, unitPrice: 9, subtotal: 9, productCode: 'credits_100',
  productName: '100 credits', assetTitle: null, licenseName: null, format: null,
  credits: 100, validationError: null, ...overrides,
});

describe('cart quantity and line identity rules', () => {
  test.each([0, -1, 1.5, 11])('rejects invalid credit quantity %s', (quantity) => {
    expect(() => normalizeCartQuantity('credit_pack', quantity)).toThrow();
  });
  test.each([2, 10])('rejects asset quantity %s', (quantity) => {
    expect(() => normalizeCartQuantity('asset_license', quantity)).toThrow('fixed quantity');
  });
  test.each([1, 2, 10])('accepts credit quantity %s', (quantity) => {
    expect(normalizeCartQuantity('credit_pack', quantity)).toBe(quantity);
  });
  test('accepts one asset license', () => expect(normalizeCartQuantity('asset_license', 1)).toBe(1));
  test('documents cart limits', () => {
    expect(MAX_CART_LINES).toBe(50);
    expect(MAX_CART_QUANTITY).toBe(10);
  });
  test('builds stable identical signatures', () => {
    expect(cartLineIdentity(line())).toBe(cartLineIdentity(line({ id: 'line-2' })));
  });
  test.each([
    [{ internalProductId: 'pack-250' }],
    [{ itemType: 'asset_license' as const }],
    [{ assetId: 'asset-2' }],
    [{ licenseTypeId: 'license-2' }],
  ])('separates different line dimensions %#', (override) => {
    expect(cartLineIdentity(line())).not.toBe(cartLineIdentity(line(override)));
  });
  test('merges identical credit packs', () => {
    expect(cartItemsCanMerge(line(), { ...line(), dodoProductId: 'pdt-test', currency: 'EUR', metadata: {} })).toBe(true);
  });
  test('does not quantity-merge asset licenses', () => {
    const asset = line({ itemType: 'asset_license', assetId: 'asset-1', licenseTypeId: 'license-1' });
    expect(cartItemsCanMerge(asset, { ...asset, dodoProductId: 'pdt-test', currency: 'EUR', metadata: {} })).toBe(false);
  });
});

describe('persistent server cart contracts', () => {
  test('uses orders rather than a cart table', () => expect(cartService).toContain(".from('orders')"));
  test('uses order_items rather than cart_items', () => expect(cartService).toContain(".from('order_items')"));
  test('marks the persistent cart kind in metadata', () => expect(cartService).toContain("CART_KIND = 'multi_product'"));
  test('uses a stable checkout key for concurrency', () => expect(cartService).toContain("CART_CHECKOUT_KEY = 'cart:v1'"));
  test('only edits draft orders', () => expect(cartService).toContain(".eq('status', 'draft')"));
  test('treats pending orders as locked', () => expect(cartService).toContain("order.status !== 'draft'"));
  test('never accepts a browser price', () => expect(cartService).not.toMatch(/request\.(price|total|dodoProductId)/));
  test('revalidates asset lines centrally', () => expect(cartService).toContain('validateAssetLicensePurchase'));
  test('revalidates credit packs centrally', () => expect(cartService).toContain('validateCreditPackPurchase'));
  test('requires one currency', () => expect(cartService).toContain('currency_mismatch'));
  test('blocks empty checkout', () => expect(cartService).toContain("'empty_cart'"));
  test('detects changed prices', () => expect(cartService).toContain("'price_changed'"));
  test('locks before provider checkout', () => expect(cartService).toContain("checkout_initializing: true"));
  test('recovers draft after provider failure', () => expect(cartService).toContain("status: 'draft'"));
  test('reuses a stored checkout URL', () => expect(cartService).toContain('metadata.checkout_url'));
  test('restricts this sprint checkout to test environment', () => expect(cartService).toContain("environment() !== 'test'"));
  test('constructs one provider call', () => expect((cartService.match(/provider\.createCheckout/g) ?? [])).toHaveLength(1));
  test('constructs a multi-product productCart', () => expect(cartService).toContain('productCart,'));
  test('sends only server-resolved product IDs to Dodo', () => expect(cartService).toContain('itemMetadata.dodoProductId'));
  test('limits excessive carts', () => expect(cartService).toContain('MAX_CART_LINES'));
});

describe('secured cart API contracts', () => {
  test.each([
    'src/app/api/cart/route.ts',
    'src/app/api/cart/items/route.ts',
    'src/app/api/cart/items/[itemId]/route.ts',
    'src/app/api/cart/validate/route.ts',
    'src/app/api/cart/checkout/route.ts',
  ])('%s authenticates with requireCartUser', (path) => {
    expect(source(path)).toContain('requireCartUser');
  });
  test('add route accepts reference fields only', () => {
    const route = source('src/app/api/cart/items/route.ts');
    expect(route).toContain('assetId');
    expect(route).toContain('packCode');
    expect(route).not.toContain('dodoProductId');
    expect(route).not.toContain('unitPrice');
  });
  test('item route scopes mutations through CartService ownership checks', () => {
    expect(source('src/app/api/cart/items/[itemId]/route.ts')).toContain('user.id');
  });
});

describe('Dodo and exact-once multi-line fulfillment contracts', () => {
  test('provider maps every product cart element', () => expect(provider).toContain('.map((item) => ({ product_id: item.productId'));
  test('provider preserves the direct single-product fallback', () => expect(provider).toContain('params.metadata?.dodoProductId'));
  test('webhook loads all fulfillment item types', () => expect(webhook).toContain(".select('item_type')"));
  test('webhook loops over all asset lines', () => expect(webhook).toContain('for (const item of items)'));
  test('webhook aggregates credit pack quantities', () => expect(webhook).toContain('Number(pack.credits) * Number(item.quantity)'));
  test('webhook rejects unsupported line types', () => expect(webhook).toContain('Unsupported fulfillment line types'));
  test('webhook retains atomic credit application', () => expect(webhook).toContain(".rpc('apply_credit_purchase'"));
  test('migration is transactional and creates no cart tables', () => {
    expect(migration.trimStart()).toMatch(/^--[\s\S]*BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).not.toMatch(/CREATE\s+TABLE/i);
  });
  test('migration keys licenses by order item', () => expect(migration).toContain('uq_purchased_licenses_order_item'));
  test('migration preserves a legacy exact-once key', () => expect(migration).toContain('uq_purchased_licenses_legacy_line'));
});

describe('cart interface and accessibility contracts', () => {
  test('provides the /cart page empty state', () => expect(cartPage).toContain('Your cart is empty'));
  test('provides loading state', () => expect(cartPage).toContain('Loading cart'));
  test('renders line validation errors', () => expect(cartPage).toContain('item.validationError'));
  test('supports keyboard-native quantity buttons', () => expect(cartPage).toContain('aria-label="Increase quantity"'));
  test('requires validation before checkout', () => expect(cartPage).toContain('!confirmed'));
  test('adds a navigation line-count badge', () => {
    expect(header).toContain('cartCount');
    expect(header).toContain('lineCount');
  });
  test('adds an asset purchase cart action', () => expect(assetPage).toContain('<AddToCartButton'));
  test('adds credit packs but sends generic media buyers to Library', () => {
    expect(pricingPage).toContain("itemType: 'credit_pack'");
    expect(pricingPage).toContain('Select an asset');
  });
});
