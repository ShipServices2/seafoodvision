-- ============================================================
-- SEAFOOD VISION — Phase 8: Seafood Intelligence Engine (SIE)
-- AI Studio, Vision Engine, Species Candidates, Commercial Enrichment,
-- Multilingual Names, Biological Data, Similarity Engine, Confidence Scores
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.sie_job_status CASCADE;
CREATE TYPE public.sie_job_status AS ENUM (
  'queued', 'analyzing', 'vision_processing', 'taxonomy_search',
  'building_metadata', 'proposals_ready', 'under_review', 'validated', 'rejected', 'unknown', 'ignored'
);

DROP TYPE IF EXISTS public.sie_validation_action CASCADE;
CREATE TYPE public.sie_validation_action AS ENUM (
  'approve', 'reject', 'edit', 'unknown', 'undo', 'comment'
);

DROP TYPE IF EXISTS public.sie_product_form CASCADE;
CREATE TYPE public.sie_product_form AS ENUM (
  'whole', 'hgt', 'fillet', 'steak', 'loin', 'iqf', 'block', 'vacuum', 'portion', 'other'
);

DROP TYPE IF EXISTS public.sie_confidence_level CASCADE;
CREATE TYPE public.sie_confidence_level AS ENUM (
  'very_low', 'low', 'medium', 'high', 'very_high'
);

DROP TYPE IF EXISTS public.sie_propagation_status CASCADE;
CREATE TYPE public.sie_propagation_status AS ENUM (
  'pending', 'propagating', 'completed', 'failed'
);

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- AI Studio Jobs (main processing queue)
CREATE TABLE IF NOT EXISTS public.sie_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  public_asset_id TEXT,
  image_url TEXT,
  original_filename TEXT,
  import_batch TEXT,
  current_name TEXT,
  current_category TEXT,
  existing_tags TEXT[],
  job_status public.sie_job_status DEFAULT 'queued',
  batch_id UUID,
  -- Progress tracking
  progress_step TEXT DEFAULT 'queued',
  progress_pct INTEGER DEFAULT 0,
  -- Confidence scores (0-100)
  vision_confidence INTEGER,
  species_confidence INTEGER,
  commercial_confidence INTEGER,
  metadata_confidence INTEGER,
  documentation_confidence INTEGER,
  global_confidence INTEGER,
  -- Processing metadata
  ai_provider TEXT DEFAULT 'mock',
  ai_model TEXT,
  processing_time_ms INTEGER,
  ambiguity_detected BOOLEAN DEFAULT true,
  -- Review
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  -- Propagation
  propagation_status public.sie_propagation_status DEFAULT 'pending',
  propagated_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Species Candidates (Top 5 per job — never single answer)
CREATE TABLE IF NOT EXISTS public.sie_species_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  -- Species identification
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  genus TEXT,
  family TEXT,
  order_name TEXT,
  class_name TEXT,
  kingdom TEXT,
  -- Scores
  ai_score INTEGER DEFAULT 0 CHECK (ai_score BETWEEN 0 AND 100),
  similarity_score INTEGER DEFAULT 0 CHECK (similarity_score BETWEEN 0 AND 100),
  -- Reasoning
  main_reasons TEXT[],
  visual_features JSONB DEFAULT '{}',
  -- Commercial enrichment
  commercial_name TEXT,
  product_form public.sie_product_form,
  packaging TEXT,
  commercial_category TEXT,
  -- Status
  is_selected BOOLEAN DEFAULT false,
  is_validated BOOLEAN DEFAULT false,
  source_provider TEXT DEFAULT 'mock',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Commercial Enrichment per candidate
CREATE TABLE IF NOT EXISTS public.sie_commercial_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.sie_species_candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  -- Names
  commercial_name TEXT,
  scientific_name TEXT,
  synonyms TEXT[],
  aliases TEXT[],
  keywords TEXT[],
  -- Description
  description TEXT,
  description_fr TEXT,
  description_en TEXT,
  description_es TEXT,
  -- Classification
  category TEXT,
  subcategory TEXT,
  -- Product forms
  product_forms TEXT[],
  packaging_types TEXT[],
  -- Status
  review_status TEXT DEFAULT 'under_review',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Multilingual Names Table
