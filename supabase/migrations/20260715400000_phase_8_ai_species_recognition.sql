-- ============================================================
-- SEAFOOD VISION — Phase 8: AI Species Recognition Engine
-- Migration: phase_8_ai_species_recognition
-- ============================================================
-- SAFETY: Preserves all existing assets, metadata, marketplace, imports
-- No automatic publishing — all proposals require human validation
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ai_identification_status AS ENUM (
    'pending', 'processing', 'candidates_ready', 'under_review',
    'approved', 'rejected', 'replaced', 'unknown', 'ignored', 'reported'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_validation_action AS ENUM (
    'approve', 'reject', 'replace', 'mark_unknown', 'report', 'ignore', 'undo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_provider_type AS ENUM (
    'openai', 'gemini', 'anthropic', 'local', 'mock', 'fishbase', 'worms', 'fao_asfis', 'catalogue_of_life', 'gbif'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_bulk_status AS ENUM (
    'pending', 'processing', 'completed', 'partial', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: ai_identification_jobs
-- One job per asset queued for AI identification
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_identification_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id              UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  public_asset_id       TEXT,
  status                ai_identification_status NOT NULL DEFAULT 'pending',
  priority              INTEGER NOT NULL DEFAULT 5,
  -- Current asset context (snapshot at time of queuing)
  current_name          TEXT,
  current_category      TEXT,
  current_species_id    UUID,
  -- File context
  original_filename     TEXT,
  import_batch          TEXT,
  folder_path           TEXT,
  -- Scores
  identification_confidence   NUMERIC(5,2) DEFAULT 0,
  metadata_confidence         NUMERIC(5,2) DEFAULT 0,
  commercial_confidence       NUMERIC(5,2) DEFAULT 0,
  documentation_confidence    NUMERIC(5,2) DEFAULT 0,
  global_confidence           NUMERIC(5,2) DEFAULT 0,
  -- Assignment
  reviewer_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at           TIMESTAMP WITH TIME ZONE,
  -- Timing
  queued_at             TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  reviewed_at           TIMESTAMP WITH TIME ZONE,
  -- Provider used
  ai_provider           ai_provider_type,
  ai_model              TEXT,
  -- Notes
  reviewer_comment      TEXT,
  -- Bulk job reference
  bulk_job_id           UUID,
  -- Timestamps
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_species_candidates
-- Top 5 species suggestions per identification job
-- NEVER a single automatic result — always ranked suggestions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_species_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.ai_identification_jobs(id) ON DELETE CASCADE,
  rank                INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  -- Species info
  species_id          UUID REFERENCES public.species(id) ON DELETE SET NULL,
  common_name         TEXT NOT NULL,
  scientific_name     TEXT,
  family              TEXT,
  genus               TEXT,
  -- Scores
  confidence          NUMERIC(5,2) NOT NULL DEFAULT 0,
  similarity          NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Evidence
  main_reasons        JSONB NOT NULL DEFAULT '[]',
  -- Source
  source_provider     ai_provider_type,
  source_model        TEXT,
  -- Visual analysis features used
  visual_features     JSONB DEFAULT '{}',
  -- Product form detected
  product_form        TEXT,
  -- Status
  is_selected         BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_similar_images
-- Top similar images from the validated catalog
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_similar_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES public.ai_identification_jobs(id) ON DELETE CASCADE,
  similar_asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  species_name    TEXT,
  family_name     TEXT,
  category_name   TEXT,
  match_features  JSONB DEFAULT '{}',
  rank            INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_validation_history
-- Every human validation action — immutable audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_validation_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.ai_identification_jobs(id) ON DELETE CASCADE,
  action              ai_validation_action NOT NULL,
  reviewer_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- What was selected
  selected_candidate_id UUID REFERENCES public.ai_species_candidates(id) ON DELETE SET NULL,
  selected_species_id   UUID REFERENCES public.species(id) ON DELETE SET NULL,
  -- Before/after
  previous_status     ai_identification_status,
  new_status          ai_identification_status,
  -- Comment
  comment             TEXT,
  -- Propagation flags
  propagated_to_metadata_review BOOLEAN DEFAULT FALSE,
  propagated_to_encyclopedia    BOOLEAN DEFAULT FALSE,
  propagated_to_search          BOOLEAN DEFAULT FALSE,
  propagated_to_marketplace     BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_bulk_jobs
-- Bulk identification batches (50/100/250/500)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_bulk_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_size      INTEGER NOT NULL,
  status          ai_bulk_status NOT NULL DEFAULT 'pending',
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Progress
  total_assets    INTEGER NOT NULL DEFAULT 0,
  processed       INTEGER NOT NULL DEFAULT 0,
  approved        INTEGER NOT NULL DEFAULT 0,
  rejected        INTEGER NOT NULL DEFAULT 0,
  unknown         INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  -- Timing
  started_at      TIMESTAMP WITH TIME ZONE,
  completed_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_knowledge_sources
-- Connector registry for FishBase, WoRMS, FAO ASFIS, etc.
-- Enrichment only — never auto-publish
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name     TEXT NOT NULL UNIQUE,
  source_type     ai_provider_type NOT NULL,
  is_enabled      BOOLEAN DEFAULT TRUE,
  base_url        TEXT,
  api_key_env     TEXT,
  last_sync_at    TIMESTAMP WITH TIME ZONE,
  sync_count      INTEGER DEFAULT 0,
  description     TEXT,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_provider_config
-- AI Provider abstraction — pluggable, never locked to one model
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_provider_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        ai_provider_type NOT NULL,
  model_name      TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT FALSE,
  is_default      BOOLEAN DEFAULT FALSE,
  priority        INTEGER DEFAULT 10,
  max_tokens      INTEGER DEFAULT 2000,
  temperature     NUMERIC(3,2) DEFAULT 0.2,
  capabilities    JSONB DEFAULT '["species_identification", "visual_analysis"]',
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- TABLE: ai_learning_feedback
-- Human validations feed back into future suggestions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_learning_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID REFERENCES public.ai_identification_jobs(id) ON DELETE CASCADE,
  candidate_id        UUID REFERENCES public.ai_species_candidates(id) ON DELETE CASCADE,
  reviewer_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback_type       TEXT NOT NULL CHECK (feedback_type IN ('correct', 'incorrect', 'partial', 'unknown')),
  correct_species_id  UUID REFERENCES public.species(id) ON DELETE SET NULL,
  correct_common_name TEXT,
  notes               TEXT,
  used_for_training   BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_identification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_asset_id ON public.ai_identification_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_reviewer ON public.ai_identification_jobs(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_bulk ON public.ai_identification_jobs(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_ai_candidates_job ON public.ai_species_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_candidates_rank ON public.ai_species_candidates(job_id, rank);
CREATE INDEX IF NOT EXISTS idx_ai_similar_job ON public.ai_similar_images(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_job ON public.ai_validation_history(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_reviewer ON public.ai_validation_history(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_job ON public.ai_learning_feedback(job_id);

-- ============================================================
-- UPDATE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_ai_job_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_jobs_updated ON public.ai_identification_jobs;
CREATE TRIGGER trg_ai_jobs_updated
  BEFORE UPDATE ON public.ai_identification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_job_timestamp();

DROP TRIGGER IF EXISTS trg_ai_bulk_updated ON public.ai_bulk_jobs;
CREATE TRIGGER trg_ai_bulk_updated
  BEFORE UPDATE ON public.ai_bulk_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_job_timestamp();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.ai_identification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_species_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_similar_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_validation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_feedback ENABLE ROW LEVEL SECURITY;

-- Admin/reviewer read all
CREATE POLICY "admin_read_ai_jobs" ON public.ai_identification_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_jobs" ON public.ai_identification_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_read_ai_candidates" ON public.ai_species_candidates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_candidates" ON public.ai_species_candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_read_ai_similar" ON public.ai_similar_images
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_similar" ON public.ai_similar_images
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_read_ai_history" ON public.ai_validation_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_history" ON public.ai_validation_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_read_ai_bulk" ON public.ai_bulk_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_bulk" ON public.ai_bulk_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin'))
  );

CREATE POLICY "admin_read_ai_sources" ON public.ai_knowledge_sources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_sources" ON public.ai_knowledge_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin'))
  );

CREATE POLICY "admin_read_ai_provider" ON public.ai_provider_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_provider" ON public.ai_provider_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin'))
  );

CREATE POLICY "admin_read_ai_learning" ON public.ai_learning_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

CREATE POLICY "admin_write_ai_learning" ON public.ai_learning_feedback
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator','super_admin','reviewer'))
  );

-- ============================================================
-- SEED: Knowledge Sources
-- ============================================================

INSERT INTO public.ai_knowledge_sources (source_name, source_type, is_enabled, base_url, description, notes)
VALUES
  ('FishBase', 'fishbase', TRUE, 'https://www.fishbase.se/api/', 'Global fish species database — enrichment only, never auto-publish', 'Connector ready — API key optional for public endpoints'),
  ('WoRMS', 'worms', TRUE, 'https://www.marinespecies.org/rest/', 'World Register of Marine Species — taxonomic authority', 'REST API, no key required'),
  ('FAO ASFIS', 'fao_asfis', TRUE, 'https://www.fao.org/fishery/api/', 'FAO Aquatic Sciences and Fisheries Information System', 'CSV/API available'),
  ('Catalogue of Life', 'catalogue_of_life', TRUE, 'https://api.catalogueoflife.org/', 'Global species checklist — taxonomic backbone', 'REST API v1'),
  ('GBIF', 'gbif', TRUE, 'https://api.gbif.org/v1/', 'Global Biodiversity Information Facility — occurrence data', 'REST API, no key required for read')
ON CONFLICT (source_name) DO NOTHING;

-- ============================================================
-- SEED: AI Provider Config (mock/placeholder — no real keys stored)
-- ============================================================

INSERT INTO public.ai_provider_config (provider, model_name, is_active, is_default, priority, notes)
VALUES
  ('mock', 'seafood-vision-mock-v1', TRUE, TRUE, 1, 'Mock provider for development — returns structured Top 5 suggestions'),
  ('openai', 'gpt-4o', FALSE, FALSE, 2, 'Requires OPENAI_API_KEY env variable'),
  ('gemini', 'gemini-1.5-pro', FALSE, FALSE, 3, 'Requires GEMINI_API_KEY env variable'),
  ('anthropic', 'claude-3-5-sonnet-20241022', FALSE, FALSE, 4, 'Requires ANTHROPIC_API_KEY env variable')
ON CONFLICT DO NOTHING;
