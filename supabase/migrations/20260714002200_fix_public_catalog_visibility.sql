-- ============================================================
-- MIGRATION: Fix Public Catalog Visibility
-- Timestamp: 20260714002200
-- Purpose: Allow authenticated non-admin users to read approved assets
--          and fix public-facing queries for Library, Search, Species pages
-- ============================================================

-- ============================================================
-- 1. RLS FIX: Add SELECT policy for authenticated non-admin users
--    The existing "assets_public_read_approved" policy is TO public (anon only).
--    Authenticated members (non-admin, non-reviewer) had NO policy to read assets.
-- ============================================================

DROP POLICY IF EXISTS "assets_authenticated_read_approved" ON public.assets;
CREATE POLICY "assets_authenticated_read_approved"
  ON public.assets FOR SELECT
  TO authenticated
  USING (
    review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    AND publication_status != 'archived'
  );

-- ============================================================
-- 2. RLS FIX: asset_files — same gap for authenticated users
-- ============================================================

DROP POLICY IF EXISTS "asset_files_authenticated_read" ON public.asset_files;
CREATE POLICY "asset_files_authenticated_read"
  ON public.asset_files FOR SELECT
  TO authenticated
  USING (
    file_level != 'original'
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    )
  );

-- ============================================================
-- 3. RLS FIX: asset_keywords — ensure authenticated users can read
-- ============================================================

DROP POLICY IF EXISTS "asset_keywords_authenticated_read" ON public.asset_keywords;
CREATE POLICY "asset_keywords_authenticated_read"
  ON public.asset_keywords FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. RLS FIX: keywords table — ensure public and authenticated can read
-- ============================================================

ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "keywords_public_read" ON public.keywords;
CREATE POLICY "keywords_public_read"
  ON public.keywords FOR SELECT
  TO public
  USING (true);

-- ============================================================
-- 5. RLS FIX: species table — ensure authenticated users can read
-- ============================================================

DROP POLICY IF EXISTS "species_authenticated_read" ON public.species;
CREATE POLICY "species_authenticated_read"
  ON public.species FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 6. RLS FIX: categories table — ensure authenticated users can read
-- ============================================================

DROP POLICY IF EXISTS "categories_authenticated_read" ON public.categories;
CREATE POLICY "categories_authenticated_read"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- 7. Ensure asset_previews are readable by authenticated users
-- ============================================================

DROP POLICY IF EXISTS "asset_previews_authenticated_read" ON public.asset_previews;
CREATE POLICY "asset_previews_authenticated_read"
  ON public.asset_previews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_previews.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    )
  );
