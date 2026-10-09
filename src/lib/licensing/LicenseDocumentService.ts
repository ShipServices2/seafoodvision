import { createServiceClient } from '@/lib/supabase/server';
import { deliveredFileLevel } from '@/lib/downloads/fileSelection';
import { LICENSE_DOCUMENTS_BUCKET, LICENSOR_NAME } from './config';
import { buildLicensePdf, licenseNumberFor, type LicenseCertificateData } from './licensePdf';

type Client = ReturnType<typeof createServiceClient>;

export class LicenseDocumentError extends Error {
  constructor(public readonly code: 'not_found' | 'forbidden' | 'not_active' | 'storage_failed', message: string, public readonly status: number) {
    super(message);
    this.name = 'LicenseDocumentError';
  }
}

interface StoredPdfRef { path: string; number: string; generatedAt: string }

async function ensureBucket(client: Client): Promise<void> {
  const { data } = await client.storage.getBucket(LICENSE_DOCUMENTS_BUCKET);
  if (data) return;
  const { error } = await client.storage.createBucket(LICENSE_DOCUMENTS_BUCKET, {
    public: false,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: 2 * 1024 * 1024,
  });
  // A concurrent first request may have created it already.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new LicenseDocumentError('storage_failed', `Unable to prepare licence storage: ${error.message}`, 500);
  }
}

/**
 * Returns the licence certificate PDF of a purchased licence owned by `userId`.
 * Generated on the first request only (never in the webhook), then stored privately and reused.
 */
export async function getOrCreateLicensePdf(
  userId: string,
  licenseId: string,
  client: Client = createServiceClient()
): Promise<{ bytes: Uint8Array; licenseNumber: string; reused: boolean }> {
  const { data: license } = await client
    .from('purchased_licenses')
    .select(`
      id, user_id, asset_id, order_id, license_type_id, terms_version, purchased_at, status, metadata,
      asset:assets(public_asset_id, title),
      license_type:license_types(name, code, description, rights_allowed, restrictions, territory, duration_months, max_users),
      order:orders(order_number)
    `)
    .eq('id', licenseId)
    .maybeSingle();

  if (!license) throw new LicenseDocumentError('not_found', 'Licence not found', 404);
  if (license.user_id !== userId) throw new LicenseDocumentError('forbidden', 'Forbidden', 403);
  if (license.status !== 'active') throw new LicenseDocumentError('not_active', `Licence is ${license.status}`, 403);

  const issuedAt = new Date(license.purchased_at ?? Date.now());
  const licenseNumber = licenseNumberFor(license.id, issuedAt);
  const metadata = (license.metadata ?? {}) as Record<string, unknown>;

  // Reuse the stored certificate when there is one.
  const stored = metadata.licensePdf as StoredPdfRef | undefined;
  if (stored?.path) {
    const { data: file } = await client.storage.from(LICENSE_DOCUMENTS_BUCKET).download(stored.path);
    if (file) return { bytes: new Uint8Array(await file.arrayBuffer()), licenseNumber: stored.number, reused: true };
  }

  const asset = license.asset as unknown as { public_asset_id: string; title: string | null } | null;
  const licenseType = license.license_type as unknown as {
    name: string; code: string; description: string | null; rights_allowed: string[] | null; restrictions: string[] | null;
    territory: string | null; duration_months: number | null; max_users: number | null;
  } | null;
  const order = license.order as unknown as { order_number: string } | null;
  if (!asset || !licenseType || !order) throw new LicenseDocumentError('not_found', 'Licence data is incomplete', 404);

  const resolution = String(metadata.resolutionAllowed ?? 'hd');
  const unitProductId = metadata.unitProductId ? String(metadata.unitProductId) : null;
  const [profileResult, productResult, fileResult] = await Promise.all([
    client.from('profiles').select('display_name, email, company').eq('id', userId).maybeSingle(),
    unitProductId ? client.from('unit_products').select('name').eq('id', unitProductId).maybeSingle() : Promise.resolve({ data: null }),
    client.from('asset_files').select('width_px, height_px').eq('asset_id', license.asset_id).eq('file_level', deliveredFileLevel(resolution)).maybeSingle(),
  ]);
  const profile = profileResult.data;
  const file = fileResult.data;

  const certificate: LicenseCertificateData = {
    licenseNumber,
    orderNumber: order.order_number,
    buyerName: profile?.display_name || profile?.email || 'Licensee',
    buyerEmail: profile?.email ?? null,
    buyerCompany: profile?.company ?? null,
    assetPublicId: asset.public_asset_id,
    assetTitle: asset.title,
    productName: productResult.data?.name ?? licenseType.name,
    licenseTypeName: licenseType.name,
    licenseTypeDescription: licenseType.description,
    resolution,
    deliveredFile: file?.width_px && file?.height_px ? `${file.width_px} x ${file.height_px} px` : 'as delivered',
    issuedAt,
    termsVersion: license.terms_version,
    rights: licenseType.rights_allowed ?? [],
    restrictions: licenseType.restrictions ?? [],
    territory: licenseType.territory,
    durationMonths: licenseType.duration_months,
    maxUsers: licenseType.max_users,
    licensor: LICENSOR_NAME,
  };
  const bytes = await buildLicensePdf(certificate);

  await ensureBucket(client);
  const path = `${userId}/${license.id}.pdf`;
  const { error: uploadError } = await client.storage
    .from(LICENSE_DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw new LicenseDocumentError('storage_failed', `Unable to store the licence: ${uploadError.message}`, 500);

  const ref: StoredPdfRef = { path, number: licenseNumber, generatedAt: new Date().toISOString() };
  await client
    .from('purchased_licenses')
    .update({ metadata: { ...metadata, licensePdf: ref }, updated_at: new Date().toISOString() })
    .eq('id', license.id);

  return { bytes, licenseNumber, reused: false };
}
