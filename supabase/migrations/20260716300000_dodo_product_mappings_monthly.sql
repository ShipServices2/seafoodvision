-- ============================================================
-- SEAFOOD VISION — Dodo Payments Product Mappings (Test Mode)
-- Inserts Explorer / Professional / Business Monthly mappings
-- into payment_product_mappings using plan_code lookup.
-- Constraints:
--   - no duplicate (internal_product_type, internal_product_id, environment)
--   - no same dodo_product_id mapped to two different plans
-- ============================================================

-- Step 1: Ensure pricing_plans have the correct plan_codes
-- (idempotent — only sets if NULL)
UPDATE public.pricing_plans
SET plan_code = 'explorer_monthly'
WHERE LOWER(name) LIKE '%explorer%'
  AND (plan_code IS NULL OR plan_code = '');

UPDATE public.pricing_plans
SET plan_code = 'professional_monthly'
WHERE LOWER(name) LIKE '%professional%'
  AND (plan_code IS NULL OR plan_code = '');

UPDATE public.pricing_plans
SET plan_code = 'business_monthly'
WHERE LOWER(name) LIKE '%business%'
  AND (plan_code IS NULL OR plan_code = '');

-- Step 2: Insert mappings — idempotent via ON CONFLICT DO UPDATE
-- Constraint: UNIQUE (internal_product_type, internal_product_id, environment)
-- Additional guard: prevent same dodo_product_id on two different plans

-- Explorer Monthly → pdt_0NjJwwWYNVeTj06MeYCGW
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  currency,
  is_active,
  notes
)
SELECT
  'subscription_plan'::public.internal_product_type,
  pp.id,
  'pdt_0NjJwwWYNVeTj06MeYCGW',
  'pdt_0NjJwwWYNVeTj06MeYCGW',
  'test'::public.dodo_environment,
  'EUR',
  true,
  'Explorer Monthly — Dodo Test Mode'
FROM public.pricing_plans pp
WHERE pp.plan_code = 'explorer_monthly'
  -- Guard: do not insert if this dodo_product_id is already used by another plan
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_product_mappings m2
    WHERE m2.dodo_product_id = 'pdt_0NjJwwWYNVeTj06MeYCGW'
      AND m2.internal_product_id != pp.id
  )
ON CONFLICT (internal_product_type, internal_product_id, environment)
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id   = EXCLUDED.dodo_price_id,
  is_active       = true,
  notes           = EXCLUDED.notes,
  updated_at      = now();

-- Professional Monthly → pdt_0NjJxdsjq65AH2w2HuWDL
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  currency,
  is_active,
  notes
)
SELECT
  'subscription_plan'::public.internal_product_type,
  pp.id,
  'pdt_0NjJxdsjq65AH2w2HuWDL',
  'pdt_0NjJxdsjq65AH2w2HuWDL',
  'test'::public.dodo_environment,
  'EUR',
  true,
  'Professional Monthly — Dodo Test Mode'
FROM public.pricing_plans pp
WHERE pp.plan_code = 'professional_monthly'
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_product_mappings m2
    WHERE m2.dodo_product_id = 'pdt_0NjJxdsjq65AH2w2HuWDL'
      AND m2.internal_product_id != pp.id
  )
ON CONFLICT (internal_product_type, internal_product_id, environment)
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id   = EXCLUDED.dodo_price_id,
  is_active       = true,
  notes           = EXCLUDED.notes,
  updated_at      = now();

-- Business Monthly → pdt_0NjJyA1OFHe9XEuAT6AlR
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  currency,
  is_active,
  notes
)
SELECT
  'subscription_plan'::public.internal_product_type,
  pp.id,
  'pdt_0NjJyA1OFHe9XEuAT6AlR',
  'pdt_0NjJyA1OFHe9XEuAT6AlR',
  'test'::public.dodo_environment,
  'EUR',
  true,
  'Business Monthly — Dodo Test Mode'
FROM public.pricing_plans pp
WHERE pp.plan_code = 'business_monthly'
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_product_mappings m2
    WHERE m2.dodo_product_id = 'pdt_0NjJyA1OFHe9XEuAT6AlR'
      AND m2.internal_product_id != pp.id
  )
ON CONFLICT (internal_product_type, internal_product_id, environment)
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id   = EXCLUDED.dodo_price_id,
  is_active       = true,
  notes           = EXCLUDED.notes,
  updated_at      = now();

-- Step 3: Verify — raise notice for each inserted mapping
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.payment_product_mappings
  WHERE internal_product_type = 'subscription_plan'
    AND environment = 'test'
    AND dodo_product_id IN (
      'pdt_0NjJwwWYNVeTj06MeYCGW',
      'pdt_0NjJxdsjq65AH2w2HuWDL',
      'pdt_0NjJyA1OFHe9XEuAT6AlR'
    );
  RAISE NOTICE 'Dodo product mappings (test mode): % / 3 configured', v_count;
END;
$$;
