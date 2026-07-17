-- ============================================================
-- SEAFOOD VISION — Backfill Propagation Support
-- Adds columns and indexes needed for idempotent backfill of
-- the 33 already-validated assets from the current OpenAI batch.
-- Also adds propagation tracking columns to openai_pilot_results.
-- ============================================================

-- 1. Extend sie_propagation_log with validation tracking columns
ALTER TABLE public.sie_propagation_log
  ADD COLUMN IF NOT EXISTS validation_id uuid,
  ADD COLUMN IF NOT EXISTS backfill_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS species_id uuid REFERENCES public.species(id) ON DELETE SET NULL;

-- 2. Unique index: one propagation log entry per (asset_id, target_system)
--    Allows idempotent upsert without duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_sie_propagation_log_asset_target
  ON public.sie_propagation_log (asset_id, target_system)
  WHERE asset_id IS NOT NULL;

-- 3. Add propagation tracking to openai_pilot_results
ALTER TABLE public.openai_pilot_results
  ADD COLUMN IF NOT EXISTS propagation_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS propagation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS propagation_error text;

-- 4. Add propagation tracking to openai_pilot_job_assets
ALTER TABLE public.openai_pilot_job_assets
  ADD COLUMN IF NOT EXISTS propagation_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS propagation_completed_at timestamptz;

-- 5. Index for fast lookup of validated-but-not-propagated assets
CREATE INDEX IF NOT EXISTS idx_openai_pilot_results_validated_propagation
  ON public.openai_pilot_results (job_id, human_validated, propagation_status)
  WHERE human_validated = true;

-- 6. Index on assets.search_aliases for fast text search
CREATE INDEX IF NOT EXISTS idx_assets_search_aliases
  ON public.assets USING gin(search_aliases);

-- 7. Index on assets.human_validated for fast lookup
CREATE INDEX IF NOT EXISTS idx_assets_human_validated
  ON public.assets (human_validated)
  WHERE human_validated = true;

-- 8. Function: check_asset_propagation_status
--    Returns a JSON summary of propagation completeness for a given asset_id.
--    Used by the backfill audit to determine which steps are missing.
CREATE OR REPLACE FUNCTION public.check_asset_propagation_status(p_asset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_result jsonb;
  v_has_asset_species boolean := false;
  v_has_species boolean := false;
  v_has_species_names boolean := false;
  v_has_search_aliases boolean := false;
  v_has_validated_metadata boolean := false;
  v_has_propagation_log boolean := false;
  v_species_id uuid;
  v_alias_count int := 0;
  v_species_name_count int := 0;
BEGIN
  -- Check asset_species
  SELECT EXISTS(
    SELECT 1 FROM public.asset_species
    WHERE asset_id = p_asset_id AND relation_type = 'primary'
  ) INTO v_has_asset_species;

  -- Get species_id from asset_species
  SELECT species_id INTO v_species_id
  FROM public.asset_species
  WHERE asset_id = p_asset_id AND relation_type = 'primary'
  LIMIT 1;

  -- Check species exists
  IF v_species_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.species WHERE id = v_species_id)
    INTO v_has_species;

    SELECT COUNT(*) INTO v_species_name_count
    FROM public.species_names WHERE species_id = v_species_id;
    v_has_species_names := v_species_name_count > 0;
  END IF;

  -- Check search_aliases on asset
  SELECT
    (search_aliases IS NOT NULL AND array_length(search_aliases, 1) > 0),
    COALESCE(array_length(search_aliases, 1), 0),
    (validated_metadata IS NOT NULL)
  INTO v_has_search_aliases, v_alias_count, v_has_validated_metadata
  FROM public.assets WHERE id = p_asset_id;

  -- Check propagation log
  SELECT EXISTS(
    SELECT 1 FROM public.sie_propagation_log
    WHERE asset_id = p_asset_id AND status = 'completed'
  ) INTO v_has_propagation_log;

  v_result := jsonb_build_object(
    'asset_id', p_asset_id,
    'has_asset_species', v_has_asset_species,
    'has_species', v_has_species,
    'species_id', v_species_id,
    'has_species_names', v_has_species_names,
    'species_name_count', v_species_name_count,
    'has_search_aliases', v_has_search_aliases,
    'alias_count', v_alias_count,
    'has_validated_metadata', v_has_validated_metadata,
    'has_propagation_log', v_has_propagation_log,
    'is_complete', (v_has_asset_species AND v_has_species AND v_has_species_names AND v_has_search_aliases AND v_has_validated_metadata)
  );

  RETURN v_result;
END;
$func$;

-- 9. Grant execute to authenticated users (admin-only enforced at API level)
GRANT EXECUTE ON FUNCTION public.check_asset_propagation_status(uuid) TO authenticated;
