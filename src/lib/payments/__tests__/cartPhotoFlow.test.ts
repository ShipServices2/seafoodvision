import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// In-memory stand-in for the Supabase client: just enough query-builder surface for CartService.
type Row = Record<string, any>;
const db: Record<string, Row[]> = {};
let seq = 0;

function builder(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let payload: Row = {};
  let single = false;
  const b: Record<string, any> = {};
  const rows = () => {
    const found = (db[table] ?? []).filter((row) => filters.every((f) => f(row)));
    if (table === 'orders') return found.map((order) => ({ ...order, order_items: db.order_items.filter((i) => i.order_id === order.id) }));
    return found;
  };
  const run = () => {
    if (op === 'insert') {
      const row = { id: `${table}-${++seq}`, ...payload };
      (db[table] ??= []).push(row);
      return { data: row, error: null };
    }
    if (op === 'update') {
      (db[table] ?? []).filter((row) => filters.every((f) => f(row))).forEach((row) => Object.assign(row, payload));
      return { data: null, error: null };
    }
    if (op === 'delete') {
      db[table] = (db[table] ?? []).filter((row) => !filters.every((f) => f(row)));
      return { data: null, error: null };
    }
    const found = rows();
    return { data: single ? (found[0] ?? null) : found, error: null };
  };
  b.select = () => b;
  b.insert = (row: Row) => { op = 'insert'; payload = row; return b; };
  b.update = (row: Row) => { op = 'update'; payload = row; return b; };
  b.delete = () => { op = 'delete'; return b; };
  b.eq = (col: string, value: unknown) => { filters.push((r) => r[col] === value); return b; };
  b.in = (col: string, values: unknown[]) => { filters.push((r) => values.includes(r[col])); return b; };
  b.is = (col: string, value: unknown) => { filters.push((r) => (r[col] ?? null) === value); return b; };
  b.contains = (col: string, value: Row) => { filters.push((r) => Object.entries(value).every(([k, v]) => r[col]?.[k] === v)); return b; };
  for (const m of ['order', 'limit']) b[m] = () => b;
  b.maybeSingle = async () => { single = true; return run(); };
  b.single = async () => { single = true; return run(); };
  b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, ko);
  return b;
}

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({ from: (table: string) => builder(table) }) }));

// Licence validation stand-in: price and Dodo product are fixed per product, HD products need an HD photo.
jest.mock('../CommercialValidationService', () => {
  const products: Record<string, { id: string; name: string; price: number }> = {
    photo_web: { id: 'p-web', name: 'Digital Use', price: 5 },
    photo_hd: { id: 'p-hd', name: 'HD Print', price: 20 },
    photo_hd_extended: { id: 'p-ext', name: 'HD Extended', price: 299 },
  };
  return {
    assertCommercialValidation: () => undefined,
    validateCreditPackPurchase: async () => ({ valid: false, blockers: ['not sold'] }),
    validateAssetLicensePurchase: async (p: { assetId: string; licenseTypeCode: string; unitProductCode: string }) => {
      const web = p.assetId === 'asset-web';
      const product = products[p.unitProductCode];
      const hdOnly = p.unitProductCode !== 'photo_web';
      if (!product || (hdOnly && web)) return { valid: false, blockers: ['this photo is not available in HD resolution'] };
      return {
        valid: true, blockers: [], authoritative_price: product.price, currency: 'EUR', dodo_product_id: `pdt_${p.unitProductCode}`,
        normalized_product: {
          asset: { id: p.assetId, title: p.assetId, width_px: web ? 1284 : 6000, height_px: web ? 1066 : 4000 },
          license: { id: `lic-${p.licenseTypeCode}`, name: p.licenseTypeCode, code: p.licenseTypeCode },
          product: { id: product.id, name: product.name, product_code: p.unitProductCode, resolution_allowed: hdOnly ? 'hd' : 'web' },
        },
      };
    },
  };
});

import { addCartItem, changeCartItemLicense, getCart, removeCartItem } from '../CartService';

const USER = 'user-1';
const photo = (assetId: string, unitProductCode = 'photo_web') => ({
  itemType: 'asset_license' as const, assetId, unitProductCode,
  licenseTypeCode: unitProductCode === 'photo_hd_extended' ? 'extended' : 'commercial', quantity: 1,
});

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  db.orders = [];
  db.order_items = [];
  db.unit_products = [{ id: 'pack-id', product_code: 'pack_10', price: 150, pack_size: 10, is_active: true }];
  db.payment_product_mappings = [{
    id: 'm1', internal_product_id: 'pack-id', internal_product_type: 'one_time_asset_license',
    environment: 'test', is_active: true, billing_cycle: null, dodo_product_id: 'pdt_pack',
  }];
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test';
});

