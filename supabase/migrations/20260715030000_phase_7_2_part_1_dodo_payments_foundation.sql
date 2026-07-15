-- ============================================================
-- SEAFOOD VISION — Phase 7.2 Part 1
-- Dodo Payments Foundation — Commerce Infrastructure
-- Migration: phase_7_2_part_1_dodo_payments_foundation
-- ============================================================
-- Existing tables reused: pricing_plans, subscriptions, purchases,
--   purchase_items, licenses
-- New tables: subscription_plans (extended), unit_products, license_types,
--   credit_packs, orders, order_items, payment_transactions,
--   user_subscriptions, subscription_events, purchased_licenses,
--   download_entitlements, credit_ledger, payment_webhook_events,
--   payment_product_mappings
-- ============================================================

-- ─── 1. ENUM TYPES ──────────────────────────────────────────

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM (
  'draft', 'pending', 'paid', 'failed', 'cancelled',
  'refunded', 'partially_refunded', 'disputed'
);

DROP TYPE IF EXISTS public.order_type CASCADE;
CREATE TYPE public.order_type AS ENUM (
  'asset_license', 'subscription', 'credit_pack', 'image_pack', 'enterprise_custom'
);

DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM (
  'pending', 'processing', 'succeeded', 'failed',
  'cancelled', 'refunded', 'disputed'
);

DROP TYPE IF EXISTS public.payment_type CASCADE;
CREATE TYPE public.payment_type AS ENUM (
  'one_time', 'subscription', 'credit_pack'
);

DROP TYPE IF EXISTS public.webhook_processing_status CASCADE;
CREATE TYPE public.webhook_processing_status AS ENUM (
  'received', 'processing', 'processed', 'failed', 'ignored_duplicate'
);

DROP TYPE IF EXISTS public.credit_movement_type CASCADE;
CREATE TYPE public.credit_movement_type AS ENUM (
  'purchase', 'grant', 'usage', 'refund', 'expiration', 'admin_adjustment'
);

DROP TYPE IF EXISTS public.subscription_billing_cycle CASCADE;
CREATE TYPE public.subscription_billing_cycle AS ENUM (
  'monthly', 'annual'
);

DROP TYPE IF EXISTS public.dodo_subscription_status CASCADE;
CREATE TYPE public.dodo_subscription_status AS ENUM (
  'pending', 'active', 'trialing', 'past_due', 'paused', 'cancelled', 'expired'
);

DROP TYPE IF EXISTS public.internal_product_type CASCADE;
CREATE TYPE public.internal_product_type AS ENUM (
  'subscription_plan', 'one_time_asset_license', 'credit_pack',
  'image_pack', 'enterprise_custom'
);

DROP TYPE IF EXISTS public.dodo_environment CASCADE;
CREATE TYPE public.dodo_environment AS ENUM ('test', 'production');

DROP TYPE IF EXISTS public.license_territory CASCADE;
CREATE TYPE public.license_territory AS ENUM (
  'worldwide', 'eu', 'us', 'fr', 'custom'
);

DROP TYPE IF EXISTS public.entitlement_status CASCADE;
CREATE TYPE public.entitlement_status AS ENUM (
  'pending', 'active', 'expired', 'revoked'
);

-- ─── 2. SUBSCRIPTION PLANS (extended) ───────────────────────
-- Extends the existing pricing_plans table with Dodo-compatible fields

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS plan_code TEXT,
  ADD COLUMN IF NOT EXISTS price_annual NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS annual_discount_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS billing_cycles TEXT[] DEFAULT ARRAY['monthly','annual'],
  ADD COLUMN IF NOT EXISTS downloads_monthly INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_credits_monthly INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_spaces BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_360_access BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── 3. UNIT PRODUCTS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unit_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'image',
  price NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  resolution_allowed TEXT,
  download_quota INTEGER DEFAULT 1,
  license_type_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  available_from TIMESTAMPTZ,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. LICENSE TYPES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.license_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  rights_allowed TEXT[],
  restrictions TEXT[],
  territory public.license_territory DEFAULT 'worldwide',
  duration_months INTEGER,
  max_users INTEGER DEFAULT 1,
  max_reproductions INTEGER,
  resolution_allowed TEXT,
  price NUMERIC(10,2),
  currency CHAR(3) DEFAULT 'EUR',
  terms_version TEXT DEFAULT '1.0',
  effective_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. CREDIT PACKS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  price_per_credit NUMERIC(8,4) GENERATED ALWAYS AS (price / NULLIF(credits, 0)) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_after_days INTEGER,
  is_popular BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. PAYMENT PRODUCT MAPPINGS ────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_product_type public.internal_product_type NOT NULL,
  internal_product_id UUID NOT NULL,
  dodo_product_id TEXT,
  dodo_price_id TEXT,
  environment public.dodo_environment NOT NULL DEFAULT 'test',
  currency CHAR(3) DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (internal_product_type, internal_product_id, environment)
);

