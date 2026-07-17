-- ============================================================
-- SEAFOOD VISION — Fix Batch02 Label + Backfill Propagation
-- Migration: 20260717030000
--
-- Context:
--   After rollback, openai_vision_batches_588 contains 2 real batches:
--   - Batch01 (100 assets) — correctly labeled
--   - Batch02 (100 assets) — mislabeled as "Batch04" because the import
--     route counted stale sie_jobs records from previous failed attempts
--
-- This migration:
--   1. Identifies the mislabeled Batch02 job (named "Batch 03 (100)" or
--      "Batch 04 (100)" or similar) and renames it to "Batch 02 (100)"
--   2. Ensures is_superseded = FALSE for both Batch01 and Batch02
--   3. Backfills propagation for the 38 already-validated assets in Batch02:
--      - Marks openai_pilot_results.human_validated = true
--      - Marks openai_pilot_job_assets.review_status = 'validated'
--      - Updates assets.human_validated = true
--   4. Cleans up any stale superseded/duplicate sie_jobs that have 0 assets
-- ============================================================

BEGIN;

-- ── Step 1: Identify the two real batch jobs ──────────────────────────────────
-- The canonical Batch01 is the FIRST real_ai pilot job (oldest created_at with 100 assets)
-- The canonical Batch02 is the SECOND real_ai pilot job (second oldest with 100 assets)
-- Any others with 0 assets in openai_pilot_job_assets are stale and should be superseded

DO $$
DECLARE
  v_batch01_id uuid;
  v_batch02_id uuid;
  v_job RECORD;
  v_asset_count integer;
  v_rank integer := 0;
BEGIN

  -- Find all non-superseded real_ai pilot jobs ordered by creation date
  -- and count their actual assets in openai_pilot_job_assets
  FOR v_job IN
    SELECT j.id, j.pilot_job_name, j.created_at, j.is_superseded,
           COUNT(a.id) AS actual_asset_count
    FROM sie_jobs j
    LEFT JOIN openai_pilot_job_assets a ON a.batch_job_id = j.id
    WHERE j.pilot_job_name IS NOT NULL
      AND j.provider_mode = 'real_ai'
    GROUP BY j.id, j.pilot_job_name, j.created_at, j.is_superseded
    ORDER BY j.created_at ASC
  LOOP
    IF v_job.actual_asset_count >= 100 THEN
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN
        v_batch01_id := v_job.id;
      ELSIF v_rank = 2 THEN
        v_batch02_id := v_job.id;
      END IF;
    END IF;
  END LOOP;

  -- ── Step 2: Rename and activate Batch01 ──────────────────────────────────
  IF v_batch01_id IS NOT NULL THEN
    UPDATE sie_jobs
    SET
      pilot_job_name = 'Batch 01 (100)',
      is_superseded = FALSE,
      updated_at = NOW()
    WHERE id = v_batch01_id;

    RAISE NOTICE 'Batch01 job % renamed to "Batch 01 (100)"', v_batch01_id;
  ELSE
    RAISE NOTICE 'WARNING: Could not find Batch01 job with >= 100 assets';
  END IF;

  -- ── Step 3: Rename and activate Batch02 ──────────────────────────────────
  IF v_batch02_id IS NOT NULL THEN
    UPDATE sie_jobs
    SET
      pilot_job_name = 'Batch 02 (100)',
      is_superseded = FALSE,
      updated_at = NOW()
    WHERE id = v_batch02_id;

    RAISE NOTICE 'Batch02 job % renamed to "Batch 02 (100)"', v_batch02_id;
  ELSE
    RAISE NOTICE 'WARNING: Could not find Batch02 job with >= 100 assets';
  END IF;

  -- ── Step 4: Supersede all other real_ai pilot jobs with 0 assets ─────────
  UPDATE sie_jobs
  SET
    is_superseded = TRUE,
    pilot_job_name = CONCAT('[superseded] ', COALESCE(pilot_job_name, 'unknown')),
    updated_at = NOW()
  WHERE pilot_job_name IS NOT NULL
    AND provider_mode = 'real_ai'
    AND id NOT IN (
      SELECT DISTINCT batch_job_id
      FROM openai_pilot_job_assets
      WHERE batch_job_id IS NOT NULL
    )
    AND (is_superseded IS NULL OR is_superseded = FALSE)
    AND NOT (pilot_job_name LIKE '[superseded]%');

  RAISE NOTICE 'Superseded stale real_ai pilot jobs with 0 assets';

END $$;

-- ── Step 5: Backfill propagation for already-validated assets in Batch02 ─────
-- For any openai_pilot_job_assets row with review_status = 'validated',
-- ensure the corresponding openai_pilot_results row is also marked human_validated
-- and the assets row is marked human_validated.

DO $$
DECLARE
  v_batch02_id uuid;
  v_asset RECORD;
  v_backfilled integer := 0;
