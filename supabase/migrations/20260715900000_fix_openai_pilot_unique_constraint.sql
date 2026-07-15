-- ============================================================
-- SEAFOOD VISION — Fix: Add unique constraint on openai_pilot_results.public_asset_id
-- Root cause: upsert with onConflict:'public_asset_id' silently failed because
-- no unique index existed on that column. Every insert returned null, causing
-- the import loop to skip all assets → 0 results, 0 candidates, 0 metadata.
-- ============================================================

-- 1. Add unique index on openai_pilot_results.public_asset_id
--    This makes the upsert onConflict:'public_asset_id' work correctly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_openai_pilot_results_public_asset_id_unique
  ON public.openai_pilot_results(public_asset_id);

-- 2. Add unique index on openai_pilot_candidates (result_id, rank)
--    Prevents duplicate candidates per result on re-import.
CREATE UNIQUE INDEX IF NOT EXISTS idx_openai_pilot_candidates_result_rank_unique
  ON public.openai_pilot_candidates(result_id, rank);
