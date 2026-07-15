-- ============================================================
-- SEAFOOD VISION — Phase 8.1 Correction
-- Add missing columns to sie_propagation_log and sie_jobs
-- for complete propagation tracking
-- ============================================================

-- Add asset_id and propagated_fields to sie_propagation_log if missing
ALTER TABLE public.sie_propagation_log
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_table TEXT,
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS propagation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS propagated_fields JSONB DEFAULT '{}';

-- Add reviewer_id to sie_jobs if missing (already exists but ensure)
ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add description_candidate and other enrichment fields to sie_species_candidates
ALTER TABLE public.sie_species_candidates
  ADD COLUMN IF NOT EXISTS description_candidate TEXT,
  ADD COLUMN IF NOT EXISTS category_candidate TEXT,
  ADD COLUMN IF NOT EXISTS packaging_candidate TEXT,
  ADD COLUMN IF NOT EXISTS product_candidate TEXT,
  ADD COLUMN IF NOT EXISTS keywords_candidate TEXT[];

-- Add field_name to sie_validation_history if missing
ALTER TABLE public.sie_validation_history
  ADD COLUMN IF NOT EXISTS field_name TEXT;
