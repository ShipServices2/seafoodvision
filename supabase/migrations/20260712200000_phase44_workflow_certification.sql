-- ============================================================
-- Seafood Vision — Phase 4.4: Asset Review, Certification Workflow,
-- Commercial Readiness & Licensing Preparation
-- Timestamp: 20260712200000
-- ============================================================

-- ============================================================
-- SECTION 1: NEW ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.workflow_status CASCADE;
CREATE TYPE public.workflow_status AS ENUM (
  'imported',
  'metadata_review',
  'species_validation',
  'technical_review',
  'rights_review',
  'commercial_review',
  'certified',
  'published',
  'commercial_license_ready'
);

DROP TYPE IF EXISTS public.comment_type CASCADE;
CREATE TYPE public.comment_type AS ENUM (
  'comment',
  'suggestion',
  'correction'
);

DROP TYPE IF EXISTS public.badge_type CASCADE;
CREATE TYPE public.badge_type AS ENUM (
  'imported',
  'under_review',
  'metadata_complete',
  'species_verified',
  'technical_verified',
  'rights_verified',
  'certified',
  'commercial_ready',
  'editorial_ready',
  'premium_asset',
  'featured'
);

-- ============================================================
-- SECTION 2: NEW TABLES
-- ============================================================

-- Asset workflow status (extended workflow beyond review_status)
CREATE TABLE IF NOT EXISTS public.asset_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  workflow_status public.workflow_status NOT NULL DEFAULT 'imported',
  previous_status public.workflow_status,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT,
  CONSTRAINT fk_asset_workflow_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_asset_workflow_changer FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Commercial readiness checklist per asset
CREATE TABLE IF NOT EXISTS public.asset_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE,
  species_validated BOOLEAN NOT NULL DEFAULT false,
  technical_quality BOOLEAN NOT NULL DEFAULT false,
  rights_verified BOOLEAN NOT NULL DEFAULT false,
  metadata_completed BOOLEAN NOT NULL DEFAULT false,
  packaging_completed BOOLEAN NOT NULL DEFAULT false,
  keywords_completed BOOLEAN NOT NULL DEFAULT false,
  preview_available BOOLEAN NOT NULL DEFAULT false,
  thumbnail_available BOOLEAN NOT NULL DEFAULT false,
  original_available BOOLEAN NOT NULL DEFAULT false,
  license_ready BOOLEAN NOT NULL DEFAULT false,
  publication_ready BOOLEAN NOT NULL DEFAULT false,
  commercial_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  technical_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_asset_readiness_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_asset_readiness_updater FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Asset badges
CREATE TABLE IF NOT EXISTS public.asset_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  badge public.badge_type NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, badge),
  CONSTRAINT fk_asset_badges_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_asset_badges_granter FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Internal reviewer comments
