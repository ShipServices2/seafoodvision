-- ============================================================
-- SEAFOOD VISION — Fix: Validation Propagation + Job Persistence
-- 1. Add openai_pilot_job_assets table (batch navigation)
-- 2. Add columns to sie_jobs for batch tracking
-- 3. Add validated_metadata column to assets
-- 4. Ensure asset_species table has correct columns
-- 5. Ensure species_names table has correct columns
-- ============================================================

-- 1. Add batch-level columns to sie_jobs
ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS batch_job_id UUID,
  ADD COLUMN IF NOT EXISTS review_position INTEGER,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS propagation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS propagated_at TIMESTAMPTZ;

-- 2. Create openai_pilot_job_assets — the persistent batch linking table
-- Links a batch job to its ordered list of assets for navigation
CREATE TABLE IF NOT EXISTS public.openai_pilot_job_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The pilot job row in sie_jobs (the "batch anchor" job)
  batch_job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  -- The individual sie_job for this asset
  asset_job_id UUID REFERENCES public.sie_jobs(id) ON DELETE SET NULL,
  -- The asset itself
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  public_asset_id TEXT NOT NULL,
  -- The openai_pilot_result for this asset
  result_id UUID REFERENCES public.openai_pilot_results(id) ON DELETE SET NULL,
  -- Stable review order (1-based)
  review_position INTEGER NOT NULL,
  -- Review state
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  -- Timestamps
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (batch_job_id, review_position),
  UNIQUE (batch_job_id, public_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_pilot_job_assets_batch_job_id
  ON public.openai_pilot_job_assets(batch_job_id);
CREATE INDEX IF NOT EXISTS idx_pilot_job_assets_asset_id
  ON public.openai_pilot_job_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_pilot_job_assets_result_id
  ON public.openai_pilot_job_assets(result_id);

-- 3. Ensure asset_species has all required columns for human validation
ALTER TABLE public.asset_species
  ADD COLUMN IF NOT EXISTS relation_type TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'human_validation',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'validated';

-- 4. Ensure species_names has all required columns
ALTER TABLE public.species_names
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'human_validation',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 5. Add validated_metadata column to assets for storing human-validated fields
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS validated_metadata JSONB,
  ADD COLUMN IF NOT EXISTS human_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Add search_aliases column to assets for fast text search
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS search_aliases TEXT[];

-- 7. Create index on search_aliases for GIN search
CREATE INDEX IF NOT EXISTS idx_assets_search_aliases_gin
  ON public.assets USING GIN (search_aliases);

-- 8. Create index on assets.species_id for fast species-based search
CREATE INDEX IF NOT EXISTS idx_assets_species_id
  ON public.assets(species_id);

-- 9. RLS for openai_pilot_job_assets
ALTER TABLE public.openai_pilot_job_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pilot_job_assets_reviewer_all" ON public.openai_pilot_job_assets;
CREATE POLICY "pilot_job_assets_reviewer_all" ON public.openai_pilot_job_assets
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- 10. Populate openai_pilot_job_assets from existing data
-- Find the pilot batch job (the one with pilot_job_name set)
-- and link it to all 20 openai_pilot_results in review_position order
DO $$
DECLARE
  v_batch_job_id UUID;
  v_result RECORD;
  v_pos INTEGER := 1;
  v_asset_job_id UUID;
BEGIN
  -- Find the pilot batch job
  SELECT id INTO v_batch_job_id
  FROM public.sie_jobs
  WHERE pilot_job_name = 'OpenAI Vision Pilot — 20 Assets'
  LIMIT 1;

  IF v_batch_job_id IS NULL THEN
    RAISE NOTICE 'No pilot batch job found — skipping openai_pilot_job_assets population';
    RETURN;
  END IF;

  -- For each openai_pilot_result, create a job_asset link
  FOR v_result IN
    SELECT
      opr.id AS result_id,
      opr.asset_id,
      opr.public_asset_id
    FROM public.openai_pilot_results opr
    WHERE opr.job_id = v_batch_job_id
    ORDER BY opr.created_at ASC, opr.public_asset_id ASC
  LOOP
    -- Find the individual sie_job for this asset (if any)
    SELECT id INTO v_asset_job_id
    FROM public.sie_jobs
    WHERE asset_id = v_result.asset_id
      AND id != v_batch_job_id
    ORDER BY created_at DESC
    LIMIT 1;

    INSERT INTO public.openai_pilot_job_assets (
      batch_job_id,
      asset_job_id,
      asset_id,
      public_asset_id,
      result_id,
      review_position,
      review_status
    ) VALUES (
      v_batch_job_id,
      v_asset_job_id,
      v_result.asset_id,
      v_result.public_asset_id,
      v_result.result_id,
      v_pos,
      'unreviewed'
    )
    ON CONFLICT (batch_job_id, public_asset_id) DO UPDATE
      SET result_id = EXCLUDED.result_id,
          asset_id = EXCLUDED.asset_id,
          asset_job_id = EXCLUDED.asset_job_id;

    v_pos := v_pos + 1;
  END LOOP;

  RAISE NOTICE 'Populated % openai_pilot_job_assets rows for batch job %', v_pos - 1, v_batch_job_id;
END $$;
