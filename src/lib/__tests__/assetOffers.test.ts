import { describe, expect, test } from '@jest/globals';
import { HD_MIN_PIXELS, isHdResolution, isUnitProductAvailableForResolution } from '../assetOffers';

describe('asset offers by resolution', () => {
  test('HD starts at 4 megapixels', () => {
    expect(HD_MIN_PIXELS).toBe(4_000_000);
    expect(isHdResolution(2000, 2000)).toBe(true);
    expect(isHdResolution(1999, 2000)).toBe(false);
    expect(isHdResolution(null, null)).toBe(false);
  });

  test('WEB-resolution photos are sold as Photo Web only', () => {
    expect(isUnitProductAvailableForResolution('photo_web', 1284, 1066)).toBe(true);
    expect(isUnitProductAvailableForResolution('photo_hd', 1284, 1066)).toBe(false);
    expect(isUnitProductAvailableForResolution('photo_hd_extended', 1284, 1066)).toBe(false);
  });

  test('HD photos can be sold as Web, HD and HD + extended licence', () => {
    for (const code of ['photo_web', 'photo_hd', 'photo_hd_extended']) {
      expect(isUnitProductAvailableForResolution(code, 4000, 3000)).toBe(true);
    }
  });

  test('photos without dimensions are never offered in HD', () => {
    expect(isUnitProductAvailableForResolution('photo_hd', null, null)).toBe(false);
    expect(isUnitProductAvailableForResolution('photo_web', null, null)).toBe(true);
  });
});