CREATE TABLE IF NOT EXISTS public.sie_multilingual_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scientific_name TEXT NOT NULL,
  -- Official names
  fao_name TEXT,
  asfis_name TEXT,
  -- Language names (multiple per language via array)
  names_fr TEXT[],
  names_en TEXT[],
  names_es TEXT[],
  names_pt TEXT[],
  names_ar TEXT[],
  -- Commercial
  commercial_name_primary TEXT,
  aliases TEXT[],
  synonyms TEXT[],
  -- Source
  source TEXT DEFAULT 'sie',
  validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Biological Data Fields
CREATE TABLE IF NOT EXISTS public.sie_biological_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scientific_name TEXT NOT NULL,
  common_name TEXT,
  genus TEXT,
  family TEXT,
  order_name TEXT,
  class_name TEXT,
  kingdom TEXT DEFAULT 'Animalia',
  -- Geography
  fao_area TEXT[],
  habitat TEXT,
  distribution TEXT,
  -- Physical
  max_length_cm NUMERIC,
  max_weight_kg NUMERIC,
  -- Commercial & Conservation
  commercial_importance TEXT,
  conservation_status TEXT,
  iucn_status TEXT,
  -- Validation
  review_status TEXT DEFAULT 'under_review',
  validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  -- Source
  source TEXT DEFAULT 'sie',
  external_refs JSONB DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Similarity Engine Results
CREATE TABLE IF NOT EXISTS public.sie_similarity_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  similar_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  similar_public_asset_id TEXT,
  similarity_score INTEGER DEFAULT 0 CHECK (similarity_score BETWEEN 0 AND 100),
  species TEXT,
  family TEXT,
  product_form TEXT,
  category TEXT,
  image_url TEXT,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Human Validation History
CREATE TABLE IF NOT EXISTS public.sie_validation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.sie_species_candidates(id) ON DELETE SET NULL,
  action public.sie_validation_action NOT NULL,
  field_name TEXT,
  previous_value TEXT,
  new_value TEXT,
  previous_status TEXT,
  new_status TEXT,
  comment TEXT,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Batch Jobs (for bulk processing)
CREATE TABLE IF NOT EXISTS public.sie_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT,
  batch_size INTEGER NOT NULL,
  processed INTEGER DEFAULT 0,
  validated INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  unknown INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge Connectors Config
CREATE TABLE IF NOT EXISTS public.sie_knowledge_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  source_url TEXT,
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  enrichment_only BOOLEAN DEFAULT true,
  auto_publish BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  total_queries INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Learning Engine Feedback
