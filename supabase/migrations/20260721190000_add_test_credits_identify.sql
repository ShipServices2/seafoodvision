-- ============================================================
-- SeafoodVision — Add 20 test credits for the current test account
-- and ensure credit_ledger RLS allows service-role inserts.
-- Migration: 20260721190000_add_test_credits_identify.sql
-- ============================================================

-- Add 20 test credits to the first (and only) user in profiles
-- This is idempotent: only inserts if no test-credit row already exists for this user.
DO $$
DECLARE
  v_user_id UUID;
  v_current_balance INTEGER;
  v_already_added INTEGER;
BEGIN
  -- Find the test user (only 1 profile exists)
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '[test-credits] No user found in profiles — skipping.';
    RETURN;
  END IF;

  -- Check if we already added test credits (avoid double-crediting on re-run)
  SELECT COUNT(*) INTO v_already_added
  FROM public.credit_ledger
  WHERE user_id = v_user_id
    AND reference = 'test_credit_identify_20260721';

  IF v_already_added > 0 THEN
    RAISE NOTICE '[test-credits] Test credits already added for userId=% — skipping.', v_user_id;
    RETURN;
  END IF;

  -- Get current balance (SUM of all ledger entries, or 0 if none)
  SELECT COALESCE(SUM(amount), 0) INTO v_current_balance
  FROM public.credit_ledger
  WHERE user_id = v_user_id;

  RAISE NOTICE '[test-credits] userId=% | balance_before=% | adding 20 test credits', v_user_id, v_current_balance;

  INSERT INTO public.credit_ledger (
    user_id,
    movement_type,
    amount,
    reason,
    reference,
    balance_before,
    balance_after
  ) VALUES (
    v_user_id,
    'purchase',
    20,
    'Test credits — SeafoodVision Identify validation (20260721)',
    'test_credit_identify_20260721',
    v_current_balance,
    v_current_balance + 20
  );

  RAISE NOTICE '[test-credits] 20 credits added. New balance=%', v_current_balance + 20;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[test-credits] Failed: %', SQLERRM;
END $$;
