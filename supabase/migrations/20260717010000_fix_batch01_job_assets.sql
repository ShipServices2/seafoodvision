-- ============================================================
-- SEAFOOD VISION — Fix: Populate openai_pilot_job_assets for Batch 01
-- Root cause: Batch 01 import created 100 openai_pilot_results rows
-- but openai_pilot_job_assets only has 20 rows (pilot only).
-- The import inserts failed silently because openai_pilot_results
-- already had rows with the same public_asset_id from the pilot,
-- causing the unique constraint to block the result insert,
-- which then skipped the job_asset insert entirely.
-- Fix: Insert the 100 missing job_asset rows from existing results.
-- ============================================================

-- 1. Ensure unique constraint on (batch_job_id, asset_id) exists
--    (in addition to the existing (batch_job_id, public_asset_id))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'openai_pilot_job_assets_batch_job_id_asset_id_key'
      AND conrelid = 'public.openai_pilot_job_assets'::regclass
  ) THEN
    ALTER TABLE public.openai_pilot_job_assets
      ADD CONSTRAINT openai_pilot_job_assets_batch_job_id_asset_id_key
      UNIQUE (batch_job_id, asset_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
END $$;

-- 2. Populate openai_pilot_job_assets for ALL batch jobs that have
--    openai_pilot_results but no job_asset rows yet.
DO $$
DECLARE
  v_batch_job   RECORD;
  v_result      RECORD;
  v_pos         INTEGER;
  v_inserted    INTEGER;
  v_total       INTEGER := 0;
BEGIN
  -- Loop over every pilot batch job (has pilot_job_name set)
  FOR v_batch_job IN
    SELECT id, pilot_job_name, total_assets
    FROM public.sie_jobs
    WHERE pilot_job_name IS NOT NULL
      AND provider_mode = 'real_ai'
    ORDER BY created_at ASC
  LOOP
    -- Count existing job_asset rows for this batch
    SELECT COUNT(*) INTO v_inserted
    FROM public.openai_pilot_job_assets
    WHERE batch_job_id = v_batch_job.id;

    -- Count results for this batch
    SELECT COUNT(*) INTO v_pos
    FROM public.openai_pilot_results
    WHERE job_id = v_batch_job.id;

    RAISE NOTICE 'Batch job % (%) — existing job_assets: %, results: %',
      v_batch_job.pilot_job_name, v_batch_job.id, v_inserted, v_pos;

    -- Only populate if there are results but fewer job_assets than results
    IF v_pos > v_inserted THEN
      v_pos := v_inserted + 1; -- start position after existing rows

      FOR v_result IN
        SELECT r.id AS result_id,
               r.asset_id,
               r.public_asset_id,
               r.human_validated,
               r.review_status AS result_review_status
        FROM public.openai_pilot_results r
        WHERE r.job_id = v_batch_job.id
          -- Skip assets already in job_assets for this batch
          AND NOT EXISTS (
            SELECT 1 FROM public.openai_pilot_job_assets ja
            WHERE ja.batch_job_id = v_batch_job.id
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
          v_batch_job.id,
          NULL,  -- no individual sie_job for this asset
          v_result.asset_id,
          v_result.public_asset_id,
          v_result.result_id,
          v_pos,
          CASE
            WHEN v_result.human_validated = true THEN 'validated'
            WHEN v_result.result_review_status = 'validated' THEN 'validated'
            WHEN v_result.result_review_status = 'skipped' THEN 'skipped'
            ELSE 'unreviewed'
          END
        )
        ON CONFLICT (batch_job_id, public_asset_id) DO NOTHING;

        v_pos := v_pos + 1;
        v_total := v_total + 1;
      END LOOP;

      RAISE NOTICE 'Inserted % new job_asset rows for batch %',
        v_total, v_batch_job.pilot_job_name;
      v_total := 0;
    ELSE
      RAISE NOTICE 'Batch % already has % job_asset rows — skipping',
        v_batch_job.pilot_job_name, v_inserted;
    END IF;
  END LOOP;
END $$;

-- 3. Verify counts
DO $$
DECLARE
  v_job RECORD;
  v_count INTEGER;
BEGIN
  FOR v_job IN
    SELECT id, pilot_job_name, total_assets
    FROM public.sie_jobs
    WHERE pilot_job_name IS NOT NULL
      AND provider_mode = 'real_ai'
    ORDER BY created_at ASC
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM public.openai_pilot_job_assets
    WHERE batch_job_id = v_job.id;

    RAISE NOTICE 'VERIFY — % (%): % job_asset rows (expected ~%)',
      v_job.pilot_job_name, v_job.id, v_count, v_job.total_assets;
  END LOOP;
END $$;
