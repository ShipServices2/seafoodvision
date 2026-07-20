import { describe, expect, test } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateAssetLicensePurchase,
  validateCreditPackPurchase,
  validateSubscriptionPurchase,
} from '../CommercialValidationService';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260719120000_dodo_test_certain_mappings.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

const certainUnitMappings = [
  ['photo_web', 'pdt_0NjWshHafg7cviI5DWtIC', 5],
  ['photo_hd', 'pdt_0NjWsoHpPgM1pbUVaHJfr', 20],
  ['photo_ultrahd', 'pdt_0NjWsy1RvRix3wTCalm9m', 40],
  ['video', 'pdt_0NjWt709qq5LizExnEFAJ', 75],
  ['view_360', 'pdt_0NjWtHcROzLiZ4zZnNKbo', 50],
  ['pack_10', 'pdt_0NjWtPcFWTkxVoTnssvcD', 150],
] as const;

const certainCreditMappings = [
  ['credits_100', 'pdt_0NjWs5ltiwaGybbv3lt7G', 100, 9],
  ['credits_250', 'pdt_0NjWsGANLBfyWsyQkFPXk', 250, 19],
  ['credits_500', 'pdt_0NjWsPF3TgzjkrKoTEb74', 500, 35],
  ['credits_1000', 'pdt_0NjWsWtbJw11tr0KvWEUh', 1000, 59],
] as const;

const certainSubscriptionMappings = [
  ['explorer', 'monthly', 'pdt_0NjJwwWYNVeTj06MeYCGW', 29],
  ['professional', 'monthly', 'pdt_0NjJxdsjq65AH2w2HuWDL', 79],
  ['business', 'monthly', 'pdt_0NjJyA1OFHe9XEuAT6AIR', 199],
  ['explorer', 'annual', 'pdt_0NjX0mLZim94JaL68vey', 290],
  ['professional', 'annual', 'pdt_0NjX0x2DixcGgjMFi2Ml2', 790],
  ['business', 'annual', 'pdt_0NjX1AAHCwtq0QNpDgY8r', 1990],
] as const;

type QueryResult = { data: unknown; error: null };

function mockClient(results: Record<string, QueryResult[]>, filters: Array<[string, unknown]> = []) {
  return {
    from(table: string) {
      const queryResult = results[table]?.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      for (const method of ['in', 'is', 'limit', 'order']) builder[method] = () => builder;
      builder.maybeSingle = async () => queryResult;
      builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(queryResult).then(resolve, reject);
      return builder;
    },
  };
}

function result(data: unknown): QueryResult {
  return { data, error: null };
}

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('certain Dodo TEST mapping migration', () => {
  const expectedProductIds = [
    ...certainUnitMappings.map((row) => row[1]),
    ...certainCreditMappings.map((row) => row[1]),
    ...certainSubscriptionMappings.map((row) => row[2]),
  ];

  test('contains all sixteen exact, non-empty, syntactically valid Product IDs', () => {
    const productIds = migration.match(/pdt_[A-Za-z0-9]+/g) ?? [];
    expect(new Set(productIds)).toEqual(new Set(expectedProductIds));
    expect(productIds.every((id) => /^pdt_[A-Za-z0-9]+$/.test(id))).toBe(true);
    expect(expectedProductIds.every((id) => id.startsWith('pdt_') && id.length > 4)).toBe(true);
    expect(expectedProductIds).toHaveLength(16);
    expect(new Set(expectedProductIds).size).toBe(16);
  });

  test('preserves the supplied ambiguous characters exactly', () => {
    for (const id of [
      'pdt_0NjWshHafg7cvil5DWtlC',
      'pdt_0NjWtHcROzlLiZ4zZnNKbo',
      'pdt_0NjWtPrFWTkxVoTmssvcD',
      'pdt_0NjJwwWVNeTj06MeYCGW',
    ]) expect(migration).not.toContain(id);
    for (const id of expectedProductIds) expect(migration).toContain(id);
  });

  test('uses pack_10 convention only', () => {
    expect(migration).not.toContain('image_pack_10');
  });

  test('is idempotent and never creates a table', () => {
    expect((migration.match(/ON CONFLICT/g) ?? []).length).toBe(3);
    expect(migration).not.toMatch(/CREATE\s+TABLE/i);
  });

  test.each(['explorer', 'professional', 'business'])(
    '%s monthly and annual mappings use distinct Product IDs',
    (planCode) => {
      const planMappings = certainSubscriptionMappings.filter(([code]) => code === planCode);
      expect(planMappings).toHaveLength(2);
      expect(planMappings[0][2]).not.toBe(planMappings[1][2]);
    }
  );

  test('all four credit packs use distinct Product IDs', () => {
    expect(new Set(certainCreditMappings.map((row) => row[1])).size).toBe(4);
  });

  test('contains no production data mutation', () => {
    const executableSql = migration.replace(/--.*$/gm, '');
    expect(executableSql).not.toContain("'production'");
    expect(executableSql).toContain("'test'::public.dodo_environment");
  });

  test('stores no Product ID in a frontend app or component file', () => {
    const frontendRoots = [join(process.cwd(), 'src/app'), join(process.cwd(), 'src/components')];
    const frontend = frontendRoots.flatMap(listFiles)
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(frontend).not.toMatch(/pdt_[A-Za-z0-9]+/);
  });
});

