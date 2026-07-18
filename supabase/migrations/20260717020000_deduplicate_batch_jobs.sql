-- ============================================================
-- SEAFOOD VISION — Deduplicate Batch Jobs
-- Root cause: The same 100-asset OpenAI batch was imported 3 times,
-- creating 3 sie_jobs rows (Batch 01, Batch 02, Batch 03) all with
-- the same public_asset_ids. Only the canonical job (the one with
-- 100 openai_pilot_job_assets rows) is real. The others have 0
-- job_assets and cause infinite "Loading batch assets..." spinner.
--
-- Fix:
-- 1. Add is_superseded column to sie_jobs
-- 2. Identify the canonical batch (most job_assets rows)
-- 3. Mark duplicate batches as superseded
-- 4. Ensure canonical batch has exactly 100 job_asset rows
-- ============================================================

-- 1. Add is_superseded column if not exists
ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS canonical_job_id UUID REFERENCES public.sie_jobs(id) ON DELETE SET NULL;

-- 2. Add index for fast filtering
CREATE INDEX IF NOT EXISTS idx_sie_jobs_is_superseded
  ON public.sie_jobs (is_superseded)
  WHERE is_superseded = FALSE;

-- 3. Identify and mark duplicate batch jobs
-- Strategy: among all real_ai pilot jobs that share the same set of
-- public_asset_ids, keep the one with the most openai_pilot_job_assets
-- rows as canonical; mark the rest as superseded.
DO $$
DECLARE
  v_canonical_id   UUID;
  v_canonical_name TEXT;
  v_canonical_count INTEGER;
  v_job            RECORD;
  v_job_count      INTEGER;
  v_total_batches  INTEGER;
BEGIN
  -- Count real_ai pilot batch jobs
  SELECT COUNT(*) INTO v_total_batches
  FROM public.sie_jobs
  WHERE pilot_job_name IS NOT NULL
    AND provider_mode = 'real_ai'
    AND is_superseded = FALSE;

  RAISE NOTICE 'Found % active real_ai pilot batch jobs', v_total_batches;

  IF v_total_batches <= 1 THEN
    RAISE NOTICE 'Only % active batch job(s) — no deduplication needed', v_total_batches;
    RETURN;
  END IF;

  -- Find the canonical job: the real_ai pilot job with the most job_asset rows
  SELECT j.id, j.pilot_job_name, COUNT(ja.id) AS asset_count
  INTO v_canonical_id, v_canonical_name, v_canonical_count
  FROM public.sie_jobs j
  LEFT JOIN public.openai_pilot_job_assets ja ON ja.batch_job_id = j.id
  WHERE j.pilot_job_name IS NOT NULL
    AND j.provider_mode = 'real_ai'
    AND j.is_superseded = FALSE
  GROUP BY j.id, j.pilot_job_name
  ORDER BY COUNT(ja.id) DESC, j.created_at ASC
  LIMIT 1;

  RAISE NOTICE 'Canonical batch job: % (id=%) with % job_asset rows',
    v_canonical_name, v_canonical_id, v_canonical_count;

  -- Rename canonical job to the definitive name if it has 100 assets
  IF v_canonical_count >= 100 THEN
    UPDATE public.sie_jobs
    SET pilot_job_name = 'OpenAI Vision — Batch 01 — 100 Assets'
    WHERE id = v_canonical_id
      AND pilot_job_name != 'OpenAI Vision — Batch 01 — 100 Assets';

    RAISE NOTICE 'Renamed canonical job to "OpenAI Vision — Batch 01 — 100 Assets"';
  END IF;

  -- Mark all other real_ai pilot jobs as superseded
  FOR v_job IN
    SELECT id, pilot_job_name
    FROM public.sie_jobs
    WHERE pilot_job_name IS NOT NULL
      AND provider_mode = 'real_ai'
      AND id != v_canonical_id
      AND is_superseded = FALSE
  LOOP
    -- Count job_assets for this duplicate
    SELECT COUNT(*) INTO v_job_count
    FROM public.openai_pilot_job_assets
    WHERE batch_job_id = v_job.id;

    RAISE NOTICE 'Marking job % (%) as superseded — had % job_asset rows',
      v_job.pilot_job_name, v_job.id, v_job_count;

    UPDATE public.sie_jobs
    SET
      is_superseded   = TRUE,
      canonical_job_id = v_canonical_id,
      pilot_job_name  = v_job.pilot_job_name || ' [superseded]'
    WHERE id = v_job.id;
  END LOOP;

  RAISE NOTICE 'Deduplication complete. Canonical job: % (%)',
    v_canonical_name, v_canonical_id;
