-- ============================================================
-- SEAFOOD VISION — Checkout Intent Persistence
-- Stores purchase intent server-side so it survives auth flow.
-- ============================================================

-- checkout_intents: temporary server-side purchase intent storage
CREATE TABLE IF NOT EXISTS public.checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_token TEXT NOT NULL UNIQUE,          -- random token stored in cookie
  session_id TEXT,                            -- optional: link to anon session
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  internal_product_type TEXT NOT NULL,        -- 'subscription_plan' | 'credit_pack' | 'asset_license'
  internal_product_id TEXT NOT NULL,          -- plan_code, pack_code, or product_code
  plan_slug TEXT,                             -- e.g. 'professional'
  billing_cycle TEXT,                         -- 'monthly' | 'annual'
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  license_type_id UUID REFERENCES public.license_types(id) ON DELETE SET NULL,
  source_page TEXT NOT NULL DEFAULT '/pricing',
  return_path TEXT NOT NULL DEFAULT '/checkout/resume',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  claimed_at TIMESTAMPTZ,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_checkout_intents_token ON public.checkout_intents(intent_token);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_user ON public.checkout_intents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_intents_expires ON public.checkout_intents(expires_at);

-- RLS: users can only see their own intents; server uses service role
ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own checkout intents" ON public.checkout_intents;
CREATE POLICY "Users can read own checkout intents"
  ON public.checkout_intents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own checkout intents" ON public.checkout_intents;
CREATE POLICY "Users can update own checkout intents"
  ON public.checkout_intents FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass (for server-side API routes)
DROP POLICY IF EXISTS "Service role full access checkout intents" ON public.checkout_intents;
CREATE POLICY "Service role full access checkout intents"
  ON public.checkout_intents FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-cleanup expired intents (optional, run via cron or on-demand)
-- Intents older than 2 hours are automatically excluded by application logic.

-- ── Ensure payment_product_mappings has needed columns ──────
ALTER TABLE public.payment_product_mappings
  ADD COLUMN IF NOT EXISTS dodo_product_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_price_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ── Ensure orders has external_checkout_id ──────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_intent_id UUID REFERENCES public.checkout_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_external_checkout ON public.orders(external_checkout_id) WHERE external_checkout_id IS NOT NULL;

-- ── Ensure payment_webhook_events has needed columns ────────
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ── Ensure user_subscriptions has needed columns ─────────────
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS external_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_external ON public.user_subscriptions(external_subscription_id) WHERE external_subscription_id IS NOT NULL;

-- ── Ensure download_entitlements has needed columns ──────────
ALTER TABLE public.download_entitlements
  ADD COLUMN IF NOT EXISTS downloads_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ;
