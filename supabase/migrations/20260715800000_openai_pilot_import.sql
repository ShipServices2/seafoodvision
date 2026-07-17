-- ============================================================
-- SEAFOOD VISION — OpenAI Vision Pilot Import Infrastructure
-- Adds tables and columns needed for the 20-asset OpenAI pilot
-- import mode in Admin → AI Studio.
-- ============================================================

-- 1. Add provider_mode column to sie_jobs if missing
ALTER TABLE public.sie_jobs
  ADD COLUMN IF NOT EXISTS provider_mode TEXT DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS pilot_job_name TEXT,
  ADD COLUMN IF NOT EXISTS total_assets INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS avg_confidence NUMERIC(5,2);

-- 2. Add provider_mode to sie_species_candidates if missing
ALTER TABLE public.sie_species_candidates
  ADD COLUMN IF NOT EXISTS provider_mode TEXT DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS result_id UUID,
  ADD COLUMN IF NOT EXISTS biological_order TEXT,
  ADD COLUMN IF NOT EXISTS visual_evidence TEXT[],
  ADD COLUMN IF NOT EXISTS identification_limits TEXT[],
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reasoning_summary TEXT;

-- 3. Create openai_pilot_import_log table to track import runs
CREATE TABLE IF NOT EXISTS public.openai_pilot_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  import_mode TEXT NOT NULL DEFAULT 'dry_run',
  manifest_data JSONB,
  assets_expected INTEGER DEFAULT 0,
  assets_found INTEGER DEFAULT 0,
  assets_missing INTEGER DEFAULT 0,
  results_imported INTEGER DEFAULT 0,
  candidates_imported INTEGER DEFAULT 0,
  metadata_imported INTEGER DEFAULT 0,
  local_names_imported INTEGER DEFAULT 0,
  keywords_imported INTEGER DEFAULT 0,
  conflicts_found INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  mock_proposals_preserved INTEGER DEFAULT 0,
  real_ai_proposals_created INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Create openai_pilot_results table for the 20 identification results
CREATE TABLE IF NOT EXISTS public.openai_pilot_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.sie_jobs(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  public_asset_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  provider_mode TEXT NOT NULL DEFAULT 'real_ai',
  model TEXT NOT NULL DEFAULT 'gpt-5-mini-2025-08-07',
  validation_status TEXT NOT NULL DEFAULT 'suggested_unverified',
  review_status TEXT NOT NULL DEFAULT 'under_review',
  publication_status TEXT NOT NULL DEFAULT 'private',
  requires_human_review BOOLEAN NOT NULL DEFAULT true,
  human_validated BOOLEAN NOT NULL DEFAULT false,
  processing_time_ms INTEGER,
  total_candidates INTEGER DEFAULT 0,
  avg_confidence NUMERIC(5,4),
  import_log_id UUID REFERENCES public.openai_pilot_import_log(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openai_pilot_results_public_asset_id
  ON public.openai_pilot_results(public_asset_id);
CREATE INDEX IF NOT EXISTS idx_openai_pilot_results_asset_id
  ON public.openai_pilot_results(asset_id);

-- 5. Create openai_pilot_candidates table
CREATE TABLE IF NOT EXISTS public.openai_pilot_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES public.openai_pilot_results(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.sie_jobs(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  public_asset_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  family TEXT,
  genus TEXT,
  biological_order TEXT,
  taxonomic_level TEXT,
  confidence_score NUMERIC(5,4) DEFAULT 0,
  visual_evidence TEXT[],
  identification_limits TEXT[],
  source TEXT DEFAULT 'openai_vision',
  provider TEXT DEFAULT 'openai',
  provider_mode TEXT DEFAULT 'real_ai',
  is_selected BOOLEAN DEFAULT false,
  is_validated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'suggested_unverified',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openai_pilot_candidates_result_id
  ON public.openai_pilot_candidates(result_id);
CREATE INDEX IF NOT EXISTS idx_openai_pilot_candidates_public_asset_id
  ON public.openai_pilot_candidates(public_asset_id);

-- 6. Create openai_pilot_candidate_metadata table
CREATE TABLE IF NOT EXISTS public.openai_pilot_candidate_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.openai_pilot_candidates(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES public.openai_pilot_results(id) ON DELETE CASCADE,
  public_asset_id TEXT NOT NULL,
  -- Species info
  species_name TEXT,
  scientific_name TEXT,
  family TEXT,
  genus TEXT,
  biological_order TEXT,
  -- Commercial names
  commercial_names TEXT[],
  -- Local names
  local_names_fr TEXT[],
  local_names_en TEXT[],
  local_names_es TEXT[],
  local_names_pt TEXT[],
  local_names_ar TEXT[],
  -- Synonyms
  synonyms TEXT[],
  -- Classification
  category TEXT,
  product_form TEXT,
  conservation_method TEXT,
  packaging TEXT,
  -- Keywords
  keywords TEXT[],
  -- Description
  short_description TEXT,
  -- Confidence scores
  vision_confidence NUMERIC(5,4),
  species_confidence NUMERIC(5,4),
  commercial_confidence NUMERIC(5,4),
  metadata_confidence NUMERIC(5,4),
  global_confidence NUMERIC(5,4),
  -- Warnings
  warnings TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openai_pilot_metadata_candidate_id
  ON public.openai_pilot_candidate_metadata(candidate_id);

-- 7. RLS policies for pilot tables
ALTER TABLE public.openai_pilot_import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_pilot_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_pilot_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_pilot_candidate_metadata ENABLE ROW LEVEL SECURITY;

-- Import log: admin/reviewer read+write
CREATE POLICY "pilot_import_log_reviewer_all" ON public.openai_pilot_import_log
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- Results: admin/reviewer read+write
CREATE POLICY "pilot_results_reviewer_all" ON public.openai_pilot_results
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- Candidates: admin/reviewer read+write
CREATE POLICY "pilot_candidates_reviewer_all" ON public.openai_pilot_candidates
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());

-- Metadata: admin/reviewer read+write
CREATE POLICY "pilot_metadata_reviewer_all" ON public.openai_pilot_candidate_metadata
  FOR ALL TO authenticated
  USING (public.sie_is_reviewer_or_admin())
  WITH CHECK (public.sie_is_reviewer_or_admin());