END $$;

-- 4. Ensure canonical batch has all 100 job_asset rows
-- (re-run the same logic as migration 20260717010000 but only for canonical job)
DO $$
DECLARE
  v_canonical_id   UUID;
  v_existing_count INTEGER;
  v_result_count   INTEGER;
  v_pos            INTEGER;
  v_result         RECORD;
  v_inserted       INTEGER := 0;
BEGIN
  -- Get canonical job id
  SELECT id INTO v_canonical_id
  FROM public.sie_jobs
  WHERE pilot_job_name IS NOT NULL
    AND provider_mode = 'real_ai'
    AND is_superseded = FALSE
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_canonical_id IS NULL THEN
    RAISE NOTICE 'No canonical batch job found — skipping job_assets repair';
    RETURN;
  END IF;

  -- Count existing job_assets
  SELECT COUNT(*) INTO v_existing_count
  FROM public.openai_pilot_job_assets
  WHERE batch_job_id = v_canonical_id;

  -- Count results
  SELECT COUNT(*) INTO v_result_count
  FROM public.openai_pilot_results
  WHERE job_id = v_canonical_id;

  RAISE NOTICE 'Canonical job % — existing job_assets: %, results: %',
    v_canonical_id, v_existing_count, v_result_count;

  IF v_existing_count >= v_result_count AND v_result_count > 0 THEN
    RAISE NOTICE 'Canonical job already has % job_asset rows — no repair needed', v_existing_count;
    RETURN;
  END IF;

  -- Insert missing job_asset rows
  v_pos := v_existing_count + 1;

  FOR v_result IN
    SELECT r.id AS result_id,
           r.asset_id,
           r.public_asset_id,
           r.human_validated,
           r.review_status AS result_review_status
    FROM public.openai_pilot_results r
    WHERE r.job_id = v_canonical_id
      AND NOT EXISTS (
        SELECT 1 FROM public.openai_pilot_job_assets ja
        WHERE ja.batch_job_id = v_canonical_id
          AND ja.result_id = r.id
      )
    ORDER BY r.created_at ASC
  LOOP
    INSERT INTO public.openai_pilot_job_assets (
      batch_job_id,
      asset_job_id,
      asset_id,
      public_asset_id,
      result_id,
      review_position,
      review_status
    )
    VALUES (
      v_canonical_id,
      NULL,
      v_result.asset_id,
      v_result.public_asset_id,
      v_result.result_id,
      v_pos,
      CASE
        WHEN v_result.human_validated = TRUE THEN 'validated'
        WHEN v_result.result_review_status = 'validated' THEN 'validated'
        WHEN v_result.result_review_status = 'skipped' THEN 'skipped'
        ELSE 'unreviewed'
      END
    )
    ON CONFLICT (batch_job_id, public_asset_id) DO NOTHING;

    v_pos := v_pos + 1;
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Inserted % new job_asset rows for canonical job', v_inserted;

  -- Final count
  SELECT COUNT(*) INTO v_existing_count
  FROM public.openai_pilot_job_assets
  WHERE batch_job_id = v_canonical_id;

  RAISE NOTICE 'Canonical job now has % job_asset rows', v_existing_count;
END $$;

-- 5. Verify final state
DO $$
DECLARE
  v_job   RECORD;
  v_count INTEGER;
BEGIN
  RAISE NOTICE '=== FINAL STATE ===';
  FOR v_job IN
    SELECT id, pilot_job_name, is_superseded, total_assets, created_at
    FROM public.sie_jobs
    WHERE pilot_job_name IS NOT NULL
      AND provider_mode = 'real_ai'
    ORDER BY created_at ASC
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM public.openai_pilot_job_assets
    WHERE batch_job_id = v_job.id;

    RAISE NOTICE 'Job: % | superseded: % | job_assets: % | total_assets: %',
      v_job.pilot_job_name, v_job.is_superseded, v_count, v_job.total_assets;
  END LOOP;
END $$;
