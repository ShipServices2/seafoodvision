-- SeafoodVision — Photo license env-var mapping rows
-- Ensures unit_products rows exist for photo_web / photo_hd / photo_ultrahd
-- and inserts inactive placeholder payment_product_mappings rows so the
-- env-var fallback in validateAssetLicensePurchase can be used immediately.
-- Real Dodo TEST Product IDs must be set via env vars:
--   DODO_PHOTO_WEB_PRODUCT_ID
--   DODO_PHOTO_HD_PRODUCT_ID
--   DODO_PHOTO_ULTRAHD_PRODUCT_ID
-- Idempotent — safe to run multiple times.

BEGIN;

-- ─── 1. Ensure license_types rows exist ──────────────────────────────────────
INSERT INTO public.license_types (code, name, is_active, is_exclusive, terms_version)
VALUES
  ('commercial', 'Commercial License', true, false, '1.0')
ON CONFLICT (code) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- ─── 2. Ensure unit_products rows exist ──────────────────────────────────────
INSERT INTO public.unit_products (product_code, name, price, currency, is_active, license_type_code)
VALUES
  ('photo_web',     'Photo Web',      5.00,  'EUR', true, 'commercial'),
  ('photo_hd',      'Photo HD',       20.00, 'EUR', true, 'commercial'),
  ('photo_ultrahd', 'Photo Ultra HD', 40.00, 'EUR', true, 'commercial')
ON CONFLICT (product_code) DO UPDATE SET
  price      = EXCLUDED.price,
  currency   = EXCLUDED.currency,
  is_active  = true,
  updated_at = now();

-- ─── 3. Insert placeholder payment_product_mappings rows (inactive) ──────────
-- These rows are inactive (is_active = false) so they do NOT override the
-- env-var fallback. They exist only to satisfy FK constraints and to allow
-- the admin UI to upsert real IDs later.
-- When real IDs are set via env vars, the env-var path in
-- validateAssetLicensePurchase takes over automatically.
INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  environment,
  billing_cycle,
  dodo_product_id,
  is_active,
  notes
)
SELECT
  'one_time_asset_license',
  up.id,
  'test',
  NULL,
  'PLACEHOLDER_SET_VIA_ENV_VAR',
  false,
  'Placeholder — set real ID via DODO_PHOTO_' || upper(replace(up.product_code, 'photo_', '')) || '_PRODUCT_ID env var'
FROM public.unit_products up
WHERE up.product_code IN ('photo_web', 'photo_hd', 'photo_ultrahd')
ON CONFLICT (internal_product_type, internal_product_id, environment)
  WHERE internal_product_type <> 'subscription_plan'
DO NOTHING;

-- ─── 4. Verify unit_products rows ────────────────────────────────────────────
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.unit_products
  WHERE product_code IN ('photo_web', 'photo_hd', 'photo_ultrahd')
    AND is_active = true
    AND price > 0
    AND currency = 'EUR';

  IF v_count < 3 THEN
    RAISE EXCEPTION 'Expected 3 active photo unit_products, found %', v_count;
  END IF;

  RAISE NOTICE 'photo_license_env_var_mappings: % active unit_products verified', v_count;
END $$;

COMMIT;