describe('adding photos to the cart', () => {
  test('a photo is added with its licence and the cart counts one line', async () => {
    const cart = await addCartItem(USER, photo('asset-1', 'photo_hd'));
    expect(cart.lineCount).toBe(1);
    expect(cart.items[0]).toMatchObject({ productCode: 'photo_hd', productName: 'HD Print', unitPrice: 20 });
    expect(cart.total).toBe(20);
  });

  test('the same photo with the same licence cannot be added twice', async () => {
    await addCartItem(USER, photo('asset-1', 'photo_hd'));
    await expect(addCartItem(USER, photo('asset-1', 'photo_hd'))).rejects.toMatchObject({ code: 'already_in_cart', status: 409 });
    expect((await getCart(USER)).lineCount).toBe(1);
  });

  test('the same photo with another licence is a separate line', async () => {
    await addCartItem(USER, photo('asset-1', 'photo_web'));
    const cart = await addCartItem(USER, photo('asset-1', 'photo_hd'));
    expect(cart.lineCount).toBe(2);
    expect(cart.total).toBe(25);
  });

  test('customer-facing names win over names stored in older cart lines', async () => {
    await addCartItem(USER, photo('asset-1', 'photo_web'));
    db.order_items[0].metadata.productName = 'Photo Web';
    const cart = await getCart(USER);
    expect(cart.items[0].productName).toBe('Digital Use');
    expect(cart.items[0].productDescription).toBe('Websites, social media, presentations — up to 1920 px');
  });

  test('a WEB-resolution photo only offers Digital Use as a licence', async () => {
    const cart = await addCartItem(USER, photo('asset-web'));
    expect(cart.items[0].alternatives.map((a) => a.unitProductCode)).toEqual(['photo_web']);
    await expect(addCartItem(USER, photo('asset-web', 'photo_hd'))).rejects.toMatchObject({ code: 'commercial_validation_failed' });
  });
});

describe('a cart with several photos', () => {
  test('10 HD Print photos are billed as one pack, the others per photo', async () => {
    let cart = await getCart(USER);
    for (let i = 1; i <= 12; i++) cart = await addCartItem(USER, photo(`asset-${i}`, 'photo_hd'));
    expect(cart.lineCount).toBe(12);
    expect(cart.subtotal).toBe(240);
    expect(cart.discount).toBe(50);
    expect(cart.total).toBe(190);
    expect(cart.pack).toMatchObject({ packs: 1, size: 10, price: 150 });
  });

  test('digital use and extended photos never count towards the pack', async () => {
    await addCartItem(USER, photo('asset-1', 'photo_web'));
    await addCartItem(USER, photo('asset-2', 'photo_hd_extended'));
    for (let i = 3; i <= 11; i++) await addCartItem(USER, photo(`asset-${i}`, 'photo_hd'));
    const cart = await getCart(USER);
    expect(cart.discount).toBe(0);
    expect(cart.total).toBe(5 + 299 + 9 * 20);
  });

  test('removing a photo drops the pack discount again', async () => {
    let cart = await getCart(USER);
    for (let i = 1; i <= 10; i++) cart = await addCartItem(USER, photo(`asset-${i}`, 'photo_hd'));
    expect(cart.total).toBe(150);
    cart = await removeCartItem(USER, cart.items[0].id);
    expect(cart.lineCount).toBe(9);
    expect(cart.discount).toBe(0);
    expect(cart.total).toBe(180);
  });

  test('changing a licence re-prices the line and can complete a pack', async () => {
    let cart = await getCart(USER);
    for (let i = 1; i <= 9; i++) cart = await addCartItem(USER, photo(`asset-${i}`, 'photo_hd'));
    cart = await addCartItem(USER, photo('asset-10', 'photo_web'));
    expect(cart.total).toBe(180 + 5);
    const webLine = cart.items.find((i) => i.productCode === 'photo_web')!;
    cart = await changeCartItemLicense(USER, webLine.id, { unitProductCode: 'photo_hd', licenseTypeCode: 'commercial' });
    expect(cart.items.filter((i) => i.productCode === 'photo_hd')).toHaveLength(10);
    expect(cart.total).toBe(150);
  });

  test('changing a licence to one already in the cart for that photo is refused', async () => {
    await addCartItem(USER, photo('asset-1', 'photo_web'));
    const cart = await addCartItem(USER, photo('asset-1', 'photo_hd'));
    const webLine = cart.items.find((i) => i.productCode === 'photo_web')!;
    await expect(changeCartItemLicense(USER, webLine.id, { unitProductCode: 'photo_hd', licenseTypeCode: 'commercial' }))
      .rejects.toMatchObject({ code: 'already_in_cart' });
  });
});
