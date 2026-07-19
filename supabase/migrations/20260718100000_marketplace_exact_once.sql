-- SEAFOODVISION — Marketplace exact-once hardening
-- Reconciles legacy duplicates before adding the minimum business-key indexes.
-- No table is recreated and all work is transactional.

BEGIN;

-- Subscription mappings are cycle-specific. Legacy mappings are monthly.
ALTER TABLE public.payment_product_mappings
  ADD COLUMN IF NOT EXISTS billing_cycle public.subscription_billing_cycle;

UPDATE public.payment_product_mappings
SET billing_cycle = 'monthly'
WHERE internal_product_type = 'subscription_plan'
  AND billing_cycle IS NULL;

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

ALTER TABLE public.payment_product_mappings
  VALIDATE CONSTRAINT payment_product_mappings_billing_cycle_consistency;

ALTER TABLE public.payment_product_mappings
  DROP CONSTRAINT IF EXISTS payment_product_mappings_internal_product_type_internal_product_id_environment_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_mapping_subscription_cycle
ON public.payment_product_mappings(internal_product_id, environment, billing_cycle)
WHERE internal_product_type = 'subscription_plan';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_mapping_non_subscription
ON public.payment_product_mappings(internal_product_type, internal_product_id, environment)
WHERE internal_product_type <> 'subscription_plan';

-- 1. One Dodo payment transaction per provider/environment/payment id.
CREATE TEMP TABLE marketplace_transaction_remap ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY provider, environment, external_payment_id
      ORDER BY (status = 'succeeded') DESC, created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY provider, environment, external_payment_id
      ORDER BY (status = 'succeeded') DESC, created_at ASC, id ASC
    ) AS position
  FROM public.payment_transactions
  WHERE external_payment_id IS NOT NULL AND btrim(external_payment_id) <> ''
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE position > 1;

UPDATE public.purchased_licenses target
SET transaction_id = remap.keep_id
FROM marketplace_transaction_remap remap
WHERE target.transaction_id = remap.duplicate_id;

UPDATE public.refunds target
SET transaction_id = remap.keep_id
FROM marketplace_transaction_remap remap
WHERE target.transaction_id = remap.duplicate_id;

DELETE FROM public.payment_transactions target
USING marketplace_transaction_remap remap
WHERE target.id = remap.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_dodo_payment
ON public.payment_transactions(provider, environment, external_payment_id)
WHERE external_payment_id IS NOT NULL AND btrim(external_payment_id) <> '';

-- 2. A credit-pack order can credit the wallet only once.
CREATE TEMP TABLE marketplace_credit_affected_users ON COMMIT DROP AS
SELECT DISTINCT user_id
FROM public.credit_ledger
WHERE order_id IN (
  SELECT order_id
  FROM public.credit_ledger
  WHERE movement_type = 'purchase' AND order_id IS NOT NULL
  GROUP BY order_id
  HAVING count(*) > 1
);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY order_id ORDER BY created_at ASC, id ASC) AS position
  FROM public.credit_ledger
  WHERE movement_type = 'purchase' AND order_id IS NOT NULL
)
DELETE FROM public.credit_ledger target
USING ranked
WHERE target.id = ranked.id AND ranked.position > 1;

