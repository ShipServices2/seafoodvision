-- Phase 7.15: Metadata Review Center
-- Preserves all existing data. No destructive operations.

-- ============================================================
-- ENUMS
-- ============================================================

DROP TYPE IF EXISTS public.metadata_suggestion_status CASCADE;
CREATE TYPE public.metadata_suggestion_status AS ENUM (
  'suggested', 'under_review', 'approved', 'rejected', 'merged', 'obsolete', 'published'
);

DROP TYPE IF EXISTS public.metadata_source_type CASCADE;
CREATE TYPE public.metadata_source_type AS ENUM (
  'codex', 'manual', 'import', 'ai_generated', 'admin'
);

DROP TYPE IF EXISTS public.synonym_type CASCADE;
CREATE TYPE public.synonym_type AS ENUM (
  'common_name', 'trade_name', 'local_name', 'scientific_synonym', 'abbreviation', 'alias'
);

DROP TYPE IF EXISTS public.keyword_status CASCADE;
CREATE TYPE public.keyword_status AS ENUM (
  'pending', 'validated', 'rejected', 'merged'
);

DROP TYPE IF EXISTS public.species_review_status CASCADE;
CREATE TYPE public.species_review_status AS ENUM (
  'suggested', 'under_review', 'validated', 'rejected', 'merged', 'conflicted'
);

