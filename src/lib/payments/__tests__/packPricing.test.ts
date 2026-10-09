import { describe, expect, test } from '@jest/globals';
import {
  buildDodoProductCart,
  computePackPricing,
  productCartTotal,
  type PackOffer,
  type PackPricingLine,
} from '../packPricing';
import { validateAssetLicensePurchase } from '../CommercialValidationService';

const offer: PackOffer = { productId: 'pack-id', size: 10, price: 150, dodoProductId: 'pdt_pack' };

const hd = (quantity = 1): PackPricingLine & { dodoProductId: string } =>
  ({ productCode: 'photo_hd', unitPrice: 20, quantity, dodoProductId: 'pdt_hd' });
const web = (quantity = 1) => ({ productCode: 'photo_web', unitPrice: 5, quantity, dodoProductId: 'pdt_web' });
const ext = (quantity = 1) => ({ productCode: 'photo_hd_extended', unitPrice: 299, quantity, dodoProductId: 'pdt_ext' });

/** One order line per photo, like the cart (asset licences have a fixed quantity of one). */
const lines = (count: number, make: typeof hd) => Array.from({ length: count }, () => make());
const subtotal = (all: PackPricingLine[]) => all.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

describe('Pack 10 Photos HD: automatic discount per block of 10 standard HD photos', () => {
  test.each([
    [0, 0, 0, 0],
    [1, 0, 1, 0],
    [9, 0, 9, 0],
    [10, 1, 0, 50],
    [11, 1, 1, 50],
    [12, 1, 2, 50],
    [19, 1, 9, 50],
    [20, 2, 0, 100],
    [25, 2, 5, 100],
  ])('%i HD photos -> %i pack(s), %i billed per photo, discount %i EUR', (count, packs, remainder, discount) => {
    const pricing = computePackPricing(lines(count, hd), offer);
    expect(pricing).toEqual({ eligibleCount: count, packs, remainder, discount });
  });

  test('12 HD photos cost 1 pack + 2 x 20 EUR = 190 EUR', () => {
    const cart = lines(12, hd);
    const pricing = computePackPricing(cart, offer);
    expect(subtotal(cart) - pricing.discount).toBe(150 + 2 * 20);
  });

  test('Photo Web and "HD + extended licence" never count toward a pack', () => {
    const cart = [...lines(8, hd), ...lines(5, web), ...lines(3, ext)];
    expect(computePackPricing(cart, offer)).toMatchObject({ eligibleCount: 8, packs: 0, discount: 0 });
    // 10 web + 10 extended: still no pack
    expect(computePackPricing([...lines(10, web), ...lines(10, ext)], offer).discount).toBe(0);
  });

  test('only the HD photos of a mixed cart form packs', () => {
    const cart = [...lines(10, hd), ...lines(4, web), ...lines(2, ext)];
    const pricing = computePackPricing(cart, offer);
    expect(pricing).toMatchObject({ eligibleCount: 10, packs: 1, remainder: 0, discount: 50 });
    expect(subtotal(cart) - pricing.discount).toBe(150 + 4 * 5 + 2 * 299);
  });

  test('no offer (not configured) or a pack that would cost more than the units: no discount', () => {
    expect(computePackPricing(lines(10, hd), null).discount).toBe(0);
    expect(computePackPricing(lines(10, hd), { size: 10, price: 200 }).discount).toBe(0);
    expect(computePackPricing(lines(10, hd), { size: 10, price: 250 }).discount).toBe(0);
  });

  test('quantity on a single line counts like separate lines', () => {
    expect(computePackPricing([hd(12)], offer)).toMatchObject({ packs: 1, remainder: 2, discount: 50 });
  });
});

describe('Dodo product cart built from the cart lines', () => {
  const price = new Map([['pdt_hd', 20], ['pdt_web', 5], ['pdt_ext', 299], ['pdt_pack', 150]]);

  test('12 HD photos = 1 pack + 2 HD photos', () => {
    expect(buildDodoProductCart(lines(12, hd), offer)).toEqual([
      { productId: 'pdt_pack', quantity: 1 },
      { productId: 'pdt_hd', quantity: 2 },
    ]);
  });

  test('exactly 10 HD photos = 1 pack and no loose HD photo', () => {
    expect(buildDodoProductCart(lines(10, hd), offer)).toEqual([{ productId: 'pdt_pack', quantity: 1 }]);
  });

  test('9 HD photos stay at the unit price', () => {
    expect(buildDodoProductCart(lines(9, hd), offer)).toEqual([{ productId: 'pdt_hd', quantity: 9 }]);
  });

  test('web and extended lines are billed on their own products', () => {
    const cart = [...lines(10, hd), ...lines(2, web), ...lines(1, ext)];
    expect(buildDodoProductCart(cart, offer)).toEqual([
      { productId: 'pdt_pack', quantity: 1 },
      { productId: 'pdt_web', quantity: 2 },
      { productId: 'pdt_ext', quantity: 1 },
    ]);
  });

  test.each([1, 9, 10, 12, 20, 23])('what Dodo charges equals subtotal - discount for %i HD photos in a mixed cart', (count) => {
    const cart = [...lines(count, hd), ...lines(3, web), ...lines(1, ext)];
    const pricing = computePackPricing(cart, offer);
    const charged = productCartTotal(buildDodoProductCart(cart, offer), price);
    expect(charged).toBeCloseTo(subtotal(cart) - pricing.discount, 2);
  });

  test('without an offer every photo is billed per photo', () => {
    expect(buildDodoProductCart(lines(12, hd), null)).toEqual([{ productId: 'pdt_hd', quantity: 12 }]);
  });
});

describe('a pack can never be bought as a line', () => {
  test('validation refuses pack_10 as an asset licence line', async () => {
    const results: Record<string, Array<{ data: unknown; error: null }>> = {
      assets: [{ data: {
        id: 'asset-1', media_type: 'photo', review_status: 'approved', publication_status: 'published', commercial_use: true,
        license_type: 'commercial', restrictions: null, is_demo: false, width_px: 6000, height_px: 4000,
        asset_readiness: { technical_quality: true, rights_verified: true, original_available: true, license_ready: true, publication_ready: true },
        asset_files: [{ file_level: 'original', storage_bucket: 'asset-originals', storage_path: 'x.jpg' }],
      }, error: null }],
      license_types: [{ data: { id: 'l1', code: 'commercial', name: 'Commercial', is_active: true, is_exclusive: false }, error: null }],
      unit_products: [{ data: {
        id: 'pack-id', product_code: 'pack_10', name: 'Pack 10 Photos HD', price: 150, currency: 'EUR', is_active: true,
        license_type_code: null, resolution_allowed: 'hd', download_quota: 5, pack_size: 10,
      }, error: null }],
      payment_product_mappings: [{ data: { dodo_product_id: 'pdt_pack' }, error: null }],
    };
    const client = {
      from(table: string) {
        const res = results[table]?.shift() ?? { data: null, error: null };
        const b: Record<string, unknown> = {};
        b.select = () => b;
        for (const m of ['eq', 'in', 'is', 'limit', 'order']) b[m] = () => b;
        b.maybeSingle = async () => res;
        b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko);
        return b;
      },
    };
    const validation = await validateAssetLicensePurchase(
      { assetId: 'asset-1', licenseTypeCode: 'commercial', unitProductCode: 'pack_10', environment: 'test' },
      client as never
    );
    expect(validation.valid).toBe(false);
    expect(validation.blockers).toContain('pack products are applied automatically at checkout');
  });
});
