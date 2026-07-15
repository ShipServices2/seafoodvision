-- ============================================================
-- SEAFOOD VISION — Fix SIE Candidates RLS + Schema
-- Root cause: reviewer role cannot INSERT candidates (only admin can)
-- This caused all candidate inserts to fail silently → 0 rows
-- ============================================================

-- 1. Allow reviewer role to INSERT candidates (they run the identification jobs)
DROP POLICY IF EXISTS "sie_candidates_admin_write" ON public.sie_species_candidates;
CREATE POLICY "sie_candidates_reviewer_write" ON public.sie_species_candidates
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- 2. Allow reviewer role to INSERT jobs (they create jobs too)
DROP POLICY IF EXISTS "sie_jobs_admin_write" ON public.sie_jobs;
CREATE POLICY "sie_jobs_reviewer_write" ON public.sie_jobs
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- 3. Allow reviewer to write propagation log
DROP POLICY IF EXISTS "sie_propagation_admin_all" ON public.sie_propagation_log;
CREATE POLICY "sie_propagation_reviewer_all" ON public.sie_propagation_log
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- 4. Allow reviewer to write commercial enrichment
DROP POLICY IF EXISTS "sie_enrichment_admin_write" ON public.sie_commercial_enrichment;
CREATE POLICY "sie_enrichment_reviewer_write" ON public.sie_commercial_enrichment
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- 5. Add validation_progress and processing_progress to sie_jobs if missing
ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS validation_progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0;

-- 6. Add asset_id to sie_species_candidates for direct asset lookup
ALTER TABLE public.sie_species_candidates
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sie_candidates_asset_id ON public.sie_species_candidates(asset_id);

-- 7. Ensure metadata_suggestions allows reviewer writes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'metadata_suggestions'
  ) THEN
    -- Drop and recreate permissive policy for reviewer
    DROP POLICY IF EXISTS "reviewer_write_metadata_suggestions" ON public.metadata_suggestions;
    CREATE POLICY "reviewer_write_metadata_suggestions" ON public.metadata_suggestions
      FOR ALL TO authenticated
      USING (public.sie_is_reviewer_or_admin())
      WITH CHECK (public.sie_is_reviewer_or_admin());
  END IF;
END $$;
