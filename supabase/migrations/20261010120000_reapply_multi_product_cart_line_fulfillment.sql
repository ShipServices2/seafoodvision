-- SeafoodVision — exact-once fulfillment per cart line (re-application of 20260720120000).
--
-- 20260720120000 is marked applied in the history but was never executed: purchased_licenses.order_item_id does not
-- exist in the database, so every cart payment failed in the webhook ("Could not find the 'order_item_id' column").
-- This migration is idempotent (safe to run any number of times) and contains no DELETE and no Dodo identifier.
--
-- Differences from the original, both needed for the webhook upsert to work:
--  1. The unique index on order_item_id is NOT partial. The webhook upserts with ON CONFLICT (order_item_id), which
--     PostgreSQL can only match against a non-partial unique index (a partial one fails with 42P10). Several NULLs are
--     allowed in a unique index, so legacy rows without order_item_id are unaffected.
--  2. The legacy unique constraint is dropped by its real name: PostgreSQL truncated it to 63 characters
--     (..._license_type_id_order_i_key), so the original DROP CONSTRAINT IF EXISTS never matched it.

BEGIN;

ALTER TABLE public.purchased_licenses
  ADD COLUMN IF NOT EXISTS order_item_id UUID
  REFERENCES public.order_items(id) ON DELETE RESTRICT;

-- Legacy rows (no order line) keep their uniqueness, through a partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchased_licenses_legacy_line
  ON public.purchased_licenses(user_id, asset_id, license_type_id, order_id)
  WHERE order_item_id IS NULL;

-- One licence per order line (matched by ON CONFLICT (order_item_id)).
DROP INDEX IF EXISTS public.uq_purchased_licenses_order_item;
CREATE UNIQUE INDEX uq_purchased_licenses_order_item
  ON public.purchased_licenses(order_item_id);

-- The old (user, asset, licence, order) uniqueness would reject two formats of the same photo in one order.
-- Dropped by shape, whatever its (possibly truncated) name.
DO $$
DECLARE
  legacy record;
BEGIN
  FOR legacy IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.purchased_licenses'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) = ARRAY['asset_id', 'license_type_id', 'order_id', 'user_id']
  LOOP
    EXECUTE format('ALTER TABLE public.purchased_licenses DROP CONSTRAINT %I', legacy.conname);
  END LOOP;
END
$$;

-- order_item_id is already covered by uq_purchased_licenses_order_item; no separate lookup index is needed.

-- Make PostgREST see the new column immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
