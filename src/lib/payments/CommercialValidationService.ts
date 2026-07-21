import { createServiceClient } from '@/lib/supabase/server';
import { canonicalPlanCode } from './subscriptionPlanResolution';

export { canonicalPlanCode } from './subscriptionPlanResolution';

type CommerceClient = ReturnType<typeof createServiceClient>;
type BillingCycle = 'monthly' | 'annual';
type Environment = 'test' | 'production';

export interface CommercialAssetSnapshot {
  id?: string;
  media_type: string | null;
  review_status: string | null;
  publication_status: string | null;
  commercial_use: boolean | null;
  license_type: string | null;
  restrictions: string | null;
  is_demo: boolean | null;
  asset_readiness:
    | {
        technical_quality: boolean | null;
        rights_verified: boolean | null;
        original_available: boolean | null;
        license_ready: boolean | null;
        publication_ready: boolean | null;
      }
    | Array<{
        technical_quality: boolean | null;
        rights_verified: boolean | null;
        original_available: boolean | null;
        license_ready: boolean | null;
        publication_ready: boolean | null;
      }>
    | null;
  asset_files: Array<{
    file_level: string | null;
    storage_bucket?: string | null;
    storage_path?: string | null;
    mime_type?: string | null;
  }> | null;
}

export function isValidMoney(value: unknown): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function isValidCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

export function getCommercialAssetBlockers(asset: CommercialAssetSnapshot): string[] {
  const readinessRows = Array.isArray(asset.asset_readiness)
    ? asset.asset_readiness
    : asset.asset_readiness
      ? [asset.asset_readiness]
      : [];
  const readiness = readinessRows[0];
  const original = (asset.asset_files ?? []).find((file) => file.file_level === 'original');
  const blockers: string[] = [];

  if (asset.media_type !== 'photo') blockers.push('asset is not a photo');
  if (!['approved', 'commercial'].includes(asset.review_status ?? '')) blockers.push('asset is not approved');
  if (!['published', 'commercial'].includes(asset.publication_status ?? '')) blockers.push('asset is not published for commerce');
  if (!asset.commercial_use) blockers.push('commercial use is not permitted');
  if (!asset.license_type || asset.license_type === 'none') blockers.push('asset commercial rights are missing');
  if (asset.is_demo) blockers.push('demo assets cannot be purchased');
  if (asset.restrictions) blockers.push('asset has unresolved restrictions');
  if (!readiness?.technical_quality) blockers.push('technical review is incomplete');
  if (!readiness?.rights_verified) blockers.push('rights are not verified');
  if (!readiness?.license_ready) blockers.push('license readiness is incomplete');
  if (!readiness?.publication_ready) blockers.push('publication readiness is incomplete');
  if (!readiness?.original_available || !original) blockers.push('original file is not available');
  if (original && (!original.storage_bucket || !original.storage_path)) blockers.push('original storage source is incomplete');

  return blockers;
}

export interface CommercialValidationResult<T = unknown> {
  valid: boolean;
  blockers: string[];
  normalized_product: T | null;
  authoritative_price: number | null;
  currency: string | null;
  dodo_product_id: string | null;
  fulfillment_metadata: Record<string, unknown>;
}

function invalid<T>(blockers: string[], product: T | null = null): CommercialValidationResult<T> {
  return {
    valid: false,
    blockers,
    normalized_product: product,
    authoritative_price: null,
    currency: null,
    dodo_product_id: null,
    fulfillment_metadata: {},
  };
}

