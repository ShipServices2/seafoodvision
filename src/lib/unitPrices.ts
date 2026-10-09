// Unit-product prices as displayed on the site. The database (unit_products) is the single source of truth:
// price = amount actually charged, list_price = normal price shown struck through while the launch promotion runs,
// promo_ends_at = last instant of the promotion. src/lib/pricingConfig.ts deliberately holds no unit price.

export interface UnitPrice {
  code: string;
  currency: string;
  price: number;
  listPrice: number | null;
  promoEndsAt: string | null;
  packSize: number | null;
}

export interface UnitPriceRow {
  product_code: string;
  currency: string | null;
  price: number | string | null;
  list_price: number | string | null;
  promo_ends_at: string | null;
  pack_size: number | null;
}

export const UNIT_PRICE_COLUMNS = 'product_code, currency, price, list_price, promo_ends_at, pack_size';

export function toUnitPrice(row: UnitPriceRow): UnitPrice {
  return {
    code: row.product_code,
    currency: row.currency ?? 'EUR',
    price: Number(row.price),
    listPrice: row.list_price == null ? null : Number(row.list_price),
    promoEndsAt: row.promo_ends_at,
    packSize: row.pack_size,
  };
}

export interface PromoDisplay {
  price: number;
  /** Normal price to show struck through, or null when there is no running promotion. */
  strikePrice: number | null;
  /** Human date of the end of the promotion (e.g. "31 Jan 2027"), or null. */
  endsOn: string | null;
}

/** A promotion is shown only while it runs and only when the normal price is really higher than the charged price. */
export function promoDisplay(unit: Pick<UnitPrice, 'price' | 'listPrice' | 'promoEndsAt'>, now: Date = new Date()): PromoDisplay {
  const ends = unit.promoEndsAt ? new Date(unit.promoEndsAt) : null;
  const running = !!ends && !Number.isNaN(ends.getTime()) && ends.getTime() >= now.getTime();
  if (!running || unit.listPrice == null || !(unit.listPrice > unit.price)) {
    return { price: unit.price, strikePrice: null, endsOn: null };
  }
  return {
    price: unit.price,
    strikePrice: unit.listPrice,
    endsOn: ends!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function formatEur(amount: number): string {
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)}€`;
}