CREATE TABLE IF NOT EXISTS public.sie_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.sie_jobs(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.sie_species_candidates(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  correct_species TEXT,
  correct_family TEXT,
  correct_product_form TEXT,
  visual_features JSONB DEFAULT '{}',
  context_hints JSONB DEFAULT '{}',
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Propagation Log
CREATE TABLE IF NOT EXISTS public.sie_propagation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sie_jobs(id) ON DELETE CASCADE,
  target_system TEXT NOT NULL,
  status public.sie_propagation_status DEFAULT 'pending',
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  propagated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sie_jobs_status ON public.sie_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_sie_jobs_asset_id ON public.sie_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_sie_jobs_batch_id ON public.sie_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_sie_jobs_created_at ON public.sie_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sie_jobs_reviewer ON public.sie_jobs(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_sie_candidates_job_id ON public.sie_species_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_sie_candidates_rank ON public.sie_species_candidates(job_id, rank);
CREATE INDEX IF NOT EXISTS idx_sie_candidates_scientific ON public.sie_species_candidates(scientific_name);

CREATE INDEX IF NOT EXISTS idx_sie_similarity_job_id ON public.sie_similarity_results(job_id);
CREATE INDEX IF NOT EXISTS idx_sie_similarity_score ON public.sie_similarity_results(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_sie_validation_job_id ON public.sie_validation_history(job_id);
CREATE INDEX IF NOT EXISTS idx_sie_validation_reviewer ON public.sie_validation_history(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_sie_validation_created ON public.sie_validation_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sie_multilingual_scientific ON public.sie_multilingual_names(scientific_name);
CREATE INDEX IF NOT EXISTS idx_sie_biological_scientific ON public.sie_biological_data(scientific_name);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.sie_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_jobs', COUNT(*),
    'queued', COUNT(*) FILTER (WHERE job_status = 'queued'),
    'proposals_ready', COUNT(*) FILTER (WHERE job_status = 'proposals_ready'),
    'validated', COUNT(*) FILTER (WHERE job_status = 'validated'),
    'rejected', COUNT(*) FILTER (WHERE job_status = 'rejected'),
    'unknown', COUNT(*) FILTER (WHERE job_status = 'unknown'),
    'ignored', COUNT(*) FILTER (WHERE job_status = 'ignored'),
    'avg_global_confidence', ROUND(AVG(global_confidence) FILTER (WHERE global_confidence IS NOT NULL))
  ) INTO result
  FROM public.sie_jobs;
  RETURN result;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================

ALTER TABLE public.sie_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_species_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_commercial_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_multilingual_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_biological_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_similarity_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_validation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_knowledge_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sie_propagation_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- Helper function for role check (reuse existing pattern)
CREATE OR REPLACE FUNCTION public.sie_is_reviewer_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('reviewer', 'administrator', 'super_admin')
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.sie_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('administrator', 'super_admin')
    AND is_active = true
  )
$$;

-- sie_jobs
DROP POLICY IF EXISTS "sie_jobs_reviewer_read" ON public.sie_jobs;
CREATE POLICY "sie_jobs_reviewer_read" ON public.sie_jobs
  FOR SELECT TO authenticated USING (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_jobs_admin_write" ON public.sie_jobs;
CREATE POLICY "sie_jobs_admin_write" ON public.sie_jobs
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_species_candidates
DROP POLICY IF EXISTS "sie_candidates_reviewer_read" ON public.sie_species_candidates;
CREATE POLICY "sie_candidates_reviewer_read" ON public.sie_species_candidates
  FOR SELECT TO authenticated USING (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_candidates_admin_write" ON public.sie_species_candidates;
CREATE POLICY "sie_candidates_admin_write" ON public.sie_species_candidates
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_commercial_enrichment
DROP POLICY IF EXISTS "sie_enrichment_reviewer_read" ON public.sie_commercial_enrichment;
CREATE POLICY "sie_enrichment_reviewer_read" ON public.sie_commercial_enrichment
  FOR SELECT TO authenticated USING (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_enrichment_admin_write" ON public.sie_commercial_enrichment;
CREATE POLICY "sie_enrichment_admin_write" ON public.sie_commercial_enrichment
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_multilingual_names — public read
DROP POLICY IF EXISTS "sie_multilingual_public_read" ON public.sie_multilingual_names;
CREATE POLICY "sie_multilingual_public_read" ON public.sie_multilingual_names
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "sie_multilingual_admin_write" ON public.sie_multilingual_names;
CREATE POLICY "sie_multilingual_admin_write" ON public.sie_multilingual_names
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_biological_data — public read
DROP POLICY IF EXISTS "sie_biological_public_read" ON public.sie_biological_data;
CREATE POLICY "sie_biological_public_read" ON public.sie_biological_data
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "sie_biological_admin_write" ON public.sie_biological_data;
CREATE POLICY "sie_biological_admin_write" ON public.sie_biological_data
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_similarity_results
DROP POLICY IF EXISTS "sie_similarity_reviewer_read" ON public.sie_similarity_results;
CREATE POLICY "sie_similarity_reviewer_read" ON public.sie_similarity_results
  FOR SELECT TO authenticated USING (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_similarity_admin_write" ON public.sie_similarity_results;
CREATE POLICY "sie_similarity_admin_write" ON public.sie_similarity_results
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_validation_history
DROP POLICY IF EXISTS "sie_validation_reviewer_read" ON public.sie_validation_history;
CREATE POLICY "sie_validation_reviewer_read" ON public.sie_validation_history
  FOR SELECT TO authenticated USING (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_validation_reviewer_insert" ON public.sie_validation_history;
CREATE POLICY "sie_validation_reviewer_insert" ON public.sie_validation_history
  FOR INSERT TO authenticated WITH CHECK (public.sie_is_reviewer_or_admin());

-- sie_batch_jobs
DROP POLICY IF EXISTS "sie_batch_admin_all" ON public.sie_batch_jobs;
CREATE POLICY "sie_batch_admin_all" ON public.sie_batch_jobs
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_knowledge_connectors — public read
DROP POLICY IF EXISTS "sie_connectors_public_read" ON public.sie_knowledge_connectors;
CREATE POLICY "sie_connectors_public_read" ON public.sie_knowledge_connectors
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "sie_connectors_admin_write" ON public.sie_knowledge_connectors;
CREATE POLICY "sie_connectors_admin_write" ON public.sie_knowledge_connectors
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- sie_learning_feedback
DROP POLICY IF EXISTS "sie_learning_reviewer_insert" ON public.sie_learning_feedback;
CREATE POLICY "sie_learning_reviewer_insert" ON public.sie_learning_feedback
  FOR INSERT TO authenticated WITH CHECK (public.sie_is_reviewer_or_admin());

DROP POLICY IF EXISTS "sie_learning_admin_read" ON public.sie_learning_feedback;
CREATE POLICY "sie_learning_admin_read" ON public.sie_learning_feedback
  FOR SELECT TO authenticated USING (public.sie_is_admin());

-- sie_propagation_log
DROP POLICY IF EXISTS "sie_propagation_admin_all" ON public.sie_propagation_log;
CREATE POLICY "sie_propagation_admin_all" ON public.sie_propagation_log
  FOR ALL TO authenticated USING (public.sie_is_admin()) WITH CHECK (public.sie_is_admin());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS sie_jobs_updated_at ON public.sie_jobs;
CREATE TRIGGER sie_jobs_updated_at
  BEFORE UPDATE ON public.sie_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sie_update_updated_at();

DROP TRIGGER IF EXISTS sie_enrichment_updated_at ON public.sie_commercial_enrichment;
CREATE TRIGGER sie_enrichment_updated_at
  BEFORE UPDATE ON public.sie_commercial_enrichment
  FOR EACH ROW EXECUTE FUNCTION public.sie_update_updated_at();

DROP TRIGGER IF EXISTS sie_multilingual_updated_at ON public.sie_multilingual_names;
CREATE TRIGGER sie_multilingual_updated_at
  BEFORE UPDATE ON public.sie_multilingual_names
  FOR EACH ROW EXECUTE FUNCTION public.sie_update_updated_at();

DROP TRIGGER IF EXISTS sie_biological_updated_at ON public.sie_biological_data;
CREATE TRIGGER sie_biological_updated_at
  BEFORE UPDATE ON public.sie_biological_data
  FOR EACH ROW EXECUTE FUNCTION public.sie_update_updated_at();

-- ============================================================
-- 8. SEED DATA — Knowledge Connectors
-- ============================================================

INSERT INTO public.sie_knowledge_connectors (source_name, source_url, api_endpoint, is_active, enrichment_only, auto_publish, description)
VALUES
  ('FishBase', 'https://www.fishbase.org', 'https://fishbase.ropensci.org', true, true, false, 'Global fish species database — enrichment only, no auto-publish'),
  ('WoRMS', 'https://www.marinespecies.org', 'https://www.marinespecies.org/rest', true, true, false, 'World Register of Marine Species — taxonomy enrichment'),
  ('FAO ASFIS', 'https://www.fao.org/fishery/en/collection/asfis', null, true, true, false, 'FAO Aquatic Sciences and Fisheries Information System — official names'),
  ('Catalogue of Life', 'https://www.catalogueoflife.org', 'https://api.catalogueoflife.org', true, true, false, 'Global species checklist — taxonomy validation'),
  ('GBIF', 'https://www.gbif.org', 'https://api.gbif.org/v1', true, true, false, 'Global Biodiversity Information Facility — occurrence and taxonomy data')
ON CONFLICT (source_name) DO NOTHING;