-- ─── 7. ORDERS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL UNIQUE,
  order_type public.order_type NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'draft',
  external_checkout_id TEXT,
  external_payment_id TEXT,
  environment public.dodo_environment NOT NULL DEFAULT 'test',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- ─── 8. ORDER ITEMS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type public.order_type NOT NULL,
  internal_product_id UUID,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  license_type_id UUID REFERENCES public.license_types(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. PAYMENT TRANSACTIONS ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'dodo_payments',
  external_payment_id TEXT,
  external_customer_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_type public.payment_type NOT NULL DEFAULT 'one_time',
  environment public.dodo_environment NOT NULL DEFAULT 'test',
  raw_status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- ─── 10. USER SUBSCRIPTIONS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  external_subscription_id TEXT,
  external_customer_id TEXT,
  status public.dodo_subscription_status NOT NULL DEFAULT 'pending',
  environment public.dodo_environment NOT NULL DEFAULT 'test',
  billing_cycle public.subscription_billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. SUBSCRIPTION EVENTS ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  from_status public.dodo_subscription_status,
  to_status public.dodo_subscription_status,
  from_plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  to_plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  external_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 12. PURCHASED LICENSES ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchased_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  license_type_id UUID NOT NULL REFERENCES public.license_types(id) ON DELETE RESTRICT,
  terms_version TEXT NOT NULL DEFAULT '1.0',
  purchased_at TIMESTAMPTZ DEFAULT now(),
  status public.entitlement_status NOT NULL DEFAULT 'pending',
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, asset_id, license_type_id, order_id)
);

-- ─── 13. DOWNLOAD ENTITLEMENTS ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.download_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  purchased_license_id UUID REFERENCES public.purchased_licenses(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status public.entitlement_status NOT NULL DEFAULT 'pending',
  resolution_allowed TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. CREDIT LEDGER ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  movement_type public.credit_movement_type NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT credit_ledger_amount_nonzero CHECK (amount != 0)
);

-- ─── 15. PAYMENT WEBHOOK EVENTS ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  environment public.dodo_environment NOT NULL DEFAULT 'test',
  processing_status public.webhook_processing_status NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL
);

