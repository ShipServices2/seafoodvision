/**
 * Tests for src/lib/importValidator.ts
 *
 * Covers:
 *  - Technical ID columns (public_asset_id, id, slug, batch_id, etc.) must
 *    NEVER be rejected by the phone-number rule.
 *  - Numeric columns (width, height, confidence_score, technical_score,
 *    commercial_score) must NEVER be rejected by the phone-number rule.
 *  - Real phone numbers in PHONE_SCANNABLE_COLUMNS must be rejected.
 *  - Email, Windows path, GPS coordinates must still be rejected.
 *  - Error reports include row + column + rule.
 *  - SV-B100-* identifiers are accepted.
 */

import {
  validateSensitiveValue,
  scanRowForSensitiveData,
  scanColumnNamesForSensitiveData,
  NUMERIC_COLUMNS,
  PHONE_SCANNABLE_COLUMNS,
  TECHNICAL_ID_COLUMNS,
  isPhoneScannableColumn,
} from '../importValidator';
import { describe, test, expect } from '@jest/globals';

// ---------------------------------------------------------------------------
// Helper: build a minimal valid asset row (mirrors pilot_assets_100_review_clean.csv)
// ---------------------------------------------------------------------------
function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    title: 'Atlantic Salmon',
    public_asset_id: 'SV-B100-0001',
    width: '3840',
    height: '2160',
    confidence_score: '0.67',
    technical_score: '94.4',
    commercial_score: '61.7',
    slug: 'atlantic-salmon-sv-b100-0001',
    batch_id: 'batch-2026-000100',
    ...overrides,
  };
}

// ===========================================================================
// 1. TECHNICAL ID COLUMNS — SV-B100-* identifiers must be accepted
// ===========================================================================
describe('Technical ID columns — SV-B100-* identifiers accepted', () => {
  test('public_asset_id=SV-B100-0001 is accepted', () => {
    const result = validateSensitiveValue('public_asset_id', 'SV-B100-0001');
    expect(result.matched).toBe(false);
  });

  test('public_asset_id=SV-B100-0006 is accepted', () => {
    const result = validateSensitiveValue('public_asset_id', 'SV-B100-0006');
    expect(result.matched).toBe(false);
  });

  test('public_asset_id=SV-B100-0100 is accepted', () => {
    const result = validateSensitiveValue('public_asset_id', 'SV-B100-0100');
    expect(result.matched).toBe(false);
  });

  test('public_asset_id=SV-PILOT-0008 is accepted', () => {
    const result = validateSensitiveValue('public_asset_id', 'SV-PILOT-0008');
    expect(result.matched).toBe(false);
  });

  test('slug=frozen-fish-2026-001 is accepted', () => {
    const result = validateSensitiveValue('slug', 'frozen-fish-2026-001');
    expect(result.matched).toBe(false);
  });

  test('batch_id=batch-2026-000100 is accepted', () => {
    const result = validateSensitiveValue('batch_id', 'batch-2026-000100');
    expect(result.matched).toBe(false);
  });

  test('id=SV-B100-0050 is accepted', () => {
    const result = validateSensitiveValue('id', 'SV-B100-0050');
    expect(result.matched).toBe(false);
  });

  test('asset_id=SV-B100-0099 is accepted', () => {
    const result = validateSensitiveValue('asset_id', 'SV-B100-0099');
    expect(result.matched).toBe(false);
  });

  test('checksum=SHA-256-abc123def456 is accepted', () => {
    const result = validateSensitiveValue('checksum', 'SHA-256-abc123def456');
    expect(result.matched).toBe(false);
  });

  test('thumbnail_path=/thumbnails/sv-b100-0001.jpg is accepted', () => {
    const result = validateSensitiveValue('thumbnail_path', '/thumbnails/sv-b100-0001.jpg');
    expect(result.matched).toBe(false);
  });

  test('full row with SV-B100-0001 is accepted', () => {
    const row = makeRow({ public_asset_id: 'SV-B100-0001' });
    const result = scanRowForSensitiveData(row);
    expect(result).toBeNull();
  });

  test('full row with SV-B100-0100 is accepted', () => {
    const row = makeRow({ public_asset_id: 'SV-B100-0100' });
    const result = scanRowForSensitiveData(row);
    expect(result).toBeNull();
  });

  test('TECHNICAL_ID_COLUMNS contains public_asset_id', () => {
    expect(TECHNICAL_ID_COLUMNS.has('public_asset_id')).toBe(true);
  });

  test('TECHNICAL_ID_COLUMNS contains slug', () => {
    expect(TECHNICAL_ID_COLUMNS.has('slug')).toBe(true);
  });

  test('isPhoneScannableColumn returns false for public_asset_id', () => {
    expect(isPhoneScannableColumn('public_asset_id')).toBe(false);
  });

  test('isPhoneScannableColumn returns false for slug', () => {
    expect(isPhoneScannableColumn('slug')).toBe(false);
  });

  test('isPhoneScannableColumn returns false for batch_id', () => {
    expect(isPhoneScannableColumn('batch_id')).toBe(false);
  });
});