DROP TYPE IF EXISTS public.metadata_history_action CASCADE;
CREATE TYPE public.metadata_history_action AS ENUM (
  'created', 'updated', 'approved', 'rejected', 'merged', 'deleted', 'published',
  'status_changed', 'bulk_action', 'import', 'undo'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Metadata suggestions per asset (from Codex or manual)
CREATE TABLE IF NOT EXISTS public.metadata_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  suggested_value TEXT,
  current_value TEXT,
  confidence_score NUMERIC(5,4) DEFAULT 0,
  status public.metadata_suggestion_status DEFAULT 'under_review',
  source public.metadata_source_type DEFAULT 'codex',
  source_ref TEXT,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Asset metadata review state (one row per asset)
CREATE TABLE IF NOT EXISTS public.asset_metadata_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  review_status public.metadata_suggestion_status DEFAULT 'under_review',
  quality_score NUMERIC(5,2) DEFAULT 0,
  completeness_score NUMERIC(5,2) DEFAULT 0,
  confidence_score NUMERIC(5,2) DEFAULT 0,
  human_validation_score NUMERIC(5,2) DEFAULT 0,
  seo_score NUMERIC(5,2) DEFAULT 0,
  commercial_score NUMERIC(5,2) DEFAULT 0,
  taxonomic_score NUMERIC(5,2) DEFAULT 0,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Synonym management
CREATE TABLE IF NOT EXISTS public.metadata_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  synonym_type public.synonym_type DEFAULT 'common_name',
  species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  frequency INTEGER DEFAULT 0,
  status public.metadata_suggestion_status DEFAULT 'under_review',
  source public.metadata_source_type DEFAULT 'codex',
  merged_into UUID REFERENCES public.metadata_synonyms(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Keyword management (extends existing keywords table)
CREATE TABLE IF NOT EXISTS public.metadata_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  status public.keyword_status DEFAULT 'pending',
  source public.metadata_source_type DEFAULT 'codex',
  frequency INTEGER DEFAULT 0,
  merged_into UUID REFERENCES public.metadata_keywords(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(normalized_term, language)
);

-- Species review (extends existing species table)
CREATE TABLE IF NOT EXISTS public.species_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID REFERENCES public.species(id) ON DELETE CASCADE,
  review_status public.species_review_status DEFAULT 'under_review',
  proposed_common_name TEXT,
  proposed_scientific_name TEXT,
  proposed_family TEXT,
  proposed_genus TEXT,
  confidence_score NUMERIC(5,4) DEFAULT 0,
  source public.metadata_source_type DEFAULT 'codex',
  similar_species_ids UUID[] DEFAULT ARRAY[]::UUID[],
  confused_with_ids UUID[] DEFAULT ARRAY[]::UUID[],
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  merged_into UUID REFERENCES public.species(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Full history of all metadata changes
CREATE TABLE IF NOT EXISTS public.metadata_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'asset', 'species', 'synonym', 'keyword', 'suggestion'
  entity_id UUID NOT NULL,
  action public.metadata_history_action NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  source public.metadata_source_type DEFAULT 'manual',
  batch_id UUID,
  is_undone BOOLEAN DEFAULT false,
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Metadata import batches (CSV packs from Codex)
CREATE TABLE IF NOT EXISTS public.metadata_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  source public.metadata_source_type DEFAULT 'codex',
  status TEXT DEFAULT 'pending', -- pending, dry_run, validated, importing, completed, failed
  dry_run BOOLEAN DEFAULT true,
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  rejected_rows INTEGER DEFAULT 0,
  conflict_rows INTEGER DEFAULT 0,
  new_keywords INTEGER DEFAULT 0,
  new_species INTEGER DEFAULT 0,
  new_families INTEGER DEFAULT 0,
  new_synonyms INTEGER DEFAULT 0,
  files_included TEXT[] DEFAULT ARRAY[]::TEXT[],
  report JSONB DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bulk review actions log
CREATE TABLE IF NOT EXISTS public.metadata_bulk_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  asset_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  parameters JSONB DEFAULT '{}'::JSONB,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ DEFAULT now(),
  is_undone BOOLEAN DEFAULT false,
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  undo_data JSONB DEFAULT '{}'::JSONB
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_metadata_suggestions_asset_id ON public.metadata_suggestions(asset_id);
CREATE INDEX IF NOT EXISTS idx_metadata_suggestions_status ON public.metadata_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_metadata_suggestions_source ON public.metadata_suggestions(source);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_reviews_asset_id ON public.asset_metadata_reviews(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_reviews_status ON public.asset_metadata_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_metadata_synonyms_species_id ON public.metadata_synonyms(species_id);
CREATE INDEX IF NOT EXISTS idx_metadata_synonyms_status ON public.metadata_synonyms(status);
CREATE INDEX IF NOT EXISTS idx_metadata_synonyms_language ON public.metadata_synonyms(language);
CREATE INDEX IF NOT EXISTS idx_metadata_keywords_status ON public.metadata_keywords(status);
CREATE INDEX IF NOT EXISTS idx_metadata_keywords_normalized ON public.metadata_keywords(normalized_term);
CREATE INDEX IF NOT EXISTS idx_species_reviews_species_id ON public.species_reviews(species_id);
CREATE INDEX IF NOT EXISTS idx_species_reviews_status ON public.species_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_metadata_history_entity ON public.metadata_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_metadata_history_performed_at ON public.metadata_history(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_history_batch_id ON public.metadata_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_metadata_import_batches_status ON public.metadata_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_metadata_bulk_actions_performed_by ON public.metadata_bulk_actions(performed_by);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_metadata_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('reviewer', 'administrator', 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_metadata_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('administrator', 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.update_metadata_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.metadata_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_metadata_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_bulk_actions ENABLE ROW LEVEL SECURITY;

-- metadata_suggestions
DROP POLICY IF EXISTS "reviewers_read_metadata_suggestions" ON public.metadata_suggestions;
CREATE POLICY "reviewers_read_metadata_suggestions" ON public.metadata_suggestions
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "admins_manage_metadata_suggestions" ON public.metadata_suggestions;
CREATE POLICY "admins_manage_metadata_suggestions" ON public.metadata_suggestions
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_update_metadata_suggestions" ON public.metadata_suggestions;
CREATE POLICY "reviewers_update_metadata_suggestions" ON public.metadata_suggestions
  FOR UPDATE TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- asset_metadata_reviews
DROP POLICY IF EXISTS "reviewers_read_asset_metadata_reviews" ON public.asset_metadata_reviews;
CREATE POLICY "reviewers_read_asset_metadata_reviews" ON public.asset_metadata_reviews
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "admins_manage_asset_metadata_reviews" ON public.asset_metadata_reviews;
CREATE POLICY "admins_manage_asset_metadata_reviews" ON public.asset_metadata_reviews
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_update_asset_metadata_reviews" ON public.asset_metadata_reviews;
CREATE POLICY "reviewers_update_asset_metadata_reviews" ON public.asset_metadata_reviews
  FOR UPDATE TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- metadata_synonyms
DROP POLICY IF EXISTS "reviewers_read_metadata_synonyms" ON public.metadata_synonyms;
CREATE POLICY "reviewers_read_metadata_synonyms" ON public.metadata_synonyms
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "admins_manage_metadata_synonyms" ON public.metadata_synonyms;
CREATE POLICY "admins_manage_metadata_synonyms" ON public.metadata_synonyms
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_update_metadata_synonyms" ON public.metadata_synonyms;
CREATE POLICY "reviewers_update_metadata_synonyms" ON public.metadata_synonyms
  FOR UPDATE TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- metadata_keywords
DROP POLICY IF EXISTS "reviewers_read_metadata_keywords" ON public.metadata_keywords;
CREATE POLICY "reviewers_read_metadata_keywords" ON public.metadata_keywords
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "admins_manage_metadata_keywords" ON public.metadata_keywords;
CREATE POLICY "admins_manage_metadata_keywords" ON public.metadata_keywords
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_update_metadata_keywords" ON public.metadata_keywords;
CREATE POLICY "reviewers_update_metadata_keywords" ON public.metadata_keywords
  FOR UPDATE TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- species_reviews
DROP POLICY IF EXISTS "reviewers_read_species_reviews" ON public.species_reviews;
CREATE POLICY "reviewers_read_species_reviews" ON public.species_reviews
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "admins_manage_species_reviews" ON public.species_reviews;
CREATE POLICY "admins_manage_species_reviews" ON public.species_reviews
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_update_species_reviews" ON public.species_reviews;
CREATE POLICY "reviewers_update_species_reviews" ON public.species_reviews
  FOR UPDATE TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- metadata_history (read-only for reviewers, insert for all reviewers)
DROP POLICY IF EXISTS "reviewers_read_metadata_history" ON public.metadata_history;
CREATE POLICY "reviewers_read_metadata_history" ON public.metadata_history
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

DROP POLICY IF EXISTS "reviewers_insert_metadata_history" ON public.metadata_history;
CREATE POLICY "reviewers_insert_metadata_history" ON public.metadata_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_metadata_reviewer());

-- metadata_import_batches
DROP POLICY IF EXISTS "admins_manage_metadata_import_batches" ON public.metadata_import_batches;
CREATE POLICY "admins_manage_metadata_import_batches" ON public.metadata_import_batches
  FOR ALL TO authenticated
  USING (public.is_metadata_admin())
  WITH CHECK (public.is_metadata_admin());

DROP POLICY IF EXISTS "reviewers_read_metadata_import_batches" ON public.metadata_import_batches;
CREATE POLICY "reviewers_read_metadata_import_batches" ON public.metadata_import_batches
  FOR SELECT TO authenticated USING (public.is_metadata_reviewer());

-- metadata_bulk_actions
DROP POLICY IF EXISTS "reviewers_manage_metadata_bulk_actions" ON public.metadata_bulk_actions;
CREATE POLICY "reviewers_manage_metadata_bulk_actions" ON public.metadata_bulk_actions
  FOR ALL TO authenticated
  USING (public.is_metadata_reviewer())
  WITH CHECK (public.is_metadata_reviewer());

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_metadata_suggestions_updated_at ON public.metadata_suggestions;
CREATE TRIGGER trg_metadata_suggestions_updated_at
  BEFORE UPDATE ON public.metadata_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_metadata_updated_at();

DROP TRIGGER IF EXISTS trg_asset_metadata_reviews_updated_at ON public.asset_metadata_reviews;
CREATE TRIGGER trg_asset_metadata_reviews_updated_at
  BEFORE UPDATE ON public.asset_metadata_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_metadata_updated_at();

DROP TRIGGER IF EXISTS trg_metadata_synonyms_updated_at ON public.metadata_synonyms;
CREATE TRIGGER trg_metadata_synonyms_updated_at
  BEFORE UPDATE ON public.metadata_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.update_metadata_updated_at();

DROP TRIGGER IF EXISTS trg_metadata_keywords_updated_at ON public.metadata_keywords;
CREATE TRIGGER trg_metadata_keywords_updated_at
  BEFORE UPDATE ON public.metadata_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_metadata_updated_at();

DROP TRIGGER IF EXISTS trg_species_reviews_updated_at ON public.species_reviews;
CREATE TRIGGER trg_species_reviews_updated_at
  BEFORE UPDATE ON public.species_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_metadata_updated_at();
