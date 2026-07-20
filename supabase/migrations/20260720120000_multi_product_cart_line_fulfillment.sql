-- SeafoodVision Sprint 2 — exact-once fulfillment per cart line.
-- Required because the legacy uniqueness key collapses two formats of the same
-- asset and license in one order. No cart tables are introduced.

BEGIN;

ALTER TABLE public.purchased_licenses
  ADD COLUMN IF NOT EXISTS order_item_id UUID
  REFERENCES public.order_items(id) ON DELETE RESTRICT;

ALTER TABLE public.purchased_licenses
  DROP CONSTRAINT IF EXISTS purchased_licenses_user_id_asset_id_license_type_id_order_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchased_licenses_order_item
  ON public.purchased_licenses(order_item_id)
  WHERE order_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchased_licenses_legacy_line
  ON public.purchased_licenses(user_id, asset_id, license_type_id, order_id)
  WHERE order_item_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchased_licenses_order_item
  ON public.purchased_licenses(order_item_id);

COMMIT;