describe('certain unit-product mappings resolve through server validation', () => {
  test.each(certainUnitMappings)(
    '%s resolves to its Dodo TEST Product ID and authoritative EUR price',
    async (productCode, productId, price) => {
      const filters: Array<[string, unknown]> = [];
      const client = mockClient({
        assets: [result({
          id: 'asset-1', media_type: 'photo', review_status: 'approved',
          publication_status: 'published', commercial_use: true,
          license_type: 'commercial', restrictions: null, is_demo: false,
          asset_readiness: {
            technical_quality: true, rights_verified: true, original_available: true,
            license_ready: true, publication_ready: true,
          },
          asset_files: [{
            file_level: 'original', storage_bucket: 'originals', storage_path: 'asset-1.jpg',
          }],
        })],
        license_types: [result({
          id: 'license-1', code: 'commercial', name: 'Commercial',
          is_active: true, is_exclusive: false,
        })],
        unit_products: [result({
          id: `id-${productCode}`, product_code: productCode, name: productCode,
          price, currency: 'EUR', is_active: true, license_type_code: 'commercial',
          resolution_allowed: productCode, download_quota: productCode === 'pack_10' ? 10 : 1,
        })],
        payment_product_mappings: [result({ dodo_product_id: productId })],
      }, filters);
      const validation = await validateAssetLicensePurchase({
        assetId: 'asset-1', licenseTypeCode: 'commercial',
        unitProductCode: productCode, environment: 'test',
      }, client as never);
      expect(validation.valid).toBe(true);
      expect(validation.dodo_product_id).toBe(productId);
      expect(validation.authoritative_price).toBe(price);
      expect(validation.currency).toBe('EUR');
      expect(filters).toContainEqual(['environment', 'test']);
    }
  );
});

describe('certain credit mappings resolve through server validation', () => {
  test.each(certainCreditMappings)(
    '%s resolves to its Dodo TEST Product ID and internal credit amount',
    async (packCode, productId, credits, price) => {
      const filters: Array<[string, unknown]> = [];
      const client = mockClient({
        credit_packs: [result({
          id: `id-${packCode}`, pack_code: packCode, credits, price,
          currency: 'EUR', is_active: true,
        })],
        payment_product_mappings: [result({ dodo_product_id: productId })],
      }, filters);
      const validation = await validateCreditPackPurchase(
        { packCode, environment: 'test' }, client as never
      );
      expect(validation.valid).toBe(true);
      expect(validation.dodo_product_id).toBe(productId);
      expect(validation.authoritative_price).toBe(price);
      expect(validation.fulfillment_metadata.credits).toBe(credits);
      expect(filters).toContainEqual(['environment', 'test']);
    }
  );

  test('refuses an incoherent currency', async () => {
    const client = mockClient({
      credit_packs: [result({
        id: 'id-credits_100', pack_code: 'credits_100', credits: 100,
        price: 9, currency: 'usd', is_active: true,
      })],
      payment_product_mappings: [result({ dodo_product_id: certainCreditMappings[0][1] })],
    });
    const validation = await validateCreditPackPurchase(
      { packCode: 'credits_100', environment: 'test' }, client as never
    );
    expect(validation.valid).toBe(false);
    expect(validation.blockers).toContain('credit pack currency is invalid');
  });
});