// ===========================================================================
// 2. NUMERIC COLUMNS — must be accepted (no false positives)
// ===========================================================================
describe('Numeric columns — no false positives', () => {
  test('width=3840 is accepted', () => {
    const result = validateSensitiveValue('width', '3840');
    expect(result.matched).toBe(false);
  });

  test('height=2160 is accepted', () => {
    const result = validateSensitiveValue('height', '2160');
    expect(result.matched).toBe(false);
  });

  test('width=6000 is accepted', () => {
    const result = validateSensitiveValue('width', '6000');
    expect(result.matched).toBe(false);
  });

  test('height=4000 is accepted', () => {
    const result = validateSensitiveValue('height', '4000');
    expect(result.matched).toBe(false);
  });

  test('confidence_score=0.67 is accepted', () => {
    const result = validateSensitiveValue('confidence_score', '0.67');
    expect(result.matched).toBe(false);
  });

  test('technical_score=94.4 is accepted', () => {
    const result = validateSensitiveValue('technical_score', '94.4');
    expect(result.matched).toBe(false);
  });

  test('commercial_score=61.7 is accepted', () => {
    const result = validateSensitiveValue('commercial_score', '61.7');
    expect(result.matched).toBe(false);
  });

  test('full row with 4K resolution is accepted', () => {
    const row = makeRow({ width: '3840', height: '2160' });
    const result = scanRowForSensitiveData(row);
    expect(result).toBeNull();
  });

  test('full row with 6000×4000 resolution is accepted', () => {
    const row = makeRow({ width: '6000', height: '4000' });
    const result = scanRowForSensitiveData(row);
    expect(result).toBeNull();
  });

  test('NUMERIC_COLUMNS set contains all expected columns', () => {
    expect(NUMERIC_COLUMNS.has('width')).toBe(true);
    expect(NUMERIC_COLUMNS.has('height')).toBe(true);
    expect(NUMERIC_COLUMNS.has('confidence_score')).toBe(true);
    expect(NUMERIC_COLUMNS.has('technical_score')).toBe(true);
    expect(NUMERIC_COLUMNS.has('commercial_score')).toBe(true);
  });

  test('isPhoneScannableColumn returns false for width', () => {
    expect(isPhoneScannableColumn('width')).toBe(false);
  });

  test('isPhoneScannableColumn returns false for height', () => {
    expect(isPhoneScannableColumn('height')).toBe(false);
  });
});

// ===========================================================================
// 3. PHONE_SCANNABLE_COLUMNS — phone rule only applies here
// ===========================================================================
describe('PHONE_SCANNABLE_COLUMNS — phone rule scope', () => {
  test('PHONE_SCANNABLE_COLUMNS contains title', () => {
    expect(PHONE_SCANNABLE_COLUMNS.has('title')).toBe(true);
  });

  test('PHONE_SCANNABLE_COLUMNS contains description', () => {
    expect(PHONE_SCANNABLE_COLUMNS.has('description')).toBe(true);
  });

  test('PHONE_SCANNABLE_COLUMNS contains notes', () => {
    expect(PHONE_SCANNABLE_COLUMNS.has('notes')).toBe(true);
  });

  test('PHONE_SCANNABLE_COLUMNS contains user_notes', () => {
    expect(PHONE_SCANNABLE_COLUMNS.has('user_notes')).toBe(true);
  });

  test('isPhoneScannableColumn returns true for description', () => {
    expect(isPhoneScannableColumn('description')).toBe(true);
  });

  test('isPhoneScannableColumn returns true for notes', () => {
    expect(isPhoneScannableColumn('notes')).toBe(true);
  });

  test('isPhoneScannableColumn returns false for public_asset_id', () => {
    expect(isPhoneScannableColumn('public_asset_id')).toBe(false);
  });
});

