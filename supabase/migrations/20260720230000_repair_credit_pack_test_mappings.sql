-- SeafoodVision — Repair missing Dodo TEST mappings for the 4 credit packs.
--
-- Context: payment_product_mappings currently has only the subscription-plan rows.
-- The credit_pack TEST mappings from sprint 1.5 were never applied to the remote DB.
-- This migration inserts (or replaces) the 4 credit pack TEST mappings using the
-- validated Dodo Product IDs from sprint 1.5.
--
-- LIVE mappings: untouched (environment = 'production' rows are never referenced).
-- Idempotent: DELETE WHERE + INSERT — safe to run multiple times.

BEGIN;

-- ── Precondition: all 4 credit packs must exist with the expected prices ────────
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
      'have wrong price/currency, or are inactive. '
      'Verify the credit_packs table before re-running this migration.';
  END IF;
END
$$;

-- ── Remove any stale TEST credit_pack mappings (idempotent cleanup) ─────────────
DELETE FROM public.payment_product_mappings
WHERE internal_product_type = 'credit_pack'::public.internal_product_type
  AND environment           = 'test'::public.dodo_environment;

-- ── Insert the 4 validated Dodo TEST credit pack mappings ────────────────────────
--
-- Dodo Product IDs (TEST environment, sprint 1.5 validated):
--   credits_100  → pdt_0NjWs5ltiwaGybbv3lt7G
--   credits_250  → pdt_0NjWsGANLBfyWsyQkFPXk
--   credits_500  → pdt_0NjWsPF3TgzjkrKoTEb74
--   credits_1000 → pdt_0NjWsWtbJw11tr0KvWEUh
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
  'Repair migration 20260720230000 — validated Dodo TEST credit pack'
FROM (VALUES
  ('credits_100',  'pdt_0NjWs5ltiwaGybbv3lt7G'),
  ('credits_250',  'pdt_0NjWsGANLBfyWsyQkFPXk'),
  ('credits_500',  'pdt_0NjWsPF3TgzjkrKoTEb74'),
  ('credits_1000', 'pdt_0NjWsWtbJw11tr0KvWEUh')
) AS expected(pack_code, dodo_product_id)
JOIN public.credit_packs pack ON pack.pack_code = expected.pack_code;

-- ── Postcondition: exactly 4 active TEST credit_pack mappings must now exist ─────
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
      AND (pack.pack_code, mapping.dodo_product_id) IN (
        ('credits_100',  'pdt_0NjWs5ltiwaGybbv3lt7G'),
        ('credits_250',  'pdt_0NjWsGANLBfyWsyQkFPXk'),
        ('credits_500',  'pdt_0NjWsPF3TgzjkrKoTEb74'),
        ('credits_1000', 'pdt_0NjWsWtbJw11tr0KvWEUh')
      )
  ) <> 4 THEN
    RAISE EXCEPTION
      'Credit pack mapping postcondition failed: '
      'expected 4 active TEST credit_pack rows but found a different count. '
      'Check payment_product_mappings and credit_packs tables.';
  END IF;
END
$$;

COMMIT;
