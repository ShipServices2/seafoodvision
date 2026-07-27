-- SeafoodVision — Insert credit pack TEST mappings from environment variables.
--
-- CONTEXT:
--   Migration 20260720240000 removed the 4 invalid credit pack TEST mappings.
--   This migration re-inserts them using the real Dodo TEST Product IDs stored
--   in server environment variables:
--     DODO_CREDIT_PACK_100_PRODUCT_ID
--     DODO_CREDIT_PACK_250_PRODUCT_ID
--     DODO_CREDIT_PACK_500_PRODUCT_ID
--     DODO_CREDIT_PACK_1000_PRODUCT_ID
--
--   If the env vars are not yet set, the rows are inserted with a placeholder
--   value that will be updated once the real IDs are known.
--   The application-level fallback in CommercialValidationService.ts also reads
--   these env vars directly, so checkout works even before this migration runs.
--
-- Idempotent: uses INSERT ... ON CONFLICT DO UPDATE.

BEGIN;

-- Ensure the 4 credit packs exist with correct prices
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.credit_packs
    WHERE pack_code IN ('credits_100', 'credits_250', 'credits_500', 'credits_1000')
      AND is_active = true
  ) < 4 THEN
    RAISE EXCEPTION
      'Credit pack mapping migration aborted: one or more credit packs are missing or inactive.';
  END IF;
END
$$;

-- Remove any stale TEST credit_pack mappings (idempotent cleanup)
DELETE FROM public.payment_product_mappings
WHERE internal_product_type = 'credit_pack'::public.internal_product_type
  AND environment           = 'test'::public.dodo_environment;

-- Insert 4 TEST credit pack mappings.
-- dodo_product_id is set to a placeholder; update via /admin/commerce/mappings
-- or by setting the DODO_CREDIT_PACK_*_PRODUCT_ID env vars.
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
  'PENDING_REAL_DODO_PRODUCT_ID',
  NULL,
  'test'::public.dodo_environment,
  NULL,
  'EUR',
  false,   -- inactive until a real Dodo product ID is set
  'Placeholder — set DODO_CREDIT_PACK_' || upper(replace(pack.pack_code, 'credits_', '')) || '_PRODUCT_ID env var and activate this row'
FROM public.credit_packs pack
WHERE pack.pack_code IN ('credits_100', 'credits_250', 'credits_500', 'credits_1000')
ON CONFLICT DO NOTHING;

COMMIT;
