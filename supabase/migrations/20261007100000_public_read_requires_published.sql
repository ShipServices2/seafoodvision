-- Étape 4c : la lecture publique d'un asset exige publication_status = 'published'.
-- Seule la visibilité change : aucune donnée n'est modifiée.
-- Les administrateurs (is_admin) et les reviewers (is_reviewer_or_above) gardent l'accès à tout
-- (assets_admin_manage / assets_reviewer_read_all existent déjà ; des policies de lecture reviewer sont ajoutées pour les tables liées).
-- Les originaux (file_level = 'original') restent illisibles pour le public, comme avant.
-- Tables couvertes : assets, asset_files, asset_previews, asset_readiness, asset_species, asset_keywords.
-- (keywords est un vocabulaire global qui n'expose aucun asset : inchangé.)

BEGIN;

-- ============================================================
-- assets
-- ============================================================
DROP POLICY IF EXISTS "assets_public_read_approved" ON public.assets;
CREATE POLICY "assets_public_read_approved"
  ON public.assets FOR SELECT
  TO public
  USING (
    review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    AND publication_status = 'published'
  );

DROP POLICY IF EXISTS "assets_authenticated_read_approved" ON public.assets;
CREATE POLICY "assets_authenticated_read_approved"
  ON public.assets FOR SELECT
  TO authenticated
  USING (
    review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    AND publication_status = 'published'
  );

-- ============================================================
-- asset_files (jamais les originaux pour le public)
-- ============================================================
DROP POLICY IF EXISTS "asset_files_no_originals_public" ON public.asset_files;
DROP POLICY IF EXISTS "asset_files_public_read" ON public.asset_files;
CREATE POLICY "asset_files_public_read"
  ON public.asset_files FOR SELECT
  TO public
  USING (
    file_level != 'original'
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

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
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_files_reviewer_read_all" ON public.asset_files;
CREATE POLICY "asset_files_reviewer_read_all"
  ON public.asset_files FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

-- ============================================================
-- asset_previews
-- ============================================================
DROP POLICY IF EXISTS "asset_previews_public_read" ON public.asset_previews;
CREATE POLICY "asset_previews_public_read"
  ON public.asset_previews FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_previews.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_previews_authenticated_read" ON public.asset_previews;
CREATE POLICY "asset_previews_authenticated_read"
  ON public.asset_previews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_previews.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_previews_reviewer_read_all" ON public.asset_previews;
CREATE POLICY "asset_previews_reviewer_read_all"
  ON public.asset_previews FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

-- ============================================================
-- asset_readiness (était USING (true)) ; reviewers_read_readiness / reviewers_manage_readiness / service_role inchangés
-- ============================================================
DROP POLICY IF EXISTS "asset_readiness_select_public" ON public.asset_readiness;
CREATE POLICY "asset_readiness_select_public"
  ON public.asset_readiness FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_readiness.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

-- ============================================================
-- asset_species (était USING (true))
-- ============================================================
DROP POLICY IF EXISTS "asset_species_public_read" ON public.asset_species;
CREATE POLICY "asset_species_public_read"
  ON public.asset_species FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_species.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_species_reviewer_read_all" ON public.asset_species;
CREATE POLICY "asset_species_reviewer_read_all"
  ON public.asset_species FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

-- ============================================================
-- asset_keywords (était USING (true), y compris pour authenticated)
-- ============================================================
DROP POLICY IF EXISTS "asset_keywords_public_read" ON public.asset_keywords;
CREATE POLICY "asset_keywords_public_read"
  ON public.asset_keywords FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_keywords.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_keywords_authenticated_read" ON public.asset_keywords;
CREATE POLICY "asset_keywords_authenticated_read"
  ON public.asset_keywords FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_keywords.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
    OR public.is_reviewer_or_above()
  );

COMMIT;