BEGIN

  -- Get Batch02 job id (now renamed to "Batch 02 (100)")
  SELECT id INTO v_batch02_id
  FROM sie_jobs
  WHERE pilot_job_name = 'Batch 02 (100)'
    AND provider_mode = 'real_ai'
    AND (is_superseded IS NULL OR is_superseded = FALSE)
  LIMIT 1;

  IF v_batch02_id IS NULL THEN
    RAISE NOTICE 'Batch02 job not found — skipping backfill';
    RETURN;
  END IF;

  RAISE NOTICE 'Backfilling propagation for Batch02 job %', v_batch02_id;

  -- Loop over all validated assets in Batch02
  FOR v_asset IN
    SELECT
      a.id AS job_asset_id,
      a.public_asset_id,
      a.asset_id,
      a.result_id,
      a.review_status
    FROM openai_pilot_job_assets a
    WHERE a.batch_job_id = v_batch02_id
      AND a.review_status = 'validated'
  LOOP

    -- Backfill openai_pilot_results: mark human_validated = true
    IF v_asset.result_id IS NOT NULL THEN
      UPDATE openai_pilot_results
      SET
        human_validated = TRUE,
        validation_status = 'human_validated',
        review_status = 'validated',
        updated_at = NOW()
      WHERE id = v_asset.result_id
        AND (human_validated IS NULL OR human_validated = FALSE);
    ELSE
      -- Find result by public_asset_id + job_id
      UPDATE openai_pilot_results
      SET
        human_validated = TRUE,
        validation_status = 'human_validated',
        review_status = 'validated',
        updated_at = NOW()
      WHERE public_asset_id = v_asset.public_asset_id
        AND job_id = v_batch02_id
        AND (human_validated IS NULL OR human_validated = FALSE);
    END IF;

    -- Backfill assets: mark human_validated = true
    IF v_asset.asset_id IS NOT NULL THEN
      UPDATE assets
      SET
        human_validated = TRUE,
        human_validated_at = COALESCE(human_validated_at, NOW()),
        updated_at = NOW()
      WHERE id = v_asset.asset_id
        AND (human_validated IS NULL OR human_validated = FALSE);
    END IF;

    v_backfilled := v_backfilled + 1;

  END LOOP;

  RAISE NOTICE 'Backfilled propagation for % validated assets in Batch02', v_backfilled;

END $$;

-- ── Step 6: Ensure openai_pilot_job_assets review_status is consistent ────────
-- For any openai_pilot_results row with human_validated = true,
-- ensure the corresponding openai_pilot_job_assets row is also 'validated'

UPDATE openai_pilot_job_assets a
SET
  review_status = 'validated',
  reviewed_at = COALESCE(a.reviewed_at, NOW())
FROM openai_pilot_results r
WHERE a.result_id = r.id
  AND r.human_validated = TRUE
  AND a.review_status != 'validated';

-- Also sync by public_asset_id + batch_job_id when result_id is null
UPDATE openai_pilot_job_assets a
SET
  review_status = 'validated',
  reviewed_at = COALESCE(a.reviewed_at, NOW())
FROM openai_pilot_results r
WHERE a.public_asset_id = r.public_asset_id
  AND a.batch_job_id = r.job_id
  AND r.human_validated = TRUE
  AND a.review_status != 'validated'
  AND a.result_id IS NULL;

-- ── Step 7: Verify final state ────────────────────────────────────────────────
DO $$
DECLARE
  v_batch01_count integer;
  v_batch02_count integer;
  v_batch01_validated integer;
  v_batch02_validated integer;
BEGIN

  SELECT COUNT(*) INTO v_batch01_count
  FROM openai_pilot_job_assets a
  JOIN sie_jobs j ON j.id = a.batch_job_id
  WHERE j.pilot_job_name = 'Batch 01 (100)';

  SELECT COUNT(*) INTO v_batch02_count
  FROM openai_pilot_job_assets a
  JOIN sie_jobs j ON j.id = a.batch_job_id
  WHERE j.pilot_job_name = 'Batch 02 (100)';

  SELECT COUNT(*) INTO v_batch01_validated
  FROM openai_pilot_job_assets a
  JOIN sie_jobs j ON j.id = a.batch_job_id
  WHERE j.pilot_job_name = 'Batch 01 (100)'
    AND a.review_status = 'validated';

  SELECT COUNT(*) INTO v_batch02_validated
  FROM openai_pilot_job_assets a
  JOIN sie_jobs j ON j.id = a.batch_job_id
  WHERE j.pilot_job_name = 'Batch 02 (100)'
    AND a.review_status = 'validated';

  RAISE NOTICE '=== FINAL STATE ===';
  RAISE NOTICE 'Batch 01 (100): % total assets, % validated', v_batch01_count, v_batch01_validated;
  RAISE NOTICE 'Batch 02 (100): % total assets, % validated', v_batch02_count, v_batch02_validated;

END $$;

COMMIT;
