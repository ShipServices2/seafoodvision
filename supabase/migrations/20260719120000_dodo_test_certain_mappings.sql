-- SeafoodVision Sprint 1.5 — complete Dodo TEST mappings.
--
-- This migration never reads, inserts, updates, or deletes production mappings.

BEGIN;

-- Fail closed if SeafoodVision's authoritative commercial data changed.
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.unit_products
    WHERE (product_code, price, currency, is_active) IN (
      ('photo_web', 5.00, 'EUR', true),
      ('photo_hd', 20.00, 'EUR', true),
      ('photo_ultrahd', 40.00, 'EUR', true),
      ('video', 75.00, 'EUR', true),
      ('view_360', 50.00, 'EUR', true),
      ('pack_10', 150.00, 'EUR', true)
    )
  ) <> 6 THEN
    RAISE EXCEPTION 'Dodo TEST mapping aborted: unit product price, currency, or active status differs from the validated configuration';
  END IF;

  IF (
    SELECT count(*)
    FROM public.credit_packs
    WHERE (pack_code, credits, price, currency, is_active) IN (
      ('credits_100', 100, 9.00, 'EUR', true),
      ('credits_250', 250, 19.00, 'EUR', true),
      ('credits_500', 500, 35.00, 'EUR', true),
      ('credits_1000', 1000, 59.00, 'EUR', true)
    )
  ) <> 4 THEN
    RAISE EXCEPTION 'Dodo TEST mapping aborted: credit pack price, currency, credits, or active status differs from the validated configuration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('explorer', 29.00::numeric, 290.00::numeric),
      ('professional', 79.00::numeric, 790.00::numeric),
      ('business', 199.00::numeric, 1990.00::numeric)
    ) AS expected(plan_code, monthly_price, annual_price)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.pricing_plans plan
      WHERE plan.plan_code IN (expected.plan_code, expected.plan_code || '_monthly')
        AND plan.price_monthly = expected.monthly_price
        AND plan.price_annual = expected.annual_price
        AND plan.currency = 'EUR'
        AND plan.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Dodo TEST mapping aborted: subscription price, currency, or active status differs from the validated configuration';
  END IF;
END
$$;

-- Six one-time unit products. Browser requests contain only product codes;
-- Product IDs remain in this server-side mapping table.
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  billing_cycle,
  currency,
  is_active,
  notes
)
SELECT
  'one_time_asset_license'::public.internal_product_type,
  product.id,
  expected.dodo_product_id,
  NULL,
  'test'::public.dodo_environment,
  NULL,
  'EUR',
  true,
  'Sprint 1.5 — validated Dodo TEST one-time unit product'
FROM (VALUES
  ('photo_web', 'pdt_0NjWshHafg7cviI5DWtIC'),
  ('photo_hd', 'pdt_0NjWsoHpPgM1pbUVaHJfr'),
  ('photo_ultrahd', 'pdt_0NjWsy1RvRix3wTCalm9m'),
  ('video', 'pdt_0NjWt709qq5LizExnEFAJ'),
  ('view_360', 'pdt_0NjWtHcROzLiZ4zZnNKbo'),
  ('pack_10', 'pdt_0NjWtPcFWTkxVoTnssvcD')
) AS expected(product_code, dodo_product_id)
JOIN public.unit_products product ON product.product_code = expected.product_code
ON CONFLICT (internal_product_type, internal_product_id, environment)
  WHERE internal_product_type <> 'subscription_plan'
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id = COALESCE(public.payment_product_mappings.dodo_price_id, EXCLUDED.dodo_price_id),
  currency = EXCLUDED.currency,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Four one-time credit packs. Product IDs are server-side database data only.
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  billing_cycle,
  currency,
  is_active,
  notes
)
SELECT
  'credit_pack'::public.internal_product_type,
  pack.id,
  expected.dodo_product_id,
  NULL,
  'test'::public.dodo_environment,
  NULL,
  'EUR',
  true,
  'Sprint 1.5 — validated Dodo TEST one-time credit pack'
FROM (VALUES
  ('credits_100', 'pdt_0NjWs5ltiwaGybbv3lt7G'),
  ('credits_250', 'pdt_0NjWsGANLBfyWsyQkFPXk'),
  ('credits_500', 'pdt_0NjWsPF3TgzjkrKoTEb74'),
  ('credits_1000', 'pdt_0NjWsWtbJw11tr0KvWEUh')
) AS expected(pack_code, dodo_product_id)
JOIN public.credit_packs pack ON pack.pack_code = expected.pack_code
ON CONFLICT (internal_product_type, internal_product_id, environment)
  WHERE internal_product_type <> 'subscription_plan'
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id = COALESCE(public.payment_product_mappings.dodo_price_id, EXCLUDED.dodo_price_id),
  currency = EXCLUDED.currency,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Monthly and annual subscriptions use the same internal plan row and a distinct
-- cycle-specific TEST mapping. All six supplied Product IDs are different.
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  billing_cycle,
  currency,
  is_active,
  notes
)
SELECT
  'subscription_plan'::public.internal_product_type,
  plan.id,
  expected.dodo_product_id,
  NULL,
  'test'::public.dodo_environment,
  expected.billing_cycle::public.subscription_billing_cycle,
  'EUR',
  true,
  'Sprint 1.5 — validated Dodo TEST ' || expected.billing_cycle || ' subscription'