export async function validateAssetLicensePurchase(
  params: {
    assetId: string;
    licenseTypeCode: string;
    unitProductCode: string;
    environment: Environment;
  },
  client: CommerceClient = createServiceClient()
): Promise<CommercialValidationResult> {
  const [{ data: asset }, { data: license }, { data: product }] = await Promise.all([
    client.from('assets').select(`
      id, public_asset_id, title, slug, media_type, review_status, publication_status,
      commercial_use, license_type, restrictions, is_demo,
      asset_readiness(technical_quality, rights_verified, original_available, license_ready, publication_ready),
      asset_files(file_level, storage_bucket, storage_path, mime_type)
    `).eq('id', params.assetId).maybeSingle(),
    client.from('license_types').select('*').eq('code', params.licenseTypeCode).maybeSingle(),
    client.from('unit_products').select('*').eq('product_code', params.unitProductCode).maybeSingle(),
  ]);

  if (!asset) return invalid(['asset not found']);
  const blockers = getCommercialAssetBlockers(asset as CommercialAssetSnapshot);
  if (!license) blockers.push('license type not found');
  else {
    if (!license.is_active) blockers.push('license type is inactive');
    if (license.is_exclusive) {
      const { data: soldExclusive } = await client
        .from('purchased_licenses')
        .select('id')
        .eq('asset_id', params.assetId)
        .eq('license_type_id', license.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (soldExclusive) blockers.push('exclusive license has already been sold');
    }
    const assetLicense = asset.license_type;
    const allowed = assetLicense === params.licenseTypeCode
      || (assetLicense === 'commercial' && ['commercial', 'extended', 'exclusive'].includes(params.licenseTypeCode));
    if (!allowed) blockers.push('license is not allowed for this asset');
  }

  if (!product) blockers.push('unit product not found');
  else {
    if (!product.is_active) blockers.push('unit product is inactive');
    if (!isValidMoney(product.price)) blockers.push('unit product price is invalid');
    if (!isValidCurrency(product.currency)) blockers.push('unit product currency is invalid');
    if (product.license_type_code && product.license_type_code !== params.licenseTypeCode) {
      blockers.push('unit product does not match the requested license');
    }
  }

  let mapping: { dodo_product_id: string | null } | null = null;
  if (product) {
    const result = await client
      .from('payment_product_mappings')
      .select('dodo_product_id')
      .eq('internal_product_type', 'one_time_asset_license')
      .eq('internal_product_id', product.id)
      .eq('environment', params.environment)
      .eq('is_active', true)
      .is('billing_cycle', null)
      .maybeSingle();
    mapping = result.data;
    if (!mapping?.dodo_product_id) blockers.push('Dodo mapping is missing for the unit product');
  }

  if (blockers.length || !license || !product || !mapping?.dodo_product_id) return invalid(blockers);
  return {
    valid: true,
    blockers: [],
    normalized_product: { asset, license, product },
    authoritative_price: Number(product.price),
    currency: product.currency,
    dodo_product_id: mapping.dodo_product_id,
    fulfillment_metadata: {
      assetId: asset.id,
      licenseTypeId: license.id,
      unitProductId: product.id,
      resolutionAllowed: product.resolution_allowed,
      downloadQuota: product.download_quota,
    },
  };
}

export async function validateCreditPackPurchase(
  params: { packCode: string; environment: Environment },
  client: CommerceClient = createServiceClient()
): Promise<CommercialValidationResult> {
  const { data: pack } = await client.from('credit_packs').select('*').eq('pack_code', params.packCode).maybeSingle();
  if (!pack) return invalid(['credit pack not found']);
  const blockers: string[] = [];
  if (!pack.is_active) blockers.push('credit pack is inactive');
  if (!Number.isInteger(Number(pack.credits)) || Number(pack.credits) <= 0) blockers.push('credit amount is invalid');
  if (!isValidMoney(pack.price)) blockers.push('credit pack price is invalid');
  if (!isValidCurrency(pack.currency)) blockers.push('credit pack currency is invalid');

  const { data: mapping } = await client
    .from('payment_product_mappings')
    .select('dodo_product_id')
    .eq('internal_product_type', 'credit_pack')
    .eq('internal_product_id', pack.id)
    .eq('environment', params.environment)
    .eq('is_active', true)
    .is('billing_cycle', null)
    .maybeSingle();
  const dodoProductId = mapping?.dodo_product_id ?? null;
  if (!dodoProductId) blockers.push('Dodo mapping is missing for the credit pack');
  if (blockers.length) return invalid(blockers, pack);

  return {
    valid: true,
    blockers: [],
    normalized_product: pack,
    authoritative_price: Number(pack.price),
    currency: pack.currency,
    dodo_product_id: dodoProductId,
    fulfillment_metadata: { packId: pack.id, packCode: pack.pack_code, credits: Number(pack.credits) },
  };
}

export async function validateSubscriptionPurchase(
  params: { userId: string; planCode: string; billingCycle: BillingCycle; environment: Environment },
  client: CommerceClient = createServiceClient()
): Promise<CommercialValidationResult> {
  const canonicalCode = canonicalPlanCode(params.planCode);
  const { data: plans, error: planError } = await client
    .from('pricing_plans')
    .select('*')
    .in('plan_code', [canonicalCode, `${canonicalCode}_monthly`, `${canonicalCode}_annual`])
    .eq('is_active', true);
  if (planError) return invalid([`subscription catalog lookup failed: ${planError.message}`]);
  const plan = (plans ?? []).find((candidate) => candidate.plan_code === canonicalCode) ?? plans?.[0] ?? null;
  if (!plan) return invalid([`subscription plan ${canonicalCode} not found or inactive`]);

  const blockers: string[] = [];
  if (!['monthly', 'annual'].includes(params.billingCycle)) blockers.push('billing cycle is invalid');
  const price = params.billingCycle === 'annual' ? Number(plan.price_annual) : Number(plan.price_monthly);
  if (!isValidMoney(price)) blockers.push(`${params.billingCycle} price is unavailable`);
  if (!isValidCurrency(plan.currency)) blockers.push('subscription currency is invalid');

  const [{ data: mapping }, { data: activeSubscription }] = await Promise.all([
    client.from('payment_product_mappings')
      .select('dodo_product_id')
      .eq('internal_product_type', 'subscription_plan')
      .eq('internal_product_id', plan.id)
      .eq('environment', params.environment)
      .eq('billing_cycle', params.billingCycle)
      .eq('is_active', true)
      .maybeSingle(),
    client.from('user_subscriptions')
      .select('id')
      .eq('user_id', params.userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle(),
  ]);
  const dodoProductId = mapping?.dodo_product_id ?? null;
  if (!dodoProductId) blockers.push(`Dodo ${params.billingCycle} mapping is missing for this plan`);
  if (activeSubscription) blockers.push('user already has an active subscription');
  if (blockers.length) return invalid(blockers, plan);

  return {
    valid: true,
    blockers: [],
    normalized_product: { ...plan, canonical_plan_code: canonicalCode, billing_cycle: params.billingCycle },
    authoritative_price: price,
    currency: plan.currency,
    dodo_product_id: dodoProductId,
    fulfillment_metadata: { planId: plan.id, planCode: canonicalCode, billingCycle: params.billingCycle },
  };
}

export function assertCommercialValidation<T>(
  result: CommercialValidationResult<T>,
  context: string
): asserts result is CommercialValidationResult<T> & {
  valid: true;
  normalized_product: T;
  authoritative_price: number;
  currency: string;
  dodo_product_id: string;
} {
  if (!result.valid) {
    throw new Error(`${context}: ${result.blockers.join('; ')}`);
  }
}
