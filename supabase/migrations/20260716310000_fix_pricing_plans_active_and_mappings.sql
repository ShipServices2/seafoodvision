-- ============================================================
-- Fix pricing_plans: ensure explorer_monthly, professional_monthly,
-- business_monthly exist, are active, and have correct plan_codes.
-- Then upsert payment_product_mappings with correct Dodo product IDs.
-- ============================================================

-- Step 1: Force-set plan_code and is_active for existing plans by name match
UPDATE public.pricing_plans
SET
  plan_code = 'explorer_monthly',
  is_active  = true
WHERE LOWER(name) LIKE '%explorer%';

UPDATE public.pricing_plans
SET
  plan_code = 'professional_monthly',
  is_active  = true
WHERE LOWER(name) LIKE '%professional%';

UPDATE public.pricing_plans
SET
  plan_code = 'business_monthly',
  is_active  = true
WHERE LOWER(name) LIKE '%business%';

-- Step 2: Insert plans if they still don't exist after the updates above
INSERT INTO public.pricing_plans (
  id,
  name,
  plan_code,
  price_monthly,
  is_active,
  features,
  billing_cycles,
  downloads_monthly,
  ai_credits_monthly,
  ai_access,
  api_access,
  sort_order
)
SELECT
  gen_random_uuid(),
  'Explorer',
  'explorer_monthly',
  0,
  true,
  '[]'::jsonb,
  ARRAY['monthly','annual'],
  10,
  5,
  false,
  false,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_plans WHERE plan_code = 'explorer_monthly'
);

INSERT INTO public.pricing_plans (
  id,
  name,
  plan_code,
  price_monthly,
  is_active,
  features,
  billing_cycles,
  downloads_monthly,
  ai_credits_monthly,
  ai_access,
  api_access,
  sort_order
)
SELECT
  gen_random_uuid(),
  'Professional',
  'professional_monthly',
  49,
  true,
  '[]'::jsonb,
  ARRAY['monthly','annual'],
  100,
  50,
  true,
  false,
  2
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_plans WHERE plan_code = 'professional_monthly'
);

INSERT INTO public.pricing_plans (
  id,
  name,
  plan_code,
  price_monthly,
  is_active,
  features,
  billing_cycles,
  downloads_monthly,
  ai_credits_monthly,
  ai_access,
  api_access,
  sort_order
)
SELECT
  gen_random_uuid(),
  'Business',
  'business_monthly',
  149,
  true,
  '[]'::jsonb,
  ARRAY['monthly','annual'],
  500,
  200,
  true,
  true,
  3
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_plans WHERE plan_code = 'business_monthly'
);

-- Step 3: Upsert payment_product_mappings for all three plans
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
ON CONFLICT (internal_product_type, internal_product_id, environment)
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  dodo_price_id   = EXCLUDED.dodo_price_id,
  is_active       = true,
  notes           = EXCLUDED.notes,
  updated_at      = now();

-- Step 4: Verification notice
DO $$
DECLARE
  v_plans  INT;
  v_maps   INT;
BEGIN
  SELECT COUNT(*) INTO v_plans
  FROM public.pricing_plans
  WHERE plan_code IN ('explorer_monthly','professional_monthly','business_monthly')
    AND is_active = true;

  SELECT COUNT(*) INTO v_maps
  FROM public.payment_product_mappings
  WHERE internal_product_type = 'subscription_plan'
    AND environment = 'test'
    AND dodo_product_id IN (
      'pdt_0NjJwwWYNVeTj06MeYCGW',
      'pdt_0NjJxdsjq65AH2w2HuWDL',
      'pdt_0NjJyA1OFHe9XEuAT6AlR'
    );

  RAISE NOTICE 'Active monthly plans: % / 3 | Dodo mappings (test): % / 3', v_plans, v_maps;
END;
$$;