-- Recompute balances only for users whose duplicate purchase was removed.
WITH recalculated AS (
  SELECT
    id,
    coalesce(
      sum(amount) OVER (
        PARTITION BY user_id ORDER BY created_at ASC, id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS new_balance_before,
    sum(amount) OVER (
      PARTITION BY user_id ORDER BY created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS new_balance_after
  FROM public.credit_ledger
  WHERE user_id IN (SELECT user_id FROM marketplace_credit_affected_users)
)
UPDATE public.credit_ledger target
SET
  balance_before = recalculated.new_balance_before,
  balance_after = recalculated.new_balance_after
FROM recalculated
WHERE target.id = recalculated.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_purchase_order
ON public.credit_ledger(order_id)
WHERE movement_type = 'purchase' AND order_id IS NOT NULL;

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL;

UPDATE public.credit_ledger ledger
SET transaction_id = transaction.id
FROM public.payment_transactions transaction
WHERE ledger.movement_type = 'purchase'
  AND ledger.order_id = transaction.order_id
  AND ledger.transaction_id IS NULL
  AND transaction.status = 'succeeded';

CREATE OR REPLACE FUNCTION public.apply_credit_purchase(
  p_user_id UUID,
  p_order_id UUID,
  p_transaction_id UUID,
  p_credits INTEGER,
  p_reason TEXT DEFAULT 'Credit pack purchase'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_balance INTEGER;
  v_ledger_id UUID;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive';
  END IF;

  -- Serialize wallet mutations per user while keeping different users concurrent.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id INTO v_existing_id
  FROM public.credit_ledger
  WHERE order_id = p_order_id AND movement_type = 'purchase'
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT coalesce(balance_after, 0) INTO v_balance
  FROM public.credit_ledger
  WHERE user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  v_balance := coalesce(v_balance, 0);

  INSERT INTO public.credit_ledger(
    user_id, movement_type, amount, reason, reference,
    balance_before, balance_after, order_id, transaction_id
  ) VALUES (
    p_user_id, 'purchase', p_credits, p_reason, p_order_id::text,
    v_balance, v_balance + p_credits, p_order_id, p_transaction_id
  )
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_credit_purchase(UUID, UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_credit_purchase(UUID, UUID, UUID, INTEGER, TEXT) TO service_role;

-- 3. One local subscription per Dodo subscription and environment.
CREATE TEMP TABLE marketplace_subscription_remap ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY environment, external_subscription_id
      ORDER BY
        CASE status::text
          WHEN 'active' THEN 0
          WHEN 'trialing' THEN 1
          WHEN 'past_due' THEN 2
          ELSE 3
        END,
        updated_at DESC,
        created_at ASC,
        id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY environment, external_subscription_id
      ORDER BY
        CASE status::text
          WHEN 'active' THEN 0
          WHEN 'trialing' THEN 1
          WHEN 'past_due' THEN 2
          ELSE 3
        END,
        updated_at DESC,
        created_at ASC,
        id ASC
    ) AS position
  FROM public.user_subscriptions
  WHERE external_subscription_id IS NOT NULL AND btrim(external_subscription_id) <> ''
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE position > 1;

UPDATE public.download_entitlements target
SET subscription_id = remap.keep_id
FROM marketplace_subscription_remap remap
WHERE target.subscription_id = remap.duplicate_id;

UPDATE public.subscription_events target
SET subscription_id = remap.keep_id
FROM marketplace_subscription_remap remap
WHERE target.subscription_id = remap.duplicate_id;

UPDATE public.payment_webhook_events target
SET related_subscription_id = remap.keep_id
FROM marketplace_subscription_remap remap
WHERE target.related_subscription_id = remap.duplicate_id;

DELETE FROM public.user_subscriptions target
USING marketplace_subscription_remap remap
WHERE target.id = remap.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_dodo_subscription
ON public.user_subscriptions(environment, external_subscription_id)
WHERE external_subscription_id IS NOT NULL AND btrim(external_subscription_id) <> '';

-- 4. One entitlement per purchased license.
CREATE TEMP TABLE marketplace_entitlement_remap ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY purchased_license_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY purchased_license_id
      ORDER BY created_at ASC, id ASC
    ) AS position
  FROM public.download_entitlements
  WHERE purchased_license_id IS NOT NULL
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE position > 1;

WITH totals AS (
  SELECT
    purchased_license_id,
    max(download_count) AS download_count,
    max(downloads_used) AS downloads_used,
    max(max_downloads) AS max_downloads,
    max(last_downloaded_at) AS last_downloaded_at
  FROM public.download_entitlements
  WHERE purchased_license_id IS NOT NULL
  GROUP BY purchased_license_id
), canonical AS (
  SELECT DISTINCT keep_id FROM marketplace_entitlement_remap
)
UPDATE public.download_entitlements target
SET
  download_count = greatest(target.download_count, totals.download_count),
  downloads_used = greatest(target.downloads_used, totals.downloads_used),
  max_downloads = greatest(target.max_downloads, totals.max_downloads),
  last_downloaded_at = greatest(target.last_downloaded_at, totals.last_downloaded_at)
FROM totals, canonical
WHERE target.id = canonical.keep_id
  AND target.purchased_license_id = totals.purchased_license_id;

UPDATE public.download_events target
SET entitlement_id = remap.keep_id
FROM marketplace_entitlement_remap remap
WHERE target.entitlement_id = remap.duplicate_id;

DELETE FROM public.download_entitlements target
USING marketplace_entitlement_remap remap
WHERE target.id = remap.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_download_entitlements_purchased_license
ON public.download_entitlements(purchased_license_id)
WHERE purchased_license_id IS NOT NULL;

-- 5. One administrative refund per external Dodo refund id.
CREATE TEMP TABLE marketplace_refund_remap ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY external_refund_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY external_refund_id
      ORDER BY created_at ASC, id ASC
    ) AS position
  FROM public.refunds
  WHERE external_refund_id IS NOT NULL AND btrim(external_refund_id) <> ''
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE position > 1;

UPDATE public.refund_items target
SET refund_id = remap.keep_id
FROM marketplace_refund_remap remap
WHERE target.refund_id = remap.duplicate_id;

DELETE FROM public.refunds target
USING marketplace_refund_remap remap
WHERE target.id = remap.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY refund_id, order_item_id
      ORDER BY created_at ASC, id ASC
    ) AS position
  FROM public.refund_items
  WHERE order_item_id IS NOT NULL
)
DELETE FROM public.refund_items target
USING ranked
WHERE target.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_external_refund
ON public.refunds(external_refund_id)
WHERE external_refund_id IS NOT NULL AND btrim(external_refund_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_items_order_item
ON public.refund_items(refund_id, order_item_id)
WHERE order_item_id IS NOT NULL;

-- 6. One active draft/pending order for a normalized checkout key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_active_checkout_key
ON public.orders(user_id, environment, ((metadata ->> 'checkout_key')))
WHERE status IN ('draft', 'pending')
  AND metadata ? 'checkout_key'
  AND btrim(metadata ->> 'checkout_key') <> '';

COMMIT;
