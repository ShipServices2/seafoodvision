// Automatic "Pack 10 HD Print" discount.
// Only HD Print lines (unit product `photo_hd`) count toward a pack: not Digital Use, not HD Extended.
// Every complete block of `size` HD photos is billed as ONE Dodo pack product; the remainder is billed per photo
// (12 HD photos = 1 pack + 2 x 20 EUR). Each photo stays its own order line, so the webhook still creates one licence
// and one download entitlement per photo. Pure functions: no I/O, no rounding surprises (amounts are rounded to cents).

export const PACK_ELIGIBLE_PRODUCT_CODE = 'photo_hd';

export interface PackOffer {
  /** unit_products.id of pack_10 */
  productId: string;
  size: number;
  price: number;
  dodoProductId: string;
}

export interface PackPricingLine {
  productCode: string;
  unitPrice: number;
  quantity: number;
}

export interface PackPricing {
  eligibleCount: number;
  packs: number;
  remainder: number;
  /** Amount taken off the sum of the unit prices (>= 0). */
  discount: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function computePackPricing(lines: PackPricingLine[], offer: Pick<PackOffer, 'size' | 'price'> | null): PackPricing {
  const eligible = lines.filter((line) => line.productCode === PACK_ELIGIBLE_PRODUCT_CODE);
  const eligibleCount = eligible.reduce((sum, line) => sum + line.quantity, 0);
  if (!offer || !Number.isInteger(offer.size) || offer.size <= 0 || !(offer.price > 0)) {
    return { eligibleCount, packs: 0, remainder: eligibleCount, discount: 0 };
  }
  const packs = Math.floor(eligibleCount / offer.size);
  if (packs === 0) return { eligibleCount, packs: 0, remainder: eligibleCount, discount: 0 };
  // All eligible lines are the same product; use the highest unit price so a pack can never be priced above the units it replaces.
  const unitPrice = Math.max(...eligible.map((line) => line.unitPrice));
  const saving = cents(offer.size * unitPrice - offer.price);
  if (saving <= 0) return { eligibleCount, packs: 0, remainder: eligibleCount, discount: 0 };
  return { eligibleCount, packs, remainder: eligibleCount - packs * offer.size, discount: cents(packs * saving) };
}

export interface DodoCartLine {
  productId: string;
  quantity: number;
}

/**
 * Dodo `product_cart` for a set of cart lines: complete blocks of HD photos become pack products,
 * everything else is billed one product per line. Lines with the same Dodo product are merged.
 */
export function buildDodoProductCart(
  lines: Array<PackPricingLine & { dodoProductId: string }>,
  offer: PackOffer | null
): DodoCartLine[] {
  const pricing = computePackPricing(lines, offer);
  const merged = new Map<string, number>();
  const add = (productId: string, quantity: number) => {
    if (quantity > 0) merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  };
  let packedLeft = pricing.packs && offer ? pricing.packs * offer.size : 0;
  if (offer && pricing.packs) add(offer.dodoProductId, pricing.packs);
  for (const line of lines) {
    if (line.productCode === PACK_ELIGIBLE_PRODUCT_CODE && packedLeft > 0) {
      const covered = Math.min(line.quantity, packedLeft);
      packedLeft -= covered;
      add(line.dodoProductId, line.quantity - covered);
    } else {
      add(line.dodoProductId, line.quantity);
    }
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Total Dodo will charge for a product cart (used as a guard against any drift with the stored order total). */
export function productCartTotal(
  productCart: DodoCartLine[],
  prices: Map<string, number>
): number {
  return cents(productCart.reduce((sum, line) => sum + (prices.get(line.productId) ?? NaN) * line.quantity, 0));
}