-- ─── 16. INDEXES ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_external_checkout_id ON public.orders(external_checkout_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_payment_id ON public.payment_transactions(external_payment_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_external_id ON public.user_subscriptions(external_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_purchased_licenses_user_id ON public.purchased_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_purchased_licenses_asset_id ON public.purchased_licenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_download_entitlements_user_id ON public.download_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_download_entitlements_asset_id ON public.download_entitlements(asset_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON public.credit_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON public.payment_webhook_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.payment_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_payment_product_mappings_type_id ON public.payment_product_mappings(internal_product_type, internal_product_id);
CREATE INDEX IF NOT EXISTS idx_unit_products_active ON public.unit_products(is_active);
CREATE INDEX IF NOT EXISTS idx_credit_packs_active ON public.credit_packs(is_active);
CREATE INDEX IF NOT EXISTS idx_license_types_code ON public.license_types(code);

-- ─── 17. HELPER FUNCTIONS ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM public.credit_ledger
     WHERE user_id = p_user_id
     ORDER BY created_at DESC
     LIMIT 1),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('administrator', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_number TEXT;
BEGIN
  v_number := 'SV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
              UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
  RETURN v_number;
END;
$$;

-- ─── 18. ENABLE RLS ─────────────────────────────────────────

ALTER TABLE public.unit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchased_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- ─── 19. RLS POLICIES ───────────────────────────────────────

-- unit_products: public read active, admin write
DROP POLICY IF EXISTS "public_read_active_unit_products" ON public.unit_products;
CREATE POLICY "public_read_active_unit_products"
ON public.unit_products FOR SELECT TO public
USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_unit_products" ON public.unit_products;
CREATE POLICY "admin_manage_unit_products"
ON public.unit_products FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- license_types: public read active, admin write
DROP POLICY IF EXISTS "public_read_active_license_types" ON public.license_types;
CREATE POLICY "public_read_active_license_types"
ON public.license_types FOR SELECT TO public
USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_license_types" ON public.license_types;
CREATE POLICY "admin_manage_license_types"
ON public.license_types FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- credit_packs: public read active, admin write
DROP POLICY IF EXISTS "public_read_active_credit_packs" ON public.credit_packs;
CREATE POLICY "public_read_active_credit_packs"
ON public.credit_packs FOR SELECT TO public
USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_credit_packs" ON public.credit_packs;
CREATE POLICY "admin_manage_credit_packs"
ON public.credit_packs FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- payment_product_mappings: admin only
DROP POLICY IF EXISTS "admin_manage_payment_product_mappings" ON public.payment_product_mappings;
CREATE POLICY "admin_manage_payment_product_mappings"
ON public.payment_product_mappings FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- orders: user reads own, admin reads all
DROP POLICY IF EXISTS "users_read_own_orders" ON public.orders;
CREATE POLICY "users_read_own_orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_orders" ON public.orders;
CREATE POLICY "admin_manage_orders"
ON public.orders FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- order_items: user reads own via order
DROP POLICY IF EXISTS "users_read_own_order_items" ON public.order_items;
CREATE POLICY "users_read_own_order_items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admin_manage_order_items" ON public.order_items;
CREATE POLICY "admin_manage_order_items"
ON public.order_items FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- payment_transactions: user reads own
DROP POLICY IF EXISTS "users_read_own_payment_transactions" ON public.payment_transactions;
CREATE POLICY "users_read_own_payment_transactions"
ON public.payment_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_payment_transactions" ON public.payment_transactions;
CREATE POLICY "admin_manage_payment_transactions"
ON public.payment_transactions FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- user_subscriptions: user reads own
DROP POLICY IF EXISTS "users_read_own_subscriptions" ON public.user_subscriptions;
CREATE POLICY "users_read_own_subscriptions"
ON public.user_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_user_subscriptions" ON public.user_subscriptions;
CREATE POLICY "admin_manage_user_subscriptions"
ON public.user_subscriptions FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- subscription_events: user reads own
DROP POLICY IF EXISTS "users_read_own_subscription_events" ON public.subscription_events;
CREATE POLICY "users_read_own_subscription_events"
ON public.subscription_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_subscription_events" ON public.subscription_events;
CREATE POLICY "admin_manage_subscription_events"
ON public.subscription_events FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- purchased_licenses: user reads own
DROP POLICY IF EXISTS "users_read_own_purchased_licenses" ON public.purchased_licenses;
CREATE POLICY "users_read_own_purchased_licenses"
ON public.purchased_licenses FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_purchased_licenses" ON public.purchased_licenses;
CREATE POLICY "admin_manage_purchased_licenses"
ON public.purchased_licenses FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- download_entitlements: user reads own
DROP POLICY IF EXISTS "users_read_own_download_entitlements" ON public.download_entitlements;
CREATE POLICY "users_read_own_download_entitlements"
ON public.download_entitlements FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_download_entitlements" ON public.download_entitlements;
CREATE POLICY "admin_manage_download_entitlements"
ON public.download_entitlements FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- credit_ledger: user reads own
DROP POLICY IF EXISTS "users_read_own_credit_ledger" ON public.credit_ledger;
CREATE POLICY "users_read_own_credit_ledger"
ON public.credit_ledger FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_credit_ledger" ON public.credit_ledger;
CREATE POLICY "admin_manage_credit_ledger"
ON public.credit_ledger FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- payment_webhook_events: admin only (no user access)
DROP POLICY IF EXISTS "admin_manage_webhook_events" ON public.payment_webhook_events;
CREATE POLICY "admin_manage_webhook_events"
ON public.payment_webhook_events FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- ─── 20. SEED DATA ───────────────────────────────────────────

-- Subscription plans seed
DO $$
BEGIN
  -- Upsert plan_code on existing pricing_plans rows if any exist
  -- Insert the 5 canonical plans
  INSERT INTO public.pricing_plans (id, name, plan_code, price_monthly, price_annual, currency,
    downloads_monthly, ai_access, api_access, private_spaces, video_access, view_360_access,
    trial_days, grace_period_days, is_enterprise, sort_order, is_active, features)
  VALUES
    (gen_random_uuid(), 'Free', 'free', 0, 0, 'EUR', 0, false, false, false, false, false, 0, 0, false, 0, true,
     '[{"label":"Browse full catalog","included":true},{"label":"Watermarked previews","included":true},{"label":"Limited search (10/day)","included":true},{"label":"Downloads","included":false}]'::jsonb),
    (gen_random_uuid(), 'Explorer', 'explorer', 29, 290, 'EUR', 30, true, false, false, false, false, 0, 3, false, 1, true,
     '[{"label":"30 downloads/month","included":true},{"label":"Full encyclopedia","included":true},{"label":"AI-powered search","included":true},{"label":"HD images","included":false}]'::jsonb),
    (gen_random_uuid(), 'Professional', 'professional', 79, 790, 'EUR', 150, true, false, false, false, false, 0, 3, false, 2, true,
     '[{"label":"150 downloads/month","included":true},{"label":"HD images","included":true},{"label":"Full AI suite","included":true},{"label":"Marketing Kit","included":true}]'::jsonb),
    (gen_random_uuid(), 'Business', 'business', 199, 1990, 'EUR', 500, true, true, true, true, true, 0, 3, false, 3, true,
     '[{"label":"500 downloads/month","included":true},{"label":"Ultra HD images","included":true},{"label":"API access","included":true},{"label":"Private spaces","included":true}]'::jsonb),
    (gen_random_uuid(), 'Enterprise', 'enterprise', null, null, 'EUR', null, true, true, true, true, true, 0, 7, true, 4, true,
     '[{"label":"Unlimited downloads","included":true},{"label":"Multi-user","included":true},{"label":"Custom licensing","included":true},{"label":"Dedicated support","included":true}]'::jsonb)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Subscription plans seed skipped: %', SQLERRM;
END $$;

-- Unit products seed
DO $$
BEGIN
  INSERT INTO public.unit_products (product_code, name, description, product_type, price, currency, resolution_allowed, download_quota, is_active)
  VALUES
    ('photo_web', 'Photo Web', 'Web-optimised image (72 dpi, up to 1920px)', 'image', 5.00, 'EUR', 'web', 1, true),
    ('photo_hd', 'Photo HD', 'High-definition image (300 dpi, up to 4K)', 'image', 20.00, 'EUR', 'hd', 1, true),
    ('photo_ultrahd', 'Photo Ultra HD', 'Ultra HD image (full resolution, up to 8K)', 'image', 40.00, 'EUR', 'ultrahd', 1, true),
    ('video', 'Video', 'Professional video clip (MP4, up to 4K)', 'video', 75.00, 'EUR', 'hd', 1, true),
    ('view_360', 'Vue 360°', 'Interactive 360° product view', '360', 50.00, 'EUR', 'hd', 1, true),
    ('pack_10', 'Pack 10 images', 'Bundle of 10 web-resolution images', 'image_pack', 150.00, 'EUR', 'web', 10, true)
  ON CONFLICT (product_code) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Unit products seed skipped: %', SQLERRM;
END $$;

-- License types seed
DO $$
BEGIN
  INSERT INTO public.license_types (code, name, description, rights_allowed, restrictions, territory, duration_months, max_users, price, currency, terms_version, is_active, is_exclusive)
  VALUES
    ('editorial', 'Editorial License', 'For editorial and journalistic use only. Not for commercial advertising.', 
     ARRAY['editorial_print','editorial_digital','news','education'],
     ARRAY['no_commercial_advertising','no_product_packaging','no_resale'],
     'worldwide', null, 1, 5.00, 'EUR', '1.0', true, false),
    ('commercial', 'Commercial License', 'For commercial use including advertising and marketing materials.',
     ARRAY['advertising','marketing','product_packaging','digital_media'],
     ARRAY['no_resale','no_sublicense'],
     'worldwide', null, 1, 20.00, 'EUR', '1.0', true, false),
    ('extended', 'Extended Commercial License', 'Broad commercial rights including merchandise and resale products.',
     ARRAY['advertising','marketing','merchandise','resale_products','unlimited_print'],
     ARRAY['no_sublicense'],
     'worldwide', null, 5, 40.00, 'EUR', '1.0', true, false),
    ('exclusive', 'Exclusive License', 'Exclusive rights — asset removed from catalog for the license duration.',
     ARRAY['all_uses','exclusive_worldwide'],
     ARRAY['negotiated_terms_apply'],
     'worldwide', 24, 1, null, 'EUR', '1.0', true, true)
  ON CONFLICT (code) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'License types seed skipped: %', SQLERRM;
END $$;

-- Credit packs seed
DO $$
BEGIN
  INSERT INTO public.credit_packs (pack_code, name, credits, price, currency, is_active, is_popular)
  VALUES
    ('credits_100', '100 Credits', 100, 9.00, 'EUR', true, false),
    ('credits_250', '250 Credits', 250, 19.00, 'EUR', true, true),
    ('credits_500', '500 Credits', 500, 35.00, 'EUR', true, false),
    ('credits_1000', '1000 Credits', 1000, 59.00, 'EUR', true, false)
  ON CONFLICT (pack_code) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Credit packs seed skipped: %', SQLERRM;
END $$;
