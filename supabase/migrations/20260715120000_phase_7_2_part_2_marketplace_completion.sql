-- ============================================================
-- SEAFOOD VISION — Phase 7.2 Part 2
-- Marketplace Completion
-- Migration: phase_7_2_part_2_marketplace_completion
-- ============================================================
-- New tables:
--   download_events, coupons, coupon_usages, promotions,
--   promotion_items, commercial_collections, collection_items,
--   refunds, refund_items, marketplace_settings
-- Extended tables:
--   download_entitlements (entitlement_type, revoked_reason columns)
-- ============================================================

-- ─── 1. EXTEND DOWNLOAD ENTITLEMENTS ────────────────────────

ALTER TABLE public.download_entitlements
  ADD COLUMN IF NOT EXISTS entitlement_type TEXT NOT NULL DEFAULT 'purchased_license',
  ADD COLUMN IF NOT EXISTS allowed_resolution TEXT,
  ADD COLUMN IF NOT EXISTS downloads_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Sync downloads_used with download_count (same semantic)
UPDATE public.download_entitlements
SET downloads_used = download_count
WHERE downloads_used = 0 AND download_count > 0;

-- ─── 2. DOWNLOAD EVENTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  entitlement_id UUID REFERENCES public.download_entitlements(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  resolution_downloaded TEXT,
  result TEXT NOT NULL DEFAULT 'success',
  signed_url_duration_seconds INTEGER DEFAULT 3600,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_download_events_user_id ON public.download_events(user_id);
CREATE INDEX IF NOT EXISTS idx_download_events_asset_id ON public.download_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_download_events_entitlement_id ON public.download_events(entitlement_id);
CREATE INDEX IF NOT EXISTS idx_download_events_downloaded_at ON public.download_events(downloaded_at);

-- ─── 3. COUPONS ─────────────────────────────────────────────

DROP TYPE IF EXISTS public.coupon_type CASCADE;
CREATE TYPE public.coupon_type AS ENUM ('fixed', 'percentage');

DROP TYPE IF EXISTS public.coupon_status CASCADE;
CREATE TYPE public.coupon_status AS ENUM ('active', 'inactive', 'expired', 'exhausted');

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  coupon_type public.coupon_type NOT NULL DEFAULT 'percentage',
  discount_amount NUMERIC(10,2),
  discount_pct NUMERIC(5,2),
  currency CHAR(3) DEFAULT 'EUR',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(10,2),
  applicable_product_types TEXT[],
  applicable_plan_ids UUID[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  status public.coupon_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT coupon_discount_check CHECK (
    (coupon_type = 'fixed' AND discount_amount IS NOT NULL AND discount_amount > 0)
    OR (coupon_type = 'percentage' AND discount_pct IS NOT NULL AND discount_pct > 0 AND discount_pct <= 100)
  )
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON public.coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON public.coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON public.coupon_usages(user_id);

-- ─── 4. PROMOTIONS ──────────────────────────────────────────

DROP TYPE IF EXISTS public.promotion_type CASCADE;
CREATE TYPE public.promotion_type AS ENUM ('discount', 'campaign', 'pack', 'collection');

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  promotion_type public.promotion_type NOT NULL DEFAULT 'discount',
  discount_pct NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  currency CHAR(3) DEFAULT 'EUR',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_coupon BOOLEAN NOT NULL DEFAULT false,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  applicable_plan_ids UUID[],
  applicable_product_types TEXT[],
  banner_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  override_price NUMERIC(10,2),
  override_discount_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_slug ON public.promotions(slug);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotion_items_promotion_id ON public.promotion_items(promotion_id);

-- ─── 5. COMMERCIAL COLLECTIONS ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.commercial_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_for_sale BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(10,2),
  currency CHAR(3) DEFAULT 'EUR',
  discount_pct NUMERIC(5,2) DEFAULT 0,
  requires_subscription BOOLEAN NOT NULL DEFAULT false,
  required_plan_ids UUID[],
  asset_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.commercial_collections(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (collection_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_collections_slug ON public.commercial_collections(slug);
CREATE INDEX IF NOT EXISTS idx_commercial_collections_active ON public.commercial_collections(is_active);
CREATE INDEX IF NOT EXISTS idx_commercial_collection_items_collection_id ON public.commercial_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_commercial_collection_items_asset_id ON public.commercial_collection_items(asset_id);

-- ─── 6. REFUNDS ─────────────────────────────────────────────

DROP TYPE IF EXISTS public.refund_status CASCADE;
CREATE TYPE public.refund_status AS ENUM (
  'requested', 'approved', 'rejected', 'processing', 'completed'
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  refund_number TEXT NOT NULL UNIQUE DEFAULT 'REF-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8),
  status public.refund_status NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  is_partial BOOLEAN NOT NULL DEFAULT false,
  revoke_licenses BOOLEAN NOT NULL DEFAULT true,
  revoke_entitlements BOOLEAN NOT NULL DEFAULT true,
  restore_credits BOOLEAN NOT NULL DEFAULT false,
  external_refund_id TEXT,
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL,
  item_id UUID,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON public.refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund_id ON public.refund_items(refund_id);

-- ─── 7. MARKETPLACE SETTINGS ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT NOT NULL DEFAULT 'string',
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default marketplace settings
INSERT INTO public.marketplace_settings (setting_key, setting_value, setting_type, label, description, category, is_public)
VALUES
  ('default_currency', 'EUR', 'string', 'Default Currency', 'ISO 4217 currency code for all transactions', 'general', true),
  ('default_vat_pct', '20', 'number', 'Default VAT (%)', 'Default VAT percentage applied to orders', 'tax', false),
  ('signed_url_duration_seconds', '3600', 'number', 'Signed URL Duration (s)', 'How long download signed URLs remain valid', 'downloads', false),
  ('max_downloads_per_entitlement', '3', 'number', 'Max Downloads per Entitlement', 'Default maximum download count per entitlement', 'downloads', false),
  ('max_file_size_mb', '500', 'number', 'Max File Size (MB)', 'Maximum allowed file size for downloads', 'downloads', false),
  ('marketplace_enabled', 'false', 'boolean', 'Marketplace Enabled', 'Master switch to enable or disable the marketplace', 'general', true),
  ('maintenance_mode', 'false', 'boolean', 'Maintenance Mode', 'Put the marketplace in maintenance mode', 'general', true),
  ('payment_provider', 'dodo_payments', 'string', 'Payment Provider', 'Active payment provider (Dodo Payments — not yet configured)', 'payments', false),
  ('discount_enabled', 'true', 'boolean', 'Discounts Enabled', 'Allow coupons and promotions to be applied', 'promotions', false),
  ('free_trial_days', '0', 'number', 'Free Trial Days', 'Default trial period in days for paid plans', 'subscriptions', false)
ON CONFLICT (setting_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_marketplace_settings_category ON public.marketplace_settings(category);

-- ─── 8. RLS POLICIES ────────────────────────────────────────

-- download_events
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own download events"
  ON public.download_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all download events"
  ON public.download_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

CREATE POLICY "Server inserts download events"
  ON public.download_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active coupons by code"
  ON public.coupons FOR SELECT
  USING (is_active = true AND status = 'active');

CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- coupon_usages
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own coupon usages"
  ON public.coupon_usages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins see all coupon usages"
  ON public.coupon_usages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- promotions
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active promotions"
  ON public.promotions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage promotions"
  ON public.promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- promotion_items
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read promotion items"
  ON public.promotion_items FOR SELECT
  USING (true);

CREATE POLICY "Admins manage promotion items"
  ON public.promotion_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- commercial_collections
ALTER TABLE public.commercial_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active collections"
  ON public.commercial_collections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage commercial collections"
  ON public.commercial_collections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- commercial_collection_items
ALTER TABLE public.commercial_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read collection items"
  ON public.commercial_collection_items FOR SELECT
  USING (true);

CREATE POLICY "Admins manage collection items"
  ON public.commercial_collection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- refunds
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own refunds"
  ON public.refunds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can request refunds"
  ON public.refunds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage refunds"
  ON public.refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- refund_items
ALTER TABLE public.refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage refund items"
  ON public.refund_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

-- marketplace_settings
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public settings"
  ON public.marketplace_settings FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins read all settings"
  ON public.marketplace_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('administrator', 'super_admin')
    )
  );

CREATE POLICY "Super admins manage settings"
  ON public.marketplace_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ─── 9. HELPER: CREDIT BALANCE VIEW ─────────────────────────

CREATE OR REPLACE VIEW public.user_credit_balances AS
SELECT
  user_id,
  COALESCE(
    (SELECT balance_after FROM public.credit_ledger cl2
     WHERE cl2.user_id = cl.user_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) AS current_balance,
  COALESCE(SUM(CASE WHEN movement_type = 'purchase' THEN amount ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN movement_type = 'usage' THEN ABS(amount) ELSE 0 END), 0) AS total_used
FROM public.credit_ledger cl
GROUP BY user_id;
