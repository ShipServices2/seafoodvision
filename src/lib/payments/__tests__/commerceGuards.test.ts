import { describe, expect, test } from '@jest/globals';
import {
  getCommercialAssetBlockers,
  type CommercialAssetSnapshot,
} from '../CheckoutService';
import { isWebhookEventDuplicate } from '../WebhookService';

function commercialAsset(
  overrides: Partial<CommercialAssetSnapshot> = {}
): CommercialAssetSnapshot {
  return {
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
    asset_files: [{ file_level: 'original', storage_bucket: 'assets-original', storage_path: 'asset/original.jpg' }],
    ...overrides,
  };
}

describe('commercial asset validation', () => {
  test('allows a fully reviewed and licensable photo', () => {
    expect(getCommercialAssetBlockers(commercialAsset())).toEqual([]);
  });

  test('blocks unresolved rights and an absent original', () => {
    const blockers = getCommercialAssetBlockers(
      commercialAsset({
        asset_readiness: {
          technical_quality: true,
          rights_verified: false,
          original_available: false,
          license_ready: true,
          publication_ready: true,
        },
        asset_files: [{ file_level: 'preview' }],
      })
    );

    expect(blockers).toContain('rights are not verified');
    expect(blockers).toContain('original file is not available');
  });

  test('blocks editorial, demo, restricted, or unpublished assets', () => {
    const blockers = getCommercialAssetBlockers(
      commercialAsset({
        publication_status: 'preview_only',
        license_type: null,
        is_demo: true,
        restrictions: 'third-party brand visible',
      })
    );

    expect(blockers).toEqual(
      expect.arrayContaining([
        'asset is not published for commerce',
        'asset commercial rights are missing',
        'demo assets cannot be purchased',
        'asset has unresolved restrictions',
      ])
    );
  });
});

describe('webhook retry policy', () => {
  test.each(['processed', 'processing', 'ignored_duplicate'])(
    'treats %s as a duplicate',
    (status) => expect(isWebhookEventDuplicate(status)).toBe(true)
  );

  test.each(['received', 'failed'])(
    'allows %s events to be retried',
    (status) => expect(isWebhookEventDuplicate(status)).toBe(false)
  );
});