describe('certain subscription mappings resolve by plan plus cycle', () => {
  test.each(certainSubscriptionMappings)(
    '%s %s resolves to its cycle-specific Dodo TEST Product ID',
    async (planCode, billingCycle, productId, expectedPrice) => {
      const filters: Array<[string, unknown]> = [];
      const plan = {
        id: `id-${planCode}`, plan_code: `${planCode}_monthly`,
        price_monthly: planCode === 'professional' ? 79 : planCode === 'explorer' ? 29 : 199,
        price_annual: planCode === 'professional' ? 790 : planCode === 'explorer' ? 290 : 1990,
        currency: 'EUR', is_active: true,
      };
      const client = mockClient({
        pricing_plans: [result([plan])],
        payment_product_mappings: [result({ dodo_product_id: productId })],
        user_subscriptions: [result(null)],
      }, filters);
      const validation = await validateSubscriptionPurchase({
        userId: 'user-1', planCode, billingCycle, environment: 'test',
      }, client as never);
      expect(validation.valid).toBe(true);
      expect(validation.dodo_product_id).toBe(productId);
      expect(validation.authoritative_price).toBe(expectedPrice);
      expect(filters).toContainEqual(['billing_cycle', billingCycle]);
      expect(filters).toContainEqual(['environment', 'test']);
    }
  );

  test('does not fall back from production to a TEST mapping', async () => {
    const filters: Array<[string, unknown]> = [];
    const client = mockClient({
      pricing_plans: [result([{
        id: 'id-professional', plan_code: 'professional_monthly',
        price_monthly: 79, price_annual: 790, currency: 'EUR', is_active: true,
      }])],
      payment_product_mappings: [result(null)],
      user_subscriptions: [result(null)],
    }, filters);
    const validation = await validateSubscriptionPurchase({
      userId: 'user-1', planCode: 'professional', billingCycle: 'monthly', environment: 'production',
    }, client as never);
    expect(validation.valid).toBe(false);
    expect(validation.blockers).toContain('Dodo monthly mapping is missing for this plan');
    expect(filters).toContainEqual(['environment', 'production']);
  });
});

describe('Pricing credit-pack checkout contract', () => {
  const pricingSource = readFileSync(join(process.cwd(), 'src/app/pricing/page.tsx'), 'utf8');
  const resumeSource = readFileSync(
    join(process.cwd(), 'src/app/checkout/resume/CheckoutResumeContent.tsx'),
    'utf8'
  );
  const authSource = readFileSync(join(process.cwd(), 'src/app/auth/AuthForm.tsx'), 'utf8');
  const routeSource = readFileSync(
    join(process.cwd(), 'src/app/api/payments/dodo/credit-checkout/route.ts'),
    'utf8'
  );

  test('renders the four configured packs with an explicit keyboard-accessible button', () => {
    expect(certainCreditMappings.map(([code]) => code)).toEqual([
      'credits_100', 'credits_250', 'credits_500', 'credits_1000',
    ]);
    expect(pricingSource).toContain('CREDIT_PACKS.map((pack)');
    expect(pricingSource).toContain('<button');
    expect(pricingSource).toContain('type="button"');
    expect(pricingSource).toContain('onClick={() => purchaseCreditPack(pack.id)}');
  });

  test.each(['credits_100', 'credits_250', 'credits_500', 'credits_1000'])(
    '%s is represented by the shared direct-checkout button contract',
    (packCode) => {
      expect(certainCreditMappings.some(([code]) => code === packCode)).toBe(true);
      expect(pricingSource).toContain('purchaseCreditPack(pack.id)');
    }
  );

  test('sends only the pack code to the server route', () => {
    expect(pricingSource).toContain("fetch('/api/payments/dodo/credit-checkout'");
    expect(pricingSource).toContain('body: JSON.stringify({ packCode })');
    const requestBody = pricingSource.match(/body:\s*JSON\.stringify\(\{\s*([^}]*)\s*\}\)/);
    expect(requestBody?.[1].trim()).toBe('packCode');
  });

  test('shows loading feedback and blocks a second click', () => {
    expect(pricingSource).toContain('if (purchasingPack) return');
    expect(pricingSource).toContain('disabled={purchasingPack !== null}');
    expect(pricingSource).toContain("purchasingPack === pack.id ? 'Opening checkout…'");
    expect(pricingSource).toContain('disabled:cursor-not-allowed');
  });

  test('preserves the credit-pack intent through authentication and resume', () => {
    expect(pricingSource).toContain("credit_pack: packCode");
    expect(pricingSource).toContain("return_to: '/checkout/resume'");
    expect(pricingSource).toContain("router.push(`/auth/sign-in?");
    expect(authSource).toContain("searchParams.get('credit_pack')");
    expect(authSource).toContain('/checkout/resume?credit_pack=');
    expect(resumeSource).toContain("searchParams.get('credit_pack')");
    expect(resumeSource).toContain("fetch('/api/payments/dodo/credit-checkout'");
  });

  test('requires authentication on the server and delegates to the existing checkout service', () => {
    expect(routeSource).toContain('supabase.auth.getUser()');
    expect(routeSource).toContain("{ error: 'Unauthorized' }, { status: 401 }");
    expect(routeSource).toContain('initiateCreditPackCheckout({');
    expect(routeSource).toContain('packCode,');
    expect(routeSource).not.toMatch(/DODO_PAYMENTS_API_KEY|pdt_[A-Za-z0-9]+/);
  });

  test('surfaces server mapping errors instead of hiding or bypassing checkout', () => {
    expect(pricingSource).toContain("throw new Error(data.error ?? 'Credit pack checkout is unavailable.')");
    expect(pricingSource).toContain('<p role="alert"');
    expect(pricingSource).not.toContain('NEXT_PUBLIC_DODO_PAYMENTS_ENABLED');
  });
});