CREATE TABLE IF NOT EXISTS public.asset_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  comment_type public.comment_type NOT NULL DEFAULT 'comment',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_review_comments_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_comments_reviewer FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- License preparation (no payments, Coming Soon)
CREATE TABLE IF NOT EXISTS public.license_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_type public.license_type NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  rights TEXT,
  restrictions TEXT,
  indicative_price_eur NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT false,
  coming_soon BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_asset_workflow_asset_id ON public.asset_workflow(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_workflow_status ON public.asset_workflow(workflow_status);
CREATE INDEX IF NOT EXISTS idx_asset_workflow_changed_at ON public.asset_workflow(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_readiness_asset_id ON public.asset_readiness(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_readiness_completion ON public.asset_readiness(completion_pct DESC);
CREATE INDEX IF NOT EXISTS idx_asset_badges_asset_id ON public.asset_badges(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_asset_id ON public.asset_review_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_reviewer ON public.asset_review_comments(reviewer_id);

-- ============================================================
-- SECTION 4: HELPER FUNCTIONS
-- ============================================================

-- Check if user has reviewer+ role
CREATE OR REPLACE FUNCTION public.is_reviewer_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role IN ('reviewer', 'administrator', 'super_admin')
)
$$;

-- Check if user is administrator or above
CREATE OR REPLACE FUNCTION public.is_administrator_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role IN ('administrator', 'super_admin')
)
$$;

-- Check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'super_admin'
)
$$;

-- Recalculate completion percentage for an asset
CREATE OR REPLACE FUNCTION public.recalculate_asset_completion(p_asset_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER := 11;
  v_completed INTEGER := 0;
  v_pct NUMERIC;
BEGIN
  SELECT
    (CASE WHEN species_validated THEN 1 ELSE 0 END) +
    (CASE WHEN technical_quality THEN 1 ELSE 0 END) +
    (CASE WHEN rights_verified THEN 1 ELSE 0 END) +
    (CASE WHEN metadata_completed THEN 1 ELSE 0 END) +
    (CASE WHEN packaging_completed THEN 1 ELSE 0 END) +
    (CASE WHEN keywords_completed THEN 1 ELSE 0 END) +
    (CASE WHEN preview_available THEN 1 ELSE 0 END) +
    (CASE WHEN thumbnail_available THEN 1 ELSE 0 END) +
    (CASE WHEN original_available THEN 1 ELSE 0 END) +
    (CASE WHEN license_ready THEN 1 ELSE 0 END) +
    (CASE WHEN publication_ready THEN 1 ELSE 0 END)
  INTO v_completed
  FROM public.asset_readiness
  WHERE asset_id = p_asset_id;

  IF v_completed IS NULL THEN
    RETURN 0;
  END IF;

  v_pct := ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100, 2);
  RETURN v_pct;
END;
$$;

-- ============================================================
-- SECTION 5: ENABLE RLS
-- ============================================================

ALTER TABLE public.asset_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_definitions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 6: RLS POLICIES
-- ============================================================

-- asset_workflow: reviewers+ can read all, reviewers+ can insert
DROP POLICY IF EXISTS "reviewers_read_workflow" ON public.asset_workflow;
CREATE POLICY "reviewers_read_workflow"
ON public.asset_workflow FOR SELECT TO authenticated
USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewers_insert_workflow" ON public.asset_workflow;
CREATE POLICY "reviewers_insert_workflow"
ON public.asset_workflow FOR INSERT TO authenticated
WITH CHECK (public.is_reviewer_or_above());

-- asset_readiness: reviewers+ can read, reviewers+ can insert/update
DROP POLICY IF EXISTS "reviewers_read_readiness" ON public.asset_readiness;
CREATE POLICY "reviewers_read_readiness"
ON public.asset_readiness FOR SELECT TO authenticated
USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewers_manage_readiness" ON public.asset_readiness;
CREATE POLICY "reviewers_manage_readiness"
ON public.asset_readiness FOR ALL TO authenticated
USING (public.is_reviewer_or_above())
WITH CHECK (public.is_reviewer_or_above());

-- asset_badges: reviewers+ can read, admins+ can manage
DROP POLICY IF EXISTS "reviewers_read_badges" ON public.asset_badges;
CREATE POLICY "reviewers_read_badges"
ON public.asset_badges FOR SELECT TO authenticated
USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "admins_manage_badges" ON public.asset_badges;
CREATE POLICY "admins_manage_badges"
ON public.asset_badges FOR ALL TO authenticated
USING (public.is_administrator_or_above())
WITH CHECK (public.is_administrator_or_above());

-- asset_review_comments: reviewers+ can read all, own comments
DROP POLICY IF EXISTS "reviewers_read_comments" ON public.asset_review_comments;
CREATE POLICY "reviewers_read_comments"
ON public.asset_review_comments FOR SELECT TO authenticated
USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewers_insert_comments" ON public.asset_review_comments;
CREATE POLICY "reviewers_insert_comments"
ON public.asset_review_comments FOR INSERT TO authenticated
WITH CHECK (reviewer_id = auth.uid() AND public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewers_update_own_comments" ON public.asset_review_comments;
CREATE POLICY "reviewers_update_own_comments"
ON public.asset_review_comments FOR UPDATE TO authenticated
USING (reviewer_id = auth.uid())
WITH CHECK (reviewer_id = auth.uid());

-- license_definitions: public read, admins manage
DROP POLICY IF EXISTS "public_read_license_definitions" ON public.license_definitions;
CREATE POLICY "public_read_license_definitions"
ON public.license_definitions FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "admins_manage_license_definitions" ON public.license_definitions;
CREATE POLICY "admins_manage_license_definitions"
ON public.license_definitions FOR ALL TO authenticated
USING (public.is_administrator_or_above())
WITH CHECK (public.is_administrator_or_above());

-- ============================================================
-- SECTION 7: SEED DATA — LICENSE DEFINITIONS
-- ============================================================

INSERT INTO public.license_definitions (license_type, display_name, description, rights, restrictions, indicative_price_eur, is_active, coming_soon)
VALUES
  ('web', 'Web License', 'For digital use on websites, social media, and online platforms.', 'Digital display, social media, web publishing, email marketing', 'No print, no broadcast, no resale, no sublicensing', 29.00, false, true),
  ('editorial', 'Editorial License', 'For editorial use in news, magazines, and educational content.', 'News articles, magazines, educational materials, non-commercial editorial', 'No commercial advertising, no product packaging, no resale', 49.00, false, true),
  ('commercial', 'Commercial License', 'For commercial advertising, marketing, and promotional materials.', 'Advertising, marketing, product promotion, commercial campaigns', 'No resale, no sublicensing, no broadcast without upgrade', 149.00, false, true),
  ('extended', 'Extended Commercial License', 'For broad commercial use including print, broadcast, and merchandise.', 'All commercial uses, print, broadcast, merchandise, product packaging', 'No resale as standalone asset, no sublicensing', 499.00, false, true),
  ('enterprise', 'Enterprise License', 'Unlimited use across all channels for large organizations.', 'Unlimited digital and print, broadcast, merchandise, global campaigns, internal use', 'No resale, no sublicensing to third parties', 1499.00, false, true)
ON CONFLICT (license_type) DO NOTHING;
