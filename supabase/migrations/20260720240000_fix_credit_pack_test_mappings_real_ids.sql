-- SeafoodVision — Remove invalid Dodo TEST credit pack mappings.
--
-- CONTEXT:
--   Migration 20260720230000 inserted 4 credit pack TEST mappings using Product IDs
--   that do not exist in the Dodo TEST account (HTTP 422 "Product does not exist"):
--     pdt_0NjWs5ltiwaGybbv3lt7G  (credits_100)
--     pdt_0NjWsGANLBfyWsyQkFPXk  (credits_250)
--     pdt_0NjWsPF3TgzjkrKoTEb74  (credits_500)
--     pdt_0NjWsWtbJw11tr0KvWEUh  (credits_1000)
--
-- This migration removes those invalid rows so the DB is clean.
-- New mappings must be inserted once the real Dodo TEST Product IDs are known.
-- Use /admin/commerce/dodo-products to look up real Product IDs from your Dodo account,
-- then insert them via /admin/commerce/mappings.
--
-- LIVE mappings: untouched (environment = 'production' rows never referenced).
-- Idempotent: safe to run multiple times.

BEGIN;

-- Remove the 4 invalid TEST credit_pack mappings inserted by migration 20260720230000.
DELETE FROM public.payment_product_mappings
WHERE internal_product_type = 'credit_pack'::public.internal_product_type
  AND environment           = 'test'::public.dodo_environment
  AND dodo_product_id IN (
    'pdt_0NjWs5ltiwaGybbv3lt7G',
    'pdt_0NjWsGANLBfyWsyQkFPXk',
    'pdt_0NjWsPF3TgzjkrKoTEb74',
    'pdt_0NjWsWtbJw11tr0KvWEUh'
  );

COMMIT;
