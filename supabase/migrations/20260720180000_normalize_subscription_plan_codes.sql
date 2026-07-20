-- Normalize subscription identity to one plan code plus a separate billing cycle.
-- Existing payment mappings reference pricing_plans.id, so their validated
-- Dodo TEST Product IDs remain unchanged.

BEGIN;

DO $$
DECLARE
  candidate_count integer;
  plan_pair record;
BEGIN
  FOR plan_pair IN
    SELECT * FROM (VALUES
      ('explorer', 'explorer_monthly'),
      ('professional', 'professional_monthly'),
      ('business', 'business_monthly')
    ) AS plans(canonical_code, legacy_code)
  LOOP
    SELECT count(*) INTO candidate_count
    FROM public.pricing_plans
    WHERE plan_code IN (plan_pair.canonical_code, plan_pair.legacy_code);

    IF candidate_count <> 1 THEN
      RAISE EXCEPTION
        'Subscription plan normalization requires exactly one row for % (found %)',
        plan_pair.canonical_code,
        candidate_count;
    END IF;

    UPDATE public.pricing_plans
    SET plan_code = plan_pair.canonical_code,
        updated_at = now()
    WHERE plan_code = plan_pair.legacy_code;
  END LOOP;

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
      WHERE plan.plan_code = expected.plan_code
        AND plan.price_monthly = expected.monthly_price
        AND plan.price_annual = expected.annual_price
        AND plan.currency = 'EUR'
        AND plan.is_active = true
        AND plan.billing_cycles @> ARRAY['monthly', 'annual']::text[]
    )
  ) THEN
    RAISE EXCEPTION 'Subscription plan normalization aborted: canonical catalog postcondition failed';
  END IF;

  IF (
    SELECT count(*)
    FROM public.payment_product_mappings mapping
    JOIN public.pricing_plans plan ON plan.id = mapping.internal_product_id
    WHERE mapping.internal_product_type = 'subscription_plan'
      AND mapping.environment = 'test'
      AND mapping.billing_cycle IN ('monthly', 'annual')
      AND mapping.is_active = true
      AND nullif(mapping.dodo_product_id, '') IS NOT NULL
      AND plan.plan_code IN ('explorer', 'professional', 'business')
  ) <> 6 THEN
    RAISE EXCEPTION 'Subscription plan normalization aborted: six active Dodo TEST mappings are required';
  END IF;
END
$$;

COMMIT;