FROM (VALUES
  ('explorer', 'monthly', 'pdt_0NjJwwWYNVeTj06MeYCGW'),
  ('professional', 'monthly', 'pdt_0NjJxdsjq65AH2w2HuWDL'),
  ('business', 'monthly', 'pdt_0NjJyA1OFHe9XEuAT6AIR'),
  ('explorer', 'annual', 'pdt_0NjX0mLZim94JaL68vey'),
  ('professional', 'annual', 'pdt_0NjX0x2DixcGgjMFi2Ml2'),
  ('business', 'annual', 'pdt_0NjX1AAHCwtq0QNpDgY8r')
) AS expected(plan_code, billing_cycle, dodo_product_id)
CROSS JOIN LATERAL (
  SELECT candidate.id
  FROM public.pricing_plans candidate
  WHERE candidate.plan_code IN (expected.plan_code, expected.plan_code || '_monthly')
  ORDER BY (candidate.plan_code = expected.plan_code) DESC
  LIMIT 1
) AS plan
ON CONFLICT (internal_product_id, environment, billing_cycle)
  WHERE internal_product_type = 'subscription_plan'
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id = COALESCE(public.payment_product_mappings.dodo_price_id, EXCLUDED.dodo_price_id),
  currency = EXCLUDED.currency,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Postconditions: all sixteen TEST mappings are active and exact.
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.payment_product_mappings mapping
    JOIN public.unit_products product ON product.id = mapping.internal_product_id
    WHERE mapping.internal_product_type = 'one_time_asset_license'
      AND mapping.environment = 'test'
      AND mapping.billing_cycle IS NULL
      AND mapping.is_active = true
      AND (product.product_code, mapping.dodo_product_id) IN (
        ('photo_web', 'pdt_0NjWshHafg7cviI5DWtIC'),
        ('photo_hd', 'pdt_0NjWsoHpPgM1pbUVaHJfr'),
        ('photo_ultrahd', 'pdt_0NjWsy1RvRix3wTCalm9m'),
        ('video', 'pdt_0NjWt709qq5LizExnEFAJ'),
        ('view_360', 'pdt_0NjWtHcROzLiZ4zZnNKbo'),
        ('pack_10', 'pdt_0NjWtPcFWTkxVoTnssvcD')
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'Dodo TEST unit product mapping postcondition failed';
  END IF;

  IF (
    SELECT count(*)
    FROM public.payment_product_mappings mapping
    JOIN public.credit_packs pack ON pack.id = mapping.internal_product_id
    WHERE mapping.internal_product_type = 'credit_pack'
      AND mapping.environment = 'test'
      AND mapping.billing_cycle IS NULL
      AND mapping.is_active = true
      AND (pack.pack_code, mapping.dodo_product_id) IN (
        ('credits_100', 'pdt_0NjWs5ltiwaGybbv3lt7G'),
        ('credits_250', 'pdt_0NjWsGANLBfyWsyQkFPXk'),
        ('credits_500', 'pdt_0NjWsPF3TgzjkrKoTEb74'),
        ('credits_1000', 'pdt_0NjWsWtbJw11tr0KvWEUh')
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'Dodo TEST credit mapping postcondition failed';
  END IF;

  IF (
    SELECT count(*)
    FROM public.payment_product_mappings mapping
    JOIN public.pricing_plans plan ON plan.id = mapping.internal_product_id
    WHERE mapping.internal_product_type = 'subscription_plan'
      AND mapping.environment = 'test'
      AND mapping.is_active = true
      AND (
        (plan.plan_code IN ('explorer', 'explorer_monthly') AND mapping.billing_cycle = 'monthly' AND mapping.dodo_product_id = 'pdt_0NjJwwWYNVeTj06MeYCGW')
        OR (plan.plan_code IN ('professional', 'professional_monthly') AND mapping.billing_cycle = 'monthly' AND mapping.dodo_product_id = 'pdt_0NjJxdsjq65AH2w2HuWDL')
        OR (plan.plan_code IN ('business', 'business_monthly') AND mapping.billing_cycle = 'monthly' AND mapping.dodo_product_id = 'pdt_0NjJyA1OFHe9XEuAT6AIR')
        OR (plan.plan_code IN ('explorer', 'explorer_monthly') AND mapping.billing_cycle = 'annual' AND mapping.dodo_product_id = 'pdt_0NjX0mLZim94JaL68vey')
        OR (plan.plan_code IN ('professional', 'professional_monthly') AND mapping.billing_cycle = 'annual' AND mapping.dodo_product_id = 'pdt_0NjX0x2DixcGgjMFi2Ml2')
        OR (plan.plan_code IN ('business', 'business_monthly') AND mapping.billing_cycle = 'annual' AND mapping.dodo_product_id = 'pdt_0NjX1AAHCwtq0QNpDgY8r')
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'Dodo TEST subscription mapping postcondition failed';
  END IF;
END
$$;

COMMIT;
