import { describe, expect, test } from '@jest/globals';
import { PDFDocument } from 'pdf-lib';
import { buildLicensePdf, humanizeCode, licenseNumberFor, type LicenseCertificateData } from '../licensing/licensePdf';
import { LICENSOR_NAME } from '../licensing/config';

const data = (overrides: Partial<LicenseCertificateData> = {}): LicenseCertificateData => ({
  licenseNumber: 'SVL-2026-ABCDEF123456',
  orderNumber: 'SV-CART-20261009-AB12CD34',
  buyerName: 'Aïssatou Diop',
  buyerEmail: 'buyer@example.com',
  buyerCompany: 'Poissonnerie Océan',
  assetPublicId: 'SV-IMP-0042',
  assetTitle: 'Red snapper, whole, frozen',
  productName: 'Photo HD',
  licenseTypeName: 'Commercial License',
  licenseTypeDescription: 'For commercial use including advertising and marketing materials.',
  resolution: 'hd',
  deliveredFile: '4608 x 3456 px',
  issuedAt: new Date('2026-10-09T12:00:00Z'),
  termsVersion: '1.0',
  rights: ['advertising', 'marketing', 'product_packaging', 'digital_media'],
  restrictions: ['no_resale', 'no_sublicense'],
  territory: 'worldwide',
  durationMonths: null,
  maxUsers: 1,
  licensor: LICENSOR_NAME,
  ...overrides,
});

describe('licence certificate', () => {
  test('licence number is SVL-<year>-<12 hex>, stable for a given licence and unique per licence', () => {
    const a = licenseNumberFor('3f2a9c1e-77b0-4c3a-9d55-0a1b2c3d4e5f', new Date('2026-10-09T00:00:00Z'));
    expect(a).toBe('SVL-2026-3F2A9C1E77B0');
    expect(licenseNumberFor('3f2a9c1e-77b0-4c3a-9d55-0a1b2c3d4e5f', new Date('2026-10-09T00:00:00Z'))).toBe(a);
    expect(licenseNumberFor('3f2a9c1e-77b1-4c3a-9d55-0a1b2c3d4e5f', new Date('2026-10-09T00:00:00Z'))).not.toBe(a);
  });

  test('default licensor is a configuration constant', () => {
    expect(LICENSOR_NAME).toBe('SeafoodVision');
  });

  test('produces a valid PDF with the licence data', async () => {
    const bytes = await buildLicensePdf(data());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toBe('Licence SVL-2026-ABCDEF123456');
    expect(pdf.getAuthor()).toBe(LICENSOR_NAME);
  });

  test('does not crash on characters the standard fonts cannot encode', async () => {
    const bytes = await buildLicensePdf(data({ buyerName: '田中 太郎 😀', assetTitle: 'Тунец' }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  test('very long terms flow onto extra pages instead of overflowing', async () => {
    const many = Array.from({ length: 80 }, (_, i) => `right_number_${i}`);
    const pdf = await PDFDocument.load(await buildLicensePdf(data({ rights: many, restrictions: many })));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  test('humanizes rights and restrictions codes', () => {
    expect(humanizeCode('no_commercial_advertising')).toBe('No commercial advertising');
  });
});