// ===========================================================================
// 4. PHONE NUMBERS in text columns — must be rejected
// ===========================================================================
describe('Phone numbers in text columns — rejected', () => {
  test('"+221 77 123 45 67" in notes is rejected', () => {
    const result = validateSensitiveValue('notes', '+221 77 123 45 67');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Phone number');
    expect(result.columnName).toBe('notes');
  });

  test('"01 42 86 00 00" in description is rejected', () => {
    const result = validateSensitiveValue('description', '01 42 86 00 00');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Phone number');
    expect(result.columnName).toBe('description');
  });

  test('"(221) 33 800 00 00" in contact is rejected', () => {
    const result = validateSensitiveValue('contact', '(221) 33 800 00 00');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Phone number');
  });

  test('"Call +221 77 123 45 67" in description is rejected', () => {
    const result = validateSensitiveValue('description', 'Call +221 77 123 45 67');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Phone number');
  });

  test('"Telephone 01 42 86 00 00" in notes is rejected', () => {
    const result = validateSensitiveValue('notes', 'Telephone 01 42 86 00 00');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Phone number');
  });

  test('row with phone in user_notes is rejected with correct column name', () => {
    const row = makeRow({ user_notes: '+221 77 123 45 67' });
    const result = scanRowForSensitiveData(row);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('user_notes');
    expect(result!.rejectionType).toBe('Phone number');
    expect(result!.rawValue).toBe('+221 77 123 45 67');
  });

  test('row with phone in description is rejected with correct column name', () => {
    const row = makeRow({ description: '01 42 86 00 00' });
    const result = scanRowForSensitiveData(row);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('description');
    expect(result!.rejectionType).toBe('Phone number');
  });
});

// ===========================================================================
// 5. OTHER SECURITY RULES — must still be rejected
// ===========================================================================
describe('Other security rules — still enforced', () => {
  test('real email address is rejected', () => {
    const result = validateSensitiveValue('contact', 'user@example.com');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Email address');
  });

  test('Windows path C:\\ is rejected', () => {
    const result = validateSensitiveValue('file_path', 'C:\\Users\\john\\photo.jpg');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Windows absolute path (C:\\)');
  });

  test('GPS decimal coordinates are rejected', () => {
    const result = validateSensitiveValue('location', '48.8566, 2.3522');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('GPS decimal coordinates');
  });

  test('macOS user path is rejected', () => {
    const result = validateSensitiveValue('path', '/Users/john/Desktop/photo.jpg');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('macOS user path (/Users/)');
  });

  test('Dropbox path is rejected', () => {
    const result = validateSensitiveValue('source', 'dropbox/photos/salmon.jpg');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Dropbox path');
  });

  test('SQLite file reference is rejected', () => {
    const result = validateSensitiveValue('db', 'catalog.sqlite3');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('SQLite file reference');
  });

  test('original file path is rejected', () => {
    const result = validateSensitiveValue('storage', '/originals/salmon.jpg');
    expect(result.matched).toBe(true);
    expect(result.rejectionType).toBe('Original file path');
  });

  test('row with email is rejected with correct column name', () => {
    const row = makeRow({ contact_email: 'user@example.com' });
    const result = scanRowForSensitiveData(row);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('contact_email');
    expect(result!.rejectionType).toBe('Email address');
  });

  test('row with Windows path is rejected with correct column name', () => {
    const row = makeRow({ source_path: 'C:\\Photos\\salmon.jpg' });
    const result = scanRowForSensitiveData(row);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('source_path');
    expect(result!.rejectionType).toBe('Windows absolute path (C:\\)');
  });

  test('row with GPS coordinates is rejected with correct column name', () => {
    const row = makeRow({ gps_data: '48.8566, 2.3522' });
    const result = scanRowForSensitiveData(row);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('gps_data');
    expect(result!.rejectionType).toBe('GPS decimal coordinates');
  });
});

