-- Repair the single validated Dodo TEST mapping used by Professional Monthly.
-- This migration is self-contained: it adds the billing_cycle column and
-- required partial unique index if they are missing, then upserts the mapping.
-- It intentionally does not read or modify any LIVE mapping.

BEGIN;

-- Step 1: Add billing_cycle column to payment_product_mappings if absent.
ALTER TABLE public.payment_product_mappings
  ADD COLUMN IF NOT EXISTS billing_cycle public.subscription_billing_cycle;

-- Step 2: Backfill existing subscription_plan rows to 'monthly' if NULL.
UPDATE public.payment_product_mappings
SET billing_cycle = 'monthly'
WHERE internal_product_type = 'subscription_plan'
  AND billing_cycle IS NULL;

-- Step 3: Add billing_cycle consistency check constraint if absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_product_mappings_billing_cycle_consistency'
      AND conrelid = 'public.payment_product_mappings'::regclass
  ) THEN
    ALTER TABLE public.payment_product_mappings
      ADD CONSTRAINT payment_product_mappings_billing_cycle_consistency
      CHECK (
        (internal_product_type = 'subscription_plan' AND billing_cycle IS NOT NULL)
        OR (internal_product_type <> 'subscription_plan' AND billing_cycle IS NULL)
      ) NOT VALID;
  END IF;
END
$$;

-- Step 4: Drop the old non-subscription-aware unique constraint if present.
ALTER TABLE public.payment_product_mappings
  DROP CONSTRAINT IF EXISTS payment_product_mappings_internal_product_type_internal_product_id_environment_key;

-- Step 5: Create cycle-aware partial unique indexes if absent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_mapping_subscription_cycle
  ON public.payment_product_mappings(internal_product_id, environment, billing_cycle)
  WHERE internal_product_type = 'subscription_plan';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_mapping_non_subscription
  ON public.payment_product_mappings(internal_product_type, internal_product_id, environment)
  WHERE internal_product_type <> 'subscription_plan';

-- Step 6: Upsert the Professional Monthly TEST mapping.
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

  -- Postcondition: verify the mapping landed correctly.
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
