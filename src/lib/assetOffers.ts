// Which unit products an asset can be sold as, from its resolution.
// WEB-resolution photos (< 4 MP) are sold as "Photo Web" only; HD photos (>= 4 MP) also as "Photo HD" and with the extended licence.
// Shared by the asset page (what is displayed) and CommercialValidationService (what the server accepts).

export const HD_MIN_PIXELS = 4_000_000;

/** Unit products that need an HD-resolution original. */
export const HD_ONLY_UNIT_PRODUCTS: readonly string[] = ['photo_hd', 'photo_hd_extended', 'photo_ultrahd'];

export function isHdResolution(widthPx: number | null | undefined, heightPx: number | null | undefined): boolean {
  return (widthPx ?? 0) * (heightPx ?? 0) >= HD_MIN_PIXELS;
}

export function isUnitProductAvailableForResolution(
  unitProductCode: string,
  widthPx: number | null | undefined,
  heightPx: number | null | undefined
): boolean {
  return !HD_ONLY_UNIT_PRODUCTS.includes(unitProductCode) || isHdResolution(widthPx, heightPx);
}
