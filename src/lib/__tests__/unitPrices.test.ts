import { describe, expect, test } from '@jest/globals';
import { promoDisplay, toUnitPrice } from '../unitPrices';

const END = '2027-01-31T23:59:59+00:00';

describe('promotion display (prices come from the database)', () => {
  test('shows the struck-through normal price and the end date while the promotion runs', () => {
    const view = promoDisplay({ price: 5, listPrice: 15, promoEndsAt: END }, new Date('2026-10-09T10:00:00Z'));
    expect(view).toEqual({ price: 5, strikePrice: 15, endsOn: '31 Jan 2027' });
  });

  test('still shown during the last day, gone right after', () => {
    expect(promoDisplay({ price: 20, listPrice: 39, promoEndsAt: END }, new Date('2027-01-31T23:00:00Z')).strikePrice).toBe(39);
    expect(promoDisplay({ price: 20, listPrice: 39, promoEndsAt: END }, new Date('2027-02-01T00:00:00Z')).strikePrice).toBeNull();
  });

  test('no strike-through when the normal price equals the price (extended licence 299 = 299)', () => {
    const view = promoDisplay({ price: 299, listPrice: 299, promoEndsAt: END }, new Date('2026-10-09T10:00:00Z'));
    expect(view).toEqual({ price: 299, strikePrice: null, endsOn: null });
  });

  test('no promotion data: plain price', () => {
    expect(promoDisplay({ price: 40, listPrice: null, promoEndsAt: null })).toEqual({ price: 40, strikePrice: null, endsOn: null });
  });

  test('maps a unit_products row (numeric strings from the API)', () => {
    expect(toUnitPrice({ product_code: 'pack_10', currency: 'EUR', price: '150.00', list_price: '290.00', promo_ends_at: END, pack_size: 10 }))
      .toEqual({ code: 'pack_10', currency: 'EUR', price: 150, listPrice: 290, promoEndsAt: END, packSize: 10 });
  });
});
