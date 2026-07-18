-- ============================================================
-- SEAFOOD VISION — Propagation Backfill Support
-- Migration: 20260717040000_propagation_backfill_support.sql
--
-- Ensures openai_pilot_results has propagation tracking columns
-- (already exist per schema, but adds indexes for backfill queries)
-- Resets propagation_status to 'pending' for validated results
-- that don't have asset_species yet (incomplete propagation).
-- ============================================================

-- ── Ensure propagation columns exist (idempotent) ──────────────────────────
ALTER TABLE public.openai_pilot_results
  ADD COLUMN IF NOT EXISTS propagation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS propagation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS propagation_error TEXT;

-- ── Index for efficient backfill queries ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_openai_pilot_results_propagation
  ON public.openai_pilot_results (propagation_status, human_validated);

CREATE INDEX IF NOT EXISTS idx_openai_pilot_results_job_validated
  ON public.openai_pilot_results (job_id, human_validated);

-- ── Reset stale 'propagating' status (from interrupted runs) ──────────────
UPDATE public.openai_pilot_results
SET propagation_status = 'pending'
WHERE propagation_status = 'propagating';

-- ── Mark results as needing backfill if:
--    - human_validated = true
--    - propagation_status is 'completed'
--    - BUT asset_species row does NOT exist for the asset
-- This handles cases where propagation_status was set to 'completed'
-- but the actual writes failed silently.
-- ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fixed_count INTEGER := 0;
BEGIN
  -- Find results that claim 'completed' but have no asset_species
  UPDATE public.openai_pilot_results opr
  SET propagation_status = 'pending',
      propagation_error = 'Reset: asset_species row missing despite completed status'
  WHERE opr.human_validated = true
    AND opr.propagation_status = 'completed'
    AND opr.asset_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.asset_species asp
      WHERE asp.asset_id = opr.asset_id
        AND asp.relation_type = 'primary'
    );

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Reset % results with missing asset_species to pending', fixed_count;

  -- Also reset results that claim 'completed' but have no search_aliases
  UPDATE public.openai_pilot_results opr
  SET propagation_status = 'pending',
      propagation_error = 'Reset: search_aliases missing despite completed status'
  WHERE opr.human_validated = true
    AND opr.propagation_status = 'completed'
    AND opr.asset_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = opr.asset_id
        AND (a.search_aliases IS NULL OR array_length(a.search_aliases, 1) IS NULL)
    );

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Reset % results with missing search_aliases to pending', fixed_count;
END $$;

-- ── Ensure assets table has search_aliases column (idempotent) ─────────────
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS search_aliases TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_search_aliases
  ON public.assets USING GIN (search_aliases);

-- ── Ensure assets table has human_validated columns (idempotent) ───────────
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS human_validated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_validated_by UUID,
  ADD COLUMN IF NOT EXISTS validated_metadata JSONB;
