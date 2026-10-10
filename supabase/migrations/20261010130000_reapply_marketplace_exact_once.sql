-- SeafoodVision — marketplace exact-once guarantees (re-application of 20260718100000, DDL only).
--
-- 20260718100000 is marked applied in the history but only its first part ran (billing_cycle and the two payment-mapping
-- indexes exist). Missing in the database: credit_ledger.transaction_id, apply_credit_purchase() and seven unique indexes.
--
-- This migration is idempotent and contains NO DELETE and NO UPDATE. The original's data reconciliation (merging duplicate
-- transactions / subscriptions / entitlements / refunds, removing duplicate credit purchases, back-filling
-- credit_ledger.transaction_id) is deliberately left out: before writing this file the data was checked read-only and
-- contains no row that violates any of the unique indexes below (0 duplicate groups each). If a duplicate appeared
-- between that check and the push, CREATE UNIQUE INDEX fails and the whole migration rolls back untouched.
-- No Dodo identifier appears here.

BEGIN;

-- 1. One Dodo payment transaction per provider / environment / payment id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_dodo_payment
ON public.payment_transactions(provider, environment, external_payment_id)
WHERE external_payment_id IS NOT NULL AND btrim(external_payment_id) <> '';

-- 2. A credit-pack order can credit the wallet only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_purchase_order
ON public.credit_ledger(order_id)
WHERE movement_type = 'purchase' AND order_id IS NOT NULL;

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL;

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
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_dodo_subscription
ON public.user_subscriptions(environment, external_subscription_id)
WHERE external_subscription_id IS NOT NULL AND btrim(external_subscription_id) <> '';

-- 4. One entitlement per purchased license.
CREATE UNIQUE INDEX IF NOT EXISTS uq_download_entitlements_purchased_license
ON public.download_entitlements(purchased_license_id)
WHERE purchased_license_id IS NOT NULL;

-- 5. One administrative refund per external Dodo refund id, one refund item per order line.
CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_external_refund
ON public.refunds(external_refund_id)
WHERE external_refund_id IS NOT NULL AND btrim(external_refund_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_items_order_item
ON public.refund_items(refund_id, order_item_id)
WHERE order_item_id IS NOT NULL;

-- 6. One active draft/pending order per normalized checkout key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_active_checkout_key
ON public.orders(user_id, environment, ((metadata ->> 'checkout_key')))
WHERE status IN ('draft', 'pending')
  AND metadata ? 'checkout_key'
  AND btrim(metadata ->> 'checkout_key') <> '';

NOTIFY pgrst, 'reload schema';

COMMIT;
