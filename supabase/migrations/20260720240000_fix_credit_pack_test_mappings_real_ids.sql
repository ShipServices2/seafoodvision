-- SeafoodVision — Fix credit pack TEST mappings with REAL Dodo Product IDs.
--
-- CONTEXT:
--   Migration 20260720230000 inserted credit pack mappings using Product IDs
--   that do not exist in the Dodo TEST account (422 "Product does not exist").
--
-- HOW TO USE THIS MIGRATION:
--   1. Go to /admin/commerce/dodo-products (admin-only page).
--   2. Click "Charger les produits Dodo TEST" to list real products from your Dodo account.
--   3. Identify the 4 one-time products matching: 9 EUR, 19 EUR, 35 EUR, 59 EUR.
--   4. Replace the 4 placeholder values below with the real Product IDs.
--   5. Push to Supabase.
--
-- PLACEHOLDER FORMAT: REPLACE_WITH_REAL_DODO_PRODUCT_ID_<pack>
-- These will cause the migration to FAIL FAST if not replaced (intentional).
--
-- LIVE mappings: untouched (environment = 'production' rows never referenced).
-- Idempotent: DELETE WHERE + INSERT — safe to run multiple times.

BEGIN;

-- ── Precondition: all 4 credit packs must exist ──────────────────────────────
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.credit_packs
    WHERE (pack_code, credits, price, currency, is_active) IN (
      ('credits_100',  100,  9.00, 'EUR', true),
      ('credits_250',  250, 19.00, 'EUR', true),
      ('credits_500',  500, 35.00, 'EUR', true),
      ('credits_1000', 1000, 59.00, 'EUR', true)
    )
  ) <> 4 THEN
    RAISE EXCEPTION
      'Credit pack repair aborted: one or more credit packs are missing, '
      'have wrong price/currency, or are inactive.';
  END IF;
END
$$;

-- ── Guard: refuse to run if placeholder IDs are still present ────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('REPLACE_WITH_REAL_DODO_PRODUCT_ID_100'),
      ('REPLACE_WITH_REAL_DODO_PRODUCT_ID_250'),
      ('REPLACE_WITH_REAL_DODO_PRODUCT_ID_500'),
      ('REPLACE_WITH_REAL_DODO_PRODUCT_ID_1000')
    ) AS placeholders(id)
    WHERE id IN (
      'REPLACE_WITH_REAL_DODO_PRODUCT_ID_100',
      'REPLACE_WITH_REAL_DODO_PRODUCT_ID_250',
      'REPLACE_WITH_REAL_DODO_PRODUCT_ID_500',
      'REPLACE_WITH_REAL_DODO_PRODUCT_ID_1000'
    )
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: placeholder Product IDs have not been replaced. '
      'Go to /admin/commerce/dodo-products to find the real Dodo TEST Product IDs, '
      'then update this migration file before applying it.';
  END IF;
END
$$;

-- ── Remove stale TEST credit_pack mappings (idempotent cleanup) ──────────────
DELETE FROM public.payment_product_mappings
WHERE internal_product_type = 'credit_pack'::public.internal_product_type
  AND environment           = 'test'::public.dodo_environment;

-- ── Insert the 4 REAL Dodo TEST credit pack mappings ─────────────────────────
--
-- ⚠️  REPLACE THESE 4 PRODUCT IDs WITH REAL VALUES FROM YOUR DODO TEST ACCOUNT
--     Use /admin/commerce/dodo-products to find them.
--
--   credits_100  (100 crédits — 9 EUR)  → REPLACE_WITH_REAL_DODO_PRODUCT_ID_100
--   credits_250  (250 crédits — 19 EUR) → REPLACE_WITH_REAL_DODO_PRODUCT_ID_250
--   credits_500  (500 crédits — 35 EUR) → REPLACE_WITH_REAL_DODO_PRODUCT_ID_500
--   credits_1000 (1000 crédits — 59 EUR)→ REPLACE_WITH_REAL_DODO_PRODUCT_ID_1000
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
  'Migration 20260720240000 — real Dodo TEST credit pack Product IDs'
FROM (VALUES
  ('credits_100',  'REPLACE_WITH_REAL_DODO_PRODUCT_ID_100'),
  ('credits_250',  'REPLACE_WITH_REAL_DODO_PRODUCT_ID_250'),
  ('credits_500',  'REPLACE_WITH_REAL_DODO_PRODUCT_ID_500'),
  ('credits_1000', 'REPLACE_WITH_REAL_DODO_PRODUCT_ID_1000')
) AS expected(pack_code, dodo_product_id)
JOIN public.credit_packs pack ON pack.pack_code = expected.pack_code;

-- ── Postcondition: exactly 4 active TEST credit_pack mappings must now exist ─
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.payment_product_mappings mapping
    JOIN public.credit_packs pack ON pack.id = mapping.internal_product_id
    WHERE mapping.internal_product_type = 'credit_pack'::public.internal_product_type
      AND mapping.environment           = 'test'::public.dodo_environment
      AND mapping.billing_cycle IS NULL
      AND mapping.is_active = true
  ) <> 4 THEN
    RAISE EXCEPTION
      'Credit pack mapping postcondition failed: '
      'expected 4 active TEST credit_pack rows but found a different count.';
  END IF;
END
$$;

COMMIT;
