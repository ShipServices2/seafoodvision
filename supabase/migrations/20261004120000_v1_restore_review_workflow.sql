-- ============================================================
-- SeafoodVision V1 — Restore the review workflow objects of 20260712200000
-- that are missing in the remote database:
--   tables  asset_workflow, asset_badges, asset_review_comments, license_definitions
--   function recalculate_asset_completion(uuid)
-- Strictly additive: CREATE ... IF NOT EXISTS / CREATE OR REPLACE FUNCTION only.
-- No DROP, no DELETE, no UPDATE of existing data. asset_readiness already exists
-- remotely and is not touched. The helper functions is_reviewer_or_above() and
-- is_administrator_or_above() already exist remotely and are only checked.
-- ============================================================

BEGIN;

-- 0. Preconditions: the objects this migration depends on must exist.
DO $$
BEGIN
  IF to_regprocedure('public.is_reviewer_or_above()') IS NULL
     OR to_regprocedure('public.is_administrator_or_above()') IS NULL THEN
    RAISE EXCEPTION 'Missing helper functions is_reviewer_or_above()/is_administrator_or_above()';
  END IF;
  IF to_regclass('public.assets') IS NULL OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.asset_readiness') IS NULL THEN
    RAISE EXCEPTION 'Missing prerequisite tables assets/profiles/asset_readiness';
  END IF;
  IF to_regtype('public.license_type') IS NULL THEN
    RAISE EXCEPTION 'Missing enum type public.license_type';
  END IF;
END
$$;

-- 1. Enum types (created only if absent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'workflow_status'
  ) THEN
    CREATE TYPE public.workflow_status AS ENUM (
      'imported', 'metadata_review', 'species_validation', 'technical_review',
      'rights_review', 'commercial_review', 'certified', 'published',
      'commercial_license_ready'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'comment_type'
  ) THEN
    CREATE TYPE public.comment_type AS ENUM ('comment', 'suggestion', 'correction');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'badge_type'
  ) THEN
    CREATE TYPE public.badge_type AS ENUM (
      'imported', 'under_review', 'metadata_complete', 'species_verified',
      'technical_verified', 'rights_verified', 'certified', 'commercial_ready',
      'editorial_ready', 'premium_asset', 'featured'
    );
  END IF;
END
$$;

-- 2. Tables.
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

-- 3. Indexes.
CREATE INDEX IF NOT EXISTS idx_asset_workflow_asset_id ON public.asset_workflow(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_workflow_status ON public.asset_workflow(workflow_status);
CREATE INDEX IF NOT EXISTS idx_asset_workflow_changed_at ON public.asset_workflow(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_badges_asset_id ON public.asset_badges(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_asset_id ON public.asset_review_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_reviewer ON public.asset_review_comments(reviewer_id);

-- 4. Function (SECURITY DEFINER with a fixed search_path; read-only computation).
CREATE OR REPLACE FUNCTION public.recalculate_asset_completion(p_asset_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 11;
  v_completed INTEGER;
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

  RETURN ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_asset_completion(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_asset_completion(UUID) TO authenticated, service_role;

-- 5. Row level security: admin and reviewer roles only (license_definitions: public read).
ALTER TABLE public.asset_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_definitions ENABLE ROW LEVEL SECURITY;

-- Policies are created only when absent, so the migration can be replayed safely.
DO $$
BEGIN
  -- asset_workflow: reviewers and above read and insert (history is append-only).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_workflow' AND policyname = 'reviewers_read_workflow') THEN
    CREATE POLICY reviewers_read_workflow ON public.asset_workflow
      FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_workflow' AND policyname = 'reviewers_insert_workflow') THEN
    CREATE POLICY reviewers_insert_workflow ON public.asset_workflow
      FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
  END IF;

  -- asset_badges: reviewers and above read, administrators manage.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_badges' AND policyname = 'reviewers_read_badges') THEN
    CREATE POLICY reviewers_read_badges ON public.asset_badges
      FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_badges' AND policyname = 'admins_manage_badges') THEN
    CREATE POLICY admins_manage_badges ON public.asset_badges
      FOR ALL TO authenticated
      USING (public.is_administrator_or_above())
      WITH CHECK (public.is_administrator_or_above());
  END IF;

  -- asset_review_comments: reviewers and above read; insert and update only their own comments.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_review_comments' AND policyname = 'reviewers_read_comments') THEN
    CREATE POLICY reviewers_read_comments ON public.asset_review_comments
      FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_review_comments' AND policyname = 'reviewers_insert_comments') THEN
    CREATE POLICY reviewers_insert_comments ON public.asset_review_comments
      FOR INSERT TO authenticated
      WITH CHECK (reviewer_id = auth.uid() AND public.is_reviewer_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_review_comments' AND policyname = 'reviewers_update_own_comments') THEN
    CREATE POLICY reviewers_update_own_comments ON public.asset_review_comments
      FOR UPDATE TO authenticated
      USING (reviewer_id = auth.uid() AND public.is_reviewer_or_above())
      WITH CHECK (reviewer_id = auth.uid() AND public.is_reviewer_or_above());
  END IF;

  -- license_definitions: public read, administrators manage.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'license_definitions' AND policyname = 'public_read_license_definitions') THEN
    CREATE POLICY public_read_license_definitions ON public.license_definitions
      FOR SELECT TO public USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'license_definitions' AND policyname = 'admins_manage_license_definitions') THEN
    CREATE POLICY admins_manage_license_definitions ON public.license_definitions
      FOR ALL TO authenticated
      USING (public.is_administrator_or_above())
      WITH CHECK (public.is_administrator_or_above());
  END IF;
END
$$;

-- 6. Seed of the new, empty license_definitions table (inserts only, never overwrites).
INSERT INTO public.license_definitions
  (license_type, display_name, description, rights, restrictions, indicative_price_eur, is_active, coming_soon)
VALUES
  ('web', 'Web License', 'For digital use on websites, social media, and online platforms.', 'Digital display, social media, web publishing, email marketing', 'No print, no broadcast, no resale, no sublicensing', 29.00, false, true),
  ('editorial', 'Editorial License', 'For editorial use in news, magazines, and educational content.', 'News articles, magazines, educational materials, non-commercial editorial', 'No commercial advertising, no product packaging, no resale', 49.00, false, true),
  ('commercial', 'Commercial License', 'For commercial advertising, marketing, and promotional materials.', 'Advertising, marketing, product promotion, commercial campaigns', 'No resale, no sublicensing, no broadcast without upgrade', 149.00, false, true),
  ('extended', 'Extended Commercial License', 'For broad commercial use including print, broadcast, and merchandise.', 'All commercial uses, print, broadcast, merchandise, product packaging', 'No resale as standalone asset, no sublicensing', 499.00, false, true),
  ('enterprise', 'Enterprise License', 'Unlimited use across all channels for large organizations.', 'Unlimited digital and print, broadcast, merchandise, global campaigns, internal use', 'No resale, no sublicensing to third parties', 1499.00, false, true)
ON CONFLICT (license_type) DO NOTHING;

COMMIT;