// ===========================================================================
// 6. COLUMN NAME SCANNING
// ===========================================================================
describe('Column name scanning', () => {
  test('column named "password" is rejected', () => {
    const result = scanColumnNamesForSensitiveData(['title', 'password', 'width']);
    expect(result).not.toBeNull();
    expect(result!.columnName).toBe('password');
  });

  test('clean column names are accepted', () => {
    const result = scanColumnNamesForSensitiveData([
      'title', 'width', 'height', 'confidence_score', 'technical_score', 'commercial_score',
      'description', 'keywords', 'category', 'species_common_name', 'public_asset_id',
      'slug', 'batch_id', 'checksum', 'thumbnail_path', 'preview_path',
    ]);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// 7. RESULT STRUCTURE — row + column + rule
// ===========================================================================
describe('Result structure — row + column + rule', () => {
  test('validateSensitiveValue returns correct structure on match', () => {
    const result = validateSensitiveValue('notes', '+221 77 123 45 67');
    expect(result).toMatchObject({
      matched: true,
      rejectionType: 'Phone number',
      columnName: 'notes',
      rawValue: '+221 77 123 45 67',
    });
  });

  test('validateSensitiveValue returns correct structure on no match', () => {
    const result = validateSensitiveValue('width', '3840');
    expect(result).toMatchObject({
      matched: false,
      rejectionType: null,
      columnName: 'width',
      rawValue: '3840',
    });
  });

  test('scanRowForSensitiveData returns null for a clean row', () => {
    const row = makeRow();
    expect(scanRowForSensitiveData(row)).toBeNull();
  });

  test('scanRowForSensitiveData returns { columnName, rejectionType, rawValue } on match', () => {
    const row = makeRow({ notes: '+221 77 123 45 67' });
    const result = scanRowForSensitiveData(row);
    expect(result).toEqual({
      columnName: 'notes',
      rejectionType: 'Phone number',
      rawValue: '+221 77 123 45 67',
    });
  });
});

// ===========================================================================
// 8. CLIENT / SERVER PARITY — same result for the same input
// ===========================================================================
describe('Client / server parity', () => {
  const testCases: Array<{ col: string; val: string; shouldMatch: boolean; rule?: string }> = [
    // Technical IDs — never phone-scanned
    { col: 'public_asset_id', val: 'SV-B100-0001', shouldMatch: false },
    { col: 'public_asset_id', val: 'SV-B100-0006', shouldMatch: false },
    { col: 'public_asset_id', val: 'SV-B100-0100', shouldMatch: false },
    { col: 'public_asset_id', val: 'SV-PILOT-0008', shouldMatch: false },
    { col: 'slug', val: 'frozen-fish-2026-001', shouldMatch: false },
    { col: 'batch_id', val: 'batch-2026-000100', shouldMatch: false },
    // Numeric columns
    { col: 'width', val: '3840', shouldMatch: false },
    { col: 'height', val: '2160', shouldMatch: false },
    { col: 'width', val: '6000', shouldMatch: false },
    { col: 'height', val: '4000', shouldMatch: false },
    { col: 'confidence_score', val: '0.67', shouldMatch: false },
    { col: 'technical_score', val: '94.4', shouldMatch: false },
    { col: 'commercial_score', val: '61.7', shouldMatch: false },
    // Phone in scannable columns — rejected
    { col: 'notes', val: '+221 77 123 45 67', shouldMatch: true, rule: 'Phone number' },
    { col: 'description', val: '01 42 86 00 00', shouldMatch: true, rule: 'Phone number' },
    // Other security rules
    { col: 'email', val: 'user@example.com', shouldMatch: true, rule: 'Email address' },
    { col: 'path', val: 'C:\\Users\\john\\photo.jpg', shouldMatch: true, rule: 'Windows absolute path (C:\\)' },
    { col: 'location', val: '48.8566, 2.3522', shouldMatch: true, rule: 'GPS decimal coordinates' },
  ];

  testCases.forEach(({ col, val, shouldMatch, rule }) => {
    test(`col="${col}" val="${val}" → matched=${shouldMatch}${rule ? ` (${rule})` : ''}`, () => {
      const result = validateSensitiveValue(col, val);
      expect(result.matched).toBe(shouldMatch);
      if (rule) expect(result.rejectionType).toBe(rule);
    });
  });
});
