-- Repair the single validated Dodo TEST mapping used by Professional Monthly.
-- This migration intentionally does not read or modify any LIVE mapping.

BEGIN;

DO $$
DECLARE
  professional_plan_id uuid;
BEGIN
  SELECT plan.id
  INTO professional_plan_id
  FROM public.pricing_plans plan
  WHERE plan.plan_code IN ('professional', 'professional_monthly')
    AND plan.is_active = true
  ORDER BY (plan.plan_code = 'professional') DESC, plan.updated_at DESC NULLS LAST
  LIMIT 1;

  IF professional_plan_id IS NULL THEN
    RAISE EXCEPTION 'Professional subscription plan is missing or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pricing_plans plan
    WHERE plan.id = professional_plan_id
      AND plan.price_monthly = 79.00
      AND plan.price_annual = 790.00
      AND plan.currency = 'EUR'
      AND plan.billing_cycles @> ARRAY['monthly', 'annual']::text[]
  ) THEN
    RAISE EXCEPTION 'Professional subscription plan catalog values are inconsistent';
  END IF;

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
  ) VALUES (
    'subscription_plan'::public.internal_product_type,
    professional_plan_id,
    'pdt_0NjJxdsjq65AH2w2HuWDL',
    NULL,
    'test'::public.dodo_environment,
    'monthly'::public.subscription_billing_cycle,
    'EUR',
    true,
    'Targeted repair - validated Professional Monthly Dodo TEST mapping'
  )
  ON CONFLICT (internal_product_id, environment, billing_cycle)
    WHERE internal_product_type = 'subscription_plan'
  DO UPDATE SET
    dodo_product_id = EXCLUDED.dodo_product_id,
    dodo_price_id = COALESCE(public.payment_product_mappings.dodo_price_id, EXCLUDED.dodo_price_id),
    currency = EXCLUDED.currency,
    is_active = true,
    notes = EXCLUDED.notes,
    updated_at = now();

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_product_mappings mapping
    WHERE mapping.internal_product_type = 'subscription_plan'
      AND mapping.internal_product_id = professional_plan_id
      AND mapping.environment = 'test'
      AND mapping.billing_cycle = 'monthly'
      AND mapping.dodo_product_id = 'pdt_0NjJxdsjq65AH2w2HuWDL'
      AND mapping.currency = 'EUR'
      AND mapping.is_active = true
  ) THEN
    RAISE EXCEPTION 'Professional Monthly Dodo TEST mapping repair failed';
  END IF;
END
$$;

COMMIT;
