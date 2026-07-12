-- ============================================================
-- Seafood Vision — Phase 5.1: Knowledge Graph Foundation
-- Timestamp: 20260712220000
-- Minimal corrective migration — preserves all existing data
-- ============================================================

-- ============================================================
-- SECTION 1: NEW ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.kg_status CASCADE;
CREATE TYPE public.kg_status AS ENUM (
  'draft',
  'suggested',
  'unverified',
  'under_review',
  'verified',
  'rejected',
  'disputed',
  'obsolete',
  'archived'
);

DROP TYPE IF EXISTS public.kg_change_type CASCADE;
CREATE TYPE public.kg_change_type AS ENUM (
  'created',
  'updated',
  'corrected',
  'verified',
  'rejected',
  'disputed',
  'restored',
  'marked_obsolete'
);

DROP TYPE IF EXISTS public.kg_conflict_status CASCADE;
CREATE TYPE public.kg_conflict_status AS ENUM (
  'open',
  'under_review',
  'resolved',
  'accepted_difference',
  'dismissed'
);

DROP TYPE IF EXISTS public.kg_reliability CASCADE;
CREATE TYPE public.kg_reliability AS ENUM (
  'unknown',
  'low',
  'medium',
  'high',
  'authoritative'
);

DROP TYPE IF EXISTS public.kg_confidentiality CASCADE;
CREATE TYPE public.kg_confidentiality AS ENUM (
  'public',
  'restricted',
  'internal',
  'confidential',
  'highly_confidential'
);

-- ============================================================
-- SECTION 2: EXTEND EXISTING TABLES (ADD MISSING COLUMNS)
-- ============================================================

-- Extend species table
ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS genus TEXT,
  ADD COLUMN IF NOT EXISTS fao_alpha3_code TEXT,
  ADD COLUMN IF NOT EXISTS taxonomic_status TEXT,
  ADD COLUMN IF NOT EXISTS validation_status public.kg_status DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS cover_asset_id UUID,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Extend knowledge_entities table
ALTER TABLE public.knowledge_entities
  ADD COLUMN IF NOT EXISTS canonical_name TEXT,
  ADD COLUMN IF NOT EXISTS status public.kg_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Extend knowledge_claims table (add new columns without breaking existing)
ALTER TABLE public.knowledge_claims
  ADD COLUMN IF NOT EXISTS subject_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_entity_id UUID,
  ADD COLUMN IF NOT EXISTS predicate TEXT,
  ADD COLUMN IF NOT EXISTS object_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS object_entity_id UUID,
  ADD COLUMN IF NOT EXISTS value_text TEXT,
  ADD COLUMN IF NOT EXISTS value_number NUMERIC,
  ADD COLUMN IF NOT EXISTS value_unit TEXT,
  ADD COLUMN IF NOT EXISTS language_code TEXT,
  ADD COLUMN IF NOT EXISTS market_id UUID,
  ADD COLUMN IF NOT EXISTS country_id UUID,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status public.kg_status DEFAULT 'suggested',
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Extend knowledge_versions table
ALTER TABLE public.knowledge_versions
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS change_type public.kg_change_type DEFAULT 'updated',
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS previous_version_id UUID;

-- Extend knowledge_relations table
ALTER TABLE public.knowledge_relations
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS target_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS status public.kg_status DEFAULT 'suggested',
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Extend knowledge_sources table (restructure to standalone)
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS author_or_organization TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS publication_date DATE,
  ADD COLUMN IF NOT EXISTS accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confidentiality_level public.kg_confidentiality DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS reliability_level public.kg_reliability DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- ============================================================
-- SECTION 3: NEW CORE TABLES
-- ============================================================

-- Processing methods
CREATE TABLE IF NOT EXISTS public.processing_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status public.kg_status DEFAULT 'verified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preservation methods
CREATE TABLE IF NOT EXISTS public.preservation_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status public.kg_status DEFAULT 'verified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Freezing methods
CREATE TABLE IF NOT EXISTS public.freezing_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status public.kg_status DEFAULT 'verified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Species names (multilingual, multi-market)
CREATE TABLE IF NOT EXISTS public.species_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_type TEXT NOT NULL DEFAULT 'common',
  country_id UUID,
  region TEXT,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  source_id UUID,
  status public.kg_status DEFAULT 'unverified',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commercial products
CREATE TABLE IF NOT EXISTS public.commercial_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  public_name TEXT NOT NULL,
  internal_name TEXT,
  description TEXT,
  product_form_id UUID REFERENCES public.product_forms(id),
  processing_method_id UUID REFERENCES public.processing_methods(id),
  preservation_method_id UUID REFERENCES public.preservation_methods(id),
  freezing_method_id UUID REFERENCES public.freezing_methods(id),
  status public.kg_status DEFAULT 'draft',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commercial product ↔ species (many-to-many)
CREATE TABLE IF NOT EXISTS public.commercial_product_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.commercial_products(id) ON DELETE CASCADE,
  species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  percentage NUMERIC,
  relationship_type TEXT NOT NULL DEFAULT 'primary_species',
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Size grades
CREATE TABLE IF NOT EXISTS public.size_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  measurement_type TEXT,
  minimum_value NUMERIC,
  maximum_value NUMERIC,
  unit TEXT,
  pieces_per_unit_min NUMERIC,
  pieces_per_unit_max NUMERIC,
  market_id UUID,
  species_id UUID REFERENCES public.species(id),
  product_form_id UUID REFERENCES public.product_forms(id),
  status public.kg_status DEFAULT 'unverified',
  source_id UUID,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packaging configurations
CREATE TABLE IF NOT EXISTS public.packaging_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_type_id UUID REFERENCES public.packaging_types(id),
  name TEXT NOT NULL,
  material TEXT,
  net_weight NUMERIC,
  gross_weight NUMERIC,
  weight_unit TEXT DEFAULT 'kg',
  units_per_package INTEGER,
  packages_per_carton INTEGER,
  cartons_per_pallet INTEGER,
  pallet_type TEXT,
  dimensions JSONB,
  labeling_language TEXT,
  status public.kg_status DEFAULT 'unverified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Markets
CREATE TABLE IF NOT EXISTS public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'country',
  country_id UUID REFERENCES public.countries(id),
  region TEXT,
  description TEXT,
  status public.kg_status DEFAULT 'unverified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usages
CREATE TABLE IF NOT EXISTS public.usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status public.kg_status DEFAULT 'verified',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certifications
CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuing_body TEXT,
  certification_type TEXT NOT NULL DEFAULT 'quality',
  description TEXT,
  verification_required BOOLEAN NOT NULL DEFAULT true,
  status public.kg_status DEFAULT 'unverified',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certification claims
CREATE TABLE IF NOT EXISTS public.certification_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  claim_status TEXT NOT NULL DEFAULT 'claimed',
  document_id UUID,
  source_id UUID,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document types
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_title TEXT NOT NULL,
  internal_title TEXT,
  document_type_id UUID REFERENCES public.document_types(id),
  status public.kg_status DEFAULT 'draft',
  confidentiality_level public.kg_confidentiality DEFAULT 'confidential',
  issuing_body TEXT,
  issue_date DATE,
  expiration_date DATE,
  country_id UUID REFERENCES public.countries(id),
  source_id UUID,
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge relation types
CREATE TABLE IF NOT EXISTS public.knowledge_relation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  source_entity_types TEXT[],
  target_entity_types TEXT[],
  is_bidirectional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge claim evidence
CREATE TABLE IF NOT EXISTS public.knowledge_claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.knowledge_claims(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL DEFAULT 'media',
  asset_id UUID REFERENCES public.assets(id),
  document_id UUID REFERENCES public.documents(id),
  source_id UUID,
  note TEXT,
  status public.kg_status DEFAULT 'unverified',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge conflicts
CREATE TABLE IF NOT EXISTS public.knowledge_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT,
  entity_id UUID,
  conflict_type TEXT NOT NULL DEFAULT 'other',
  first_claim_id UUID REFERENCES public.knowledge_claims(id),
  second_claim_id UUID REFERENCES public.knowledge_claims(id),
  status public.kg_conflict_status DEFAULT 'open',
  severity TEXT DEFAULT 'medium',
  assigned_to UUID,
  resolution_note TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 4: JUNCTION / RELATION TABLES
-- ============================================================

-- Asset ↔ products
CREATE TABLE IF NOT EXISTS public.asset_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.commercial_products(id) ON DELETE CASCADE,
  confidence_score NUMERIC DEFAULT 0.5,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset ↔ packaging
CREATE TABLE IF NOT EXISTS public.asset_packaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  packaging_config_id UUID NOT NULL REFERENCES public.packaging_configurations(id) ON DELETE CASCADE,
  confidence_score NUMERIC DEFAULT 0.5,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset ↔ markets
CREATE TABLE IF NOT EXISTS public.asset_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  confidence_score NUMERIC DEFAULT 0.5,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset ↔ documents
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  confidence_score NUMERIC DEFAULT 0.5,
  status public.kg_status DEFAULT 'suggested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset ↔ certification observations
CREATE TABLE IF NOT EXISTS public.asset_certification_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  observation_type TEXT NOT NULL DEFAULT 'visible_on_media',
  confidence_score NUMERIC DEFAULT 0.3,
  status public.kg_status DEFAULT 'suggested',
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product ↔ usages
CREATE TABLE IF NOT EXISTS public.product_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.commercial_products(id) ON DELETE CASCADE,
  usage_id UUID NOT NULL REFERENCES public.usages(id) ON DELETE CASCADE,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product ↔ markets
CREATE TABLE IF NOT EXISTS public.product_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.commercial_products(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Species ↔ markets
CREATE TABLE IF NOT EXISTS public.species_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packaging ↔ markets
CREATE TABLE IF NOT EXISTS public.packaging_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_config_id UUID NOT NULL REFERENCES public.packaging_configurations(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  status public.kg_status DEFAULT 'suggested',
  source_id UUID,
  notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document relations
CREATE TABLE IF NOT EXISTS public.document_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.commercial_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 5: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_species_names_species_id ON public.species_names(species_id);
CREATE INDEX IF NOT EXISTS idx_species_names_language ON public.species_names(language_code);
CREATE INDEX IF NOT EXISTS idx_commercial_products_status ON public.commercial_products(status);
CREATE INDEX IF NOT EXISTS idx_commercial_products_is_demo ON public.commercial_products(is_demo);
CREATE INDEX IF NOT EXISTS idx_commercial_product_species_product ON public.commercial_product_species(product_id);
CREATE INDEX IF NOT EXISTS idx_commercial_product_species_species ON public.commercial_product_species(species_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_slug ON public.markets(slug);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON public.certifications(status);
CREATE INDEX IF NOT EXISTS idx_certification_claims_cert ON public.certification_claims(certification_id);
CREATE INDEX IF NOT EXISTS idx_certification_claims_subject ON public.certification_claims(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_confidentiality ON public.documents(confidentiality_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON public.knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_status ON public.knowledge_entities(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_is_demo ON public.knowledge_entities(is_demo);
CREATE INDEX IF NOT EXISTS idx_knowledge_claims_status ON public.knowledge_claims(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_claims_subject ON public.knowledge_claims(subject_entity_type, subject_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source ON public.knowledge_relations(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_target ON public.knowledge_relations(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_type ON public.knowledge_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_conflicts_status ON public.knowledge_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_entity ON public.knowledge_versions(entity_id);
CREATE INDEX IF NOT EXISTS idx_asset_products_asset ON public.asset_products(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_products_product ON public.asset_products(product_id);
CREATE INDEX IF NOT EXISTS idx_asset_markets_asset ON public.asset_markets(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_packaging_asset ON public.asset_packaging(asset_id);
CREATE INDEX IF NOT EXISTS idx_size_grades_species ON public.size_grades(species_id);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_commercial_products_fts ON public.commercial_products
  USING gin(to_tsvector('english', coalesce(public_name, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_species_names_fts ON public.species_names
  USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_fts ON public.knowledge_entities
  USING gin(to_tsvector('english', coalesce(label, '') || ' ' || coalesce(description, '')));

-- ============================================================
-- SECTION 6: HELPER FUNCTIONS (BEFORE RLS POLICIES)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_reviewer_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('reviewer', 'administrator', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_administrator_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('administrator', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- Versioning function
CREATE OR REPLACE FUNCTION public.kg_record_version(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_snapshot JSONB,
  p_change_type public.kg_change_type,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version_number INTEGER;
  v_prev_id UUID;
  v_new_id UUID;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1, id
  INTO v_version_number, v_prev_id
  FROM public.knowledge_versions
  WHERE entity_id = p_entity_id
  ORDER BY version_number DESC
  LIMIT 1;

  INSERT INTO public.knowledge_versions (
    entity_id, entity_type, version_number, snapshot,
    change_type, change_reason, changed_by, changed_at, previous_version_id
  ) VALUES (
    p_entity_id, p_entity_type, v_version_number, p_snapshot,
    p_change_type, p_change_reason, auth.uid(), NOW(), v_prev_id
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Audit log function
CREATE OR REPLACE FUNCTION public.kg_audit_log(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_payload JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, payload)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_payload);
END;
$$;

-- ============================================================
-- SECTION 7: ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE public.processing_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preservation_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freezing_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_product_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_relation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_certification_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_markets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 8: RLS POLICIES
-- ============================================================

-- Reference tables (public read, reviewer+ write)
DROP POLICY IF EXISTS "public_read_processing_methods" ON public.processing_methods;
CREATE POLICY "public_read_processing_methods" ON public.processing_methods FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "reviewer_write_processing_methods" ON public.processing_methods;
CREATE POLICY "reviewer_write_processing_methods" ON public.processing_methods FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "public_read_preservation_methods" ON public.preservation_methods;
CREATE POLICY "public_read_preservation_methods" ON public.preservation_methods FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "reviewer_write_preservation_methods" ON public.preservation_methods;
CREATE POLICY "reviewer_write_preservation_methods" ON public.preservation_methods FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "public_read_freezing_methods" ON public.freezing_methods;
CREATE POLICY "public_read_freezing_methods" ON public.freezing_methods FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "reviewer_write_freezing_methods" ON public.freezing_methods;
CREATE POLICY "reviewer_write_freezing_methods" ON public.freezing_methods FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "public_read_usages" ON public.usages;
CREATE POLICY "public_read_usages" ON public.usages FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "reviewer_write_usages" ON public.usages;
CREATE POLICY "reviewer_write_usages" ON public.usages FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "public_read_knowledge_relation_types" ON public.knowledge_relation_types;
CREATE POLICY "public_read_knowledge_relation_types" ON public.knowledge_relation_types FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_write_knowledge_relation_types" ON public.knowledge_relation_types;
CREATE POLICY "admin_write_knowledge_relation_types" ON public.knowledge_relation_types FOR ALL TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

DROP POLICY IF EXISTS "public_read_document_types" ON public.document_types;
CREATE POLICY "public_read_document_types" ON public.document_types FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "reviewer_write_document_types" ON public.document_types;
CREATE POLICY "reviewer_write_document_types" ON public.document_types FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Species names
DROP POLICY IF EXISTS "public_read_species_names" ON public.species_names;
CREATE POLICY "public_read_species_names" ON public.species_names FOR SELECT TO public USING (status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_species_names" ON public.species_names;
CREATE POLICY "reviewer_read_all_species_names" ON public.species_names FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_species_names" ON public.species_names;
CREATE POLICY "reviewer_write_species_names" ON public.species_names FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_species_names" ON public.species_names;
CREATE POLICY "admin_update_species_names" ON public.species_names FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Commercial products
DROP POLICY IF EXISTS "public_read_commercial_products" ON public.commercial_products;
CREATE POLICY "public_read_commercial_products" ON public.commercial_products FOR SELECT TO public USING (is_public = true AND status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_commercial_products" ON public.commercial_products;
CREATE POLICY "reviewer_read_all_commercial_products" ON public.commercial_products FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_commercial_products" ON public.commercial_products;
CREATE POLICY "reviewer_write_commercial_products" ON public.commercial_products FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_commercial_products" ON public.commercial_products;
CREATE POLICY "admin_update_commercial_products" ON public.commercial_products FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Commercial product species
DROP POLICY IF EXISTS "reviewer_read_commercial_product_species" ON public.commercial_product_species;
CREATE POLICY "reviewer_read_commercial_product_species" ON public.commercial_product_species FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_commercial_product_species" ON public.commercial_product_species;
CREATE POLICY "reviewer_write_commercial_product_species" ON public.commercial_product_species FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_commercial_product_species" ON public.commercial_product_species;
CREATE POLICY "admin_update_commercial_product_species" ON public.commercial_product_species FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Size grades
DROP POLICY IF EXISTS "public_read_size_grades" ON public.size_grades;
CREATE POLICY "public_read_size_grades" ON public.size_grades FOR SELECT TO public USING (status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_size_grades" ON public.size_grades;
CREATE POLICY "reviewer_read_all_size_grades" ON public.size_grades FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_size_grades" ON public.size_grades;
CREATE POLICY "reviewer_write_size_grades" ON public.size_grades FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Packaging configurations
DROP POLICY IF EXISTS "public_read_packaging_configurations" ON public.packaging_configurations;
CREATE POLICY "public_read_packaging_configurations" ON public.packaging_configurations FOR SELECT TO public USING (status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_packaging_configurations" ON public.packaging_configurations;
CREATE POLICY "reviewer_read_all_packaging_configurations" ON public.packaging_configurations FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_packaging_configurations" ON public.packaging_configurations;
CREATE POLICY "reviewer_write_packaging_configurations" ON public.packaging_configurations FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Markets
DROP POLICY IF EXISTS "public_read_markets" ON public.markets;
CREATE POLICY "public_read_markets" ON public.markets FOR SELECT TO public USING (is_public = true AND status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_markets" ON public.markets;
CREATE POLICY "reviewer_read_all_markets" ON public.markets FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_markets" ON public.markets;
CREATE POLICY "reviewer_write_markets" ON public.markets FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_markets" ON public.markets;
CREATE POLICY "admin_update_markets" ON public.markets FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Certifications
DROP POLICY IF EXISTS "public_read_certifications" ON public.certifications;
CREATE POLICY "public_read_certifications" ON public.certifications FOR SELECT TO public USING (is_public = true AND status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_certifications" ON public.certifications;
CREATE POLICY "reviewer_read_all_certifications" ON public.certifications FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_certifications" ON public.certifications;
CREATE POLICY "reviewer_write_certifications" ON public.certifications FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Certification claims
DROP POLICY IF EXISTS "reviewer_read_certification_claims" ON public.certification_claims;
CREATE POLICY "reviewer_read_certification_claims" ON public.certification_claims FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_certification_claims" ON public.certification_claims;
CREATE POLICY "reviewer_write_certification_claims" ON public.certification_claims FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_certification_claims" ON public.certification_claims;
CREATE POLICY "admin_update_certification_claims" ON public.certification_claims FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Documents (private by default)
DROP POLICY IF EXISTS "reviewer_read_documents" ON public.documents;
CREATE POLICY "reviewer_read_documents" ON public.documents FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_documents" ON public.documents;
CREATE POLICY "reviewer_write_documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_documents" ON public.documents;
CREATE POLICY "admin_update_documents" ON public.documents FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Knowledge entities
DROP POLICY IF EXISTS "public_read_knowledge_entities" ON public.knowledge_entities;
CREATE POLICY "public_read_knowledge_entities" ON public.knowledge_entities FOR SELECT TO public USING (is_public = true AND status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_knowledge_entities" ON public.knowledge_entities;
CREATE POLICY "reviewer_read_all_knowledge_entities" ON public.knowledge_entities FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_entities" ON public.knowledge_entities;
CREATE POLICY "reviewer_write_knowledge_entities" ON public.knowledge_entities FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_knowledge_entities" ON public.knowledge_entities;
CREATE POLICY "admin_update_knowledge_entities" ON public.knowledge_entities FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Knowledge relations
DROP POLICY IF EXISTS "public_read_knowledge_relations" ON public.knowledge_relations;
CREATE POLICY "public_read_knowledge_relations" ON public.knowledge_relations FOR SELECT TO public USING (status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_knowledge_relations" ON public.knowledge_relations;
CREATE POLICY "reviewer_read_all_knowledge_relations" ON public.knowledge_relations FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_relations" ON public.knowledge_relations;
CREATE POLICY "reviewer_write_knowledge_relations" ON public.knowledge_relations FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_knowledge_relations" ON public.knowledge_relations;
CREATE POLICY "admin_update_knowledge_relations" ON public.knowledge_relations FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Knowledge claims
DROP POLICY IF EXISTS "public_read_knowledge_claims" ON public.knowledge_claims;
CREATE POLICY "public_read_knowledge_claims" ON public.knowledge_claims FOR SELECT TO public USING (status = 'verified');
DROP POLICY IF EXISTS "reviewer_read_all_knowledge_claims" ON public.knowledge_claims;
CREATE POLICY "reviewer_read_all_knowledge_claims" ON public.knowledge_claims FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_claims" ON public.knowledge_claims;
CREATE POLICY "reviewer_write_knowledge_claims" ON public.knowledge_claims FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_knowledge_claims" ON public.knowledge_claims;
CREATE POLICY "admin_update_knowledge_claims" ON public.knowledge_claims FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Knowledge sources
DROP POLICY IF EXISTS "reviewer_read_knowledge_sources" ON public.knowledge_sources;
CREATE POLICY "reviewer_read_knowledge_sources" ON public.knowledge_sources FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_sources" ON public.knowledge_sources;
CREATE POLICY "reviewer_write_knowledge_sources" ON public.knowledge_sources FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Knowledge versions
DROP POLICY IF EXISTS "reviewer_read_knowledge_versions" ON public.knowledge_versions;
CREATE POLICY "reviewer_read_knowledge_versions" ON public.knowledge_versions FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "system_write_knowledge_versions" ON public.knowledge_versions;
CREATE POLICY "system_write_knowledge_versions" ON public.knowledge_versions FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());

-- Knowledge claim evidence
DROP POLICY IF EXISTS "reviewer_read_knowledge_claim_evidence" ON public.knowledge_claim_evidence;
CREATE POLICY "reviewer_read_knowledge_claim_evidence" ON public.knowledge_claim_evidence FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_claim_evidence" ON public.knowledge_claim_evidence;
CREATE POLICY "reviewer_write_knowledge_claim_evidence" ON public.knowledge_claim_evidence FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- Knowledge conflicts
DROP POLICY IF EXISTS "reviewer_read_knowledge_conflicts" ON public.knowledge_conflicts;
CREATE POLICY "reviewer_read_knowledge_conflicts" ON public.knowledge_conflicts FOR SELECT TO authenticated USING (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "reviewer_write_knowledge_conflicts" ON public.knowledge_conflicts;
CREATE POLICY "reviewer_write_knowledge_conflicts" ON public.knowledge_conflicts FOR INSERT TO authenticated WITH CHECK (public.is_reviewer_or_above());
DROP POLICY IF EXISTS "admin_update_knowledge_conflicts" ON public.knowledge_conflicts;
CREATE POLICY "admin_update_knowledge_conflicts" ON public.knowledge_conflicts FOR UPDATE TO authenticated USING (public.is_administrator_or_above()) WITH CHECK (public.is_administrator_or_above());

-- Asset relation tables (reviewer+)
DROP POLICY IF EXISTS "reviewer_manage_asset_products" ON public.asset_products;
CREATE POLICY "reviewer_manage_asset_products" ON public.asset_products FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_asset_packaging" ON public.asset_packaging;
CREATE POLICY "reviewer_manage_asset_packaging" ON public.asset_packaging FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_asset_markets" ON public.asset_markets;
CREATE POLICY "reviewer_manage_asset_markets" ON public.asset_markets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_asset_documents" ON public.asset_documents;
CREATE POLICY "reviewer_manage_asset_documents" ON public.asset_documents FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_asset_certification_observations" ON public.asset_certification_observations;
CREATE POLICY "reviewer_manage_asset_certification_observations" ON public.asset_certification_observations FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_product_usages" ON public.product_usages;
CREATE POLICY "reviewer_manage_product_usages" ON public.product_usages FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_product_markets" ON public.product_markets;
CREATE POLICY "reviewer_manage_product_markets" ON public.product_markets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_species_markets" ON public.species_markets;
CREATE POLICY "reviewer_manage_species_markets" ON public.species_markets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_packaging_markets" ON public.packaging_markets;
CREATE POLICY "reviewer_manage_packaging_markets" ON public.packaging_markets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_document_assets" ON public.document_assets;
CREATE POLICY "reviewer_manage_document_assets" ON public.document_assets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_document_species" ON public.document_species;
CREATE POLICY "reviewer_manage_document_species" ON public.document_species FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_document_products" ON public.document_products;
CREATE POLICY "reviewer_manage_document_products" ON public.document_products FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "reviewer_manage_document_markets" ON public.document_markets;
CREATE POLICY "reviewer_manage_document_markets" ON public.document_markets FOR ALL TO authenticated USING (public.is_reviewer_or_above()) WITH CHECK (public.is_reviewer_or_above());

-- ============================================================
-- SECTION 9: TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.kg_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_products_updated_at ON public.commercial_products;
CREATE TRIGGER trg_commercial_products_updated_at
  BEFORE UPDATE ON public.commercial_products
  FOR EACH ROW EXECUTE FUNCTION public.kg_update_updated_at();

DROP TRIGGER IF EXISTS trg_markets_updated_at ON public.markets;
CREATE TRIGGER trg_markets_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.kg_update_updated_at();

DROP TRIGGER IF EXISTS trg_certifications_updated_at ON public.certifications;
CREATE TRIGGER trg_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.kg_update_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.kg_update_updated_at();

DROP TRIGGER IF EXISTS trg_packaging_configurations_updated_at ON public.packaging_configurations;
CREATE TRIGGER trg_packaging_configurations_updated_at
  BEFORE UPDATE ON public.packaging_configurations
  FOR EACH ROW EXECUTE FUNCTION public.kg_update_updated_at();

-- ============================================================
-- SECTION 10: DEMO DATA (is_demo = true)
-- ============================================================

DO $$
DECLARE
  v_species_ids UUID[] := ARRAY[]::UUID[];
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_market_ids UUID[] := ARRAY[]::UUID[];
  v_cert_ids UUID[] := ARRAY[]::UUID[];
  v_doctype_ids UUID[] := ARRAY[]::UUID[];
  v_pf_id UUID;
  v_pm_id UUID;
  v_prm_id UUID;
  v_fm_id UUID;
  v_pkg_id UUID;
  v_src_id UUID;
  v_entity_id UUID;
  v_claim_id UUID;
  s1 UUID; s2 UUID; s3 UUID; s4 UUID; s5 UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID; p5 UUID; p6 UUID; p7 UUID; p8 UUID; p9 UUID; p10 UUID;
  m1 UUID; m2 UUID; m3 UUID;
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID;
  d1 UUID; d2 UUID; d3 UUID; d4 UUID; d5 UUID;
  pkg1 UUID; pkg2 UUID; pkg3 UUID; pkg4 UUID; pkg5 UUID;
BEGIN

  -- Reference methods
  INSERT INTO public.processing_methods (slug, label, status) VALUES
    ('whole', 'Whole', 'verified'),
    ('whole-gutted', 'Whole Gutted (WG)', 'verified'),
    ('hg', 'Headed & Gutted (HG)', 'verified'),
    ('hgt', 'Headed, Gutted & Tailed (HGT)', 'verified'),
    ('fillet', 'Fillet', 'verified'),
    ('skinless-fillet', 'Skinless Fillet', 'verified'),
    ('steak', 'Steak', 'verified'),
    ('portion', 'Portion', 'verified'),
    ('minced', 'Minced', 'verified'),
    ('other', 'Other', 'verified')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.preservation_methods (slug, label, status) VALUES
    ('fresh', 'Fresh', 'verified'),
    ('chilled', 'Chilled', 'verified'),
    ('frozen', 'Frozen', 'verified'),
    ('cooked', 'Cooked', 'verified'),
    ('smoked', 'Smoked', 'verified'),
    ('dried', 'Dried', 'verified'),
    ('salted', 'Salted', 'verified'),
    ('canned', 'Canned', 'verified'),
    ('marinated', 'Marinated', 'verified'),
    ('breaded', 'Breaded', 'verified')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.freezing_methods (slug, label, status) VALUES
    ('iqf', 'IQF (Individually Quick Frozen)', 'verified'),
    ('block-frozen', 'Block Frozen', 'verified'),
    ('interleaved', 'Interleaved', 'verified'),
    ('plate-frozen', 'Plate Frozen', 'verified'),
    ('blast-frozen', 'Blast Frozen', 'verified'),
    ('brine-frozen', 'Brine Frozen', 'verified'),
    ('unknown', 'Unknown', 'verified')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.usages (slug, label) VALUES
    ('retail', 'Retail'),
    ('horeca', 'HoReCa'),
    ('wholesale', 'Wholesale'),
    ('processing', 'Processing'),
    ('canning', 'Canning'),
    ('smoking', 'Smoking'),
    ('training', 'Training'),
    ('editorial', 'Editorial'),
    ('marketing', 'Marketing'),
    ('scientific-documentation', 'Scientific Documentation')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.document_types (slug, label, is_demo) VALUES
    ('technical-sheet', 'Technical Sheet', true),
    ('health-certificate', 'Health Certificate', true),
    ('catch-certificate', 'Catch Certificate', true),
    ('halal-certificate', 'Halal Certificate', true),
    ('sustainability-certificate', 'Sustainability Certificate', true)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO d1 FROM public.document_types WHERE slug = 'technical-sheet' LIMIT 1;
  SELECT id INTO d2 FROM public.document_types WHERE slug = 'health-certificate' LIMIT 1;
  SELECT id INTO d3 FROM public.document_types WHERE slug = 'catch-certificate' LIMIT 1;
  SELECT id INTO d4 FROM public.document_types WHERE slug = 'halal-certificate' LIMIT 1;
  SELECT id INTO d5 FROM public.document_types WHERE slug = 'sustainability-certificate' LIMIT 1;

  -- Demo species (5)
  s1 := gen_random_uuid(); s2 := gen_random_uuid(); s3 := gen_random_uuid();
  s4 := gen_random_uuid(); s5 := gen_random_uuid();

  INSERT INTO public.species (id, slug, common_name, scientific_name, family, is_demo, is_validated, validation_status, is_public) VALUES
    (s1, 'demo-atlantic-salmon', 'Atlantic Salmon', 'Salmo salar', 'Salmonidae', true, false, 'unverified', true),
    (s2, 'demo-yellowfin-tuna', 'Yellowfin Tuna', 'Thunnus albacares', 'Scombridae', true, false, 'unverified', true),
    (s3, 'demo-european-seabass', 'European Seabass', 'Dicentrarchus labrax', 'Moronidae', true, false, 'unverified', true),
    (s4, 'demo-tiger-shrimp', 'Tiger Shrimp', 'Penaeus monodon', 'Penaeidae', true, false, 'unverified', true),
    (s5, 'demo-common-squid', 'Common Squid', 'Loligo vulgaris', 'Loliginidae', true, false, 'unverified', true)
  ON CONFLICT (slug) DO NOTHING;

  -- Demo markets (3)
  m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();

  INSERT INTO public.markets (id, slug, name, market_type, is_demo, status) VALUES
    (m1, 'demo-eu-retail', 'EU Retail Market', 'retail', true, 'unverified'),
    (m2, 'demo-asia-wholesale', 'Asia Wholesale Market', 'wholesale', true, 'unverified'),
    (m3, 'demo-us-foodservice', 'US Foodservice Market', 'foodservice', true, 'unverified')
  ON CONFLICT (slug) DO NOTHING;

  -- Demo certifications (5)
  c1 := gen_random_uuid(); c2 := gen_random_uuid(); c3 := gen_random_uuid();
  c4 := gen_random_uuid(); c5 := gen_random_uuid();

  INSERT INTO public.certifications (id, slug, name, certification_type, is_demo, status) VALUES
    (c1, 'demo-msc', 'MSC (Marine Stewardship Council)', 'sustainability', true, 'unverified'),
    (c2, 'demo-asc', 'ASC (Aquaculture Stewardship Council)', 'sustainability', true, 'unverified'),
    (c3, 'demo-halal', 'Halal Certification', 'religious', true, 'unverified'),
    (c4, 'demo-brc', 'BRC Global Standard', 'food_safety', true, 'unverified'),
    (c5, 'demo-ifs', 'IFS Food Standard', 'food_safety', true, 'unverified')
  ON CONFLICT (slug) DO NOTHING;

  -- Demo packaging configurations (5)
  pkg1 := gen_random_uuid(); pkg2 := gen_random_uuid(); pkg3 := gen_random_uuid();
  pkg4 := gen_random_uuid(); pkg5 := gen_random_uuid();

  INSERT INTO public.packaging_configurations (id, name, net_weight, weight_unit, units_per_package, packages_per_carton, is_demo, status) VALUES
    (pkg1, 'Demo Carton 10kg IQF', 10, 'kg', 1, 1, true, 'unverified'),
    (pkg2, 'Demo Carton 20kg Block', 20, 'kg', 1, 1, true, 'unverified'),
    (pkg3, 'Demo Retail Tray 400g', 0.4, 'kg', 1, 12, true, 'unverified'),
    (pkg4, 'Demo Vacuum Pack 1kg', 1, 'kg', 1, 10, true, 'unverified'),
    (pkg5, 'Demo Bulk Bag 25kg', 25, 'kg', 1, 1, true, 'unverified')
  ON CONFLICT (id) DO NOTHING;

  -- Demo commercial products (10)
  SELECT id INTO v_pf_id FROM public.product_forms LIMIT 1;
  SELECT id INTO v_pm_id FROM public.processing_methods WHERE slug = 'fillet' LIMIT 1;
  SELECT id INTO v_prm_id FROM public.preservation_methods WHERE slug = 'frozen' LIMIT 1;
  SELECT id INTO v_fm_id FROM public.freezing_methods WHERE slug = 'iqf' LIMIT 1;

  p1 := gen_random_uuid(); p2 := gen_random_uuid(); p3 := gen_random_uuid();
  p4 := gen_random_uuid(); p5 := gen_random_uuid(); p6 := gen_random_uuid();
  p7 := gen_random_uuid(); p8 := gen_random_uuid(); p9 := gen_random_uuid();
  p10 := gen_random_uuid();

  INSERT INTO public.commercial_products (id, slug, public_name, processing_method_id, preservation_method_id, freezing_method_id, is_demo, status) VALUES
    (p1, 'demo-salmon-fillet-iqf', 'Salmon Fillet IQF Frozen', v_pm_id, v_prm_id, v_fm_id, true, 'unverified'),
    (p2, 'demo-salmon-whole-fresh', 'Whole Atlantic Salmon Fresh', NULL, (SELECT id FROM public.preservation_methods WHERE slug='fresh' LIMIT 1), NULL, true, 'unverified'),
    (p3, 'demo-tuna-loin-frozen', 'Yellowfin Tuna Loin Frozen', NULL, v_prm_id, (SELECT id FROM public.freezing_methods WHERE slug='block-frozen' LIMIT 1), true, 'unverified'),
    (p4, 'demo-seabass-whole-gutted', 'European Seabass Whole Gutted', (SELECT id FROM public.processing_methods WHERE slug='whole-gutted' LIMIT 1), (SELECT id FROM public.preservation_methods WHERE slug='chilled' LIMIT 1), NULL, true, 'unverified'),
    (p5, 'demo-tiger-shrimp-iqf', 'Tiger Shrimp IQF HLSO', NULL, v_prm_id, v_fm_id, true, 'unverified'),
    (p6, 'demo-squid-ring-frozen', 'Squid Ring Frozen', NULL, v_prm_id, v_fm_id, true, 'unverified'),
    (p7, 'demo-salmon-smoked', 'Smoked Atlantic Salmon Sliced', NULL, (SELECT id FROM public.preservation_methods WHERE slug='smoked' LIMIT 1), NULL, true, 'unverified'),
    (p8, 'demo-tuna-canned', 'Canned Yellowfin Tuna in Brine', NULL, (SELECT id FROM public.preservation_methods WHERE slug='canned' LIMIT 1), NULL, true, 'unverified'),
    (p9, 'demo-shrimp-cooked-frozen', 'Cooked Tiger Shrimp Frozen', NULL, (SELECT id FROM public.preservation_methods WHERE slug='cooked' LIMIT 1), v_fm_id, true, 'unverified'),
    (p10, 'demo-squid-tube-frozen', 'Squid Tube Frozen', NULL, v_prm_id, v_fm_id, true, 'unverified')
  ON CONFLICT (slug) DO NOTHING;

  -- Link products to species
  INSERT INTO public.commercial_product_species (product_id, species_id, relationship_type, status) VALUES
    (p1, s1, 'primary_species', 'suggested'),
    (p2, s1, 'primary_species', 'suggested'),
    (p3, s2, 'primary_species', 'suggested'),
    (p4, s3, 'primary_species', 'suggested'),
    (p5, s4, 'primary_species', 'suggested'),
    (p6, s5, 'primary_species', 'suggested'),
    (p7, s1, 'primary_species', 'suggested'),
    (p8, s2, 'primary_species', 'suggested'),
    (p9, s4, 'primary_species', 'suggested'),
    (p10, s5, 'primary_species', 'suggested')
  ON CONFLICT (id) DO NOTHING;

  -- Demo knowledge source
  v_src_id := gen_random_uuid();
  INSERT INTO public.knowledge_sources (id, source_type, title, reliability_level, confidentiality_level, created_at)
  VALUES (v_src_id, 'internal_experience', 'Demo Internal Reference', 'medium', 'internal', NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Demo knowledge entities (5 — one per species)
  INSERT INTO public.knowledge_entities (entity_type, label, slug, description, is_demo, status, is_public) VALUES
    ('species', 'Atlantic Salmon', 'kg-demo-atlantic-salmon', 'Demo entity for Atlantic Salmon (Salmo salar)', true, 'unverified', false),
    ('species', 'Yellowfin Tuna', 'kg-demo-yellowfin-tuna', 'Demo entity for Yellowfin Tuna (Thunnus albacares)', true, 'unverified', false),
    ('market', 'EU Retail Market', 'kg-demo-eu-retail', 'Demo entity for EU retail market segment', true, 'unverified', false),
    ('certification', 'MSC Certification', 'kg-demo-msc-cert', 'Demo entity for MSC sustainability certification', true, 'unverified', false),
    ('product', 'Salmon Fillet IQF', 'kg-demo-salmon-fillet', 'Demo entity for IQF frozen salmon fillet product', true, 'unverified', false)
  ON CONFLICT (slug) DO NOTHING;

  -- Demo knowledge claims (20)
  FOR v_entity_id IN SELECT id FROM public.knowledge_entities WHERE is_demo = true LIMIT 5 LOOP
    v_claim_id := gen_random_uuid();
    INSERT INTO public.knowledge_claims (id, entity_id, claim_text, claim_status, confidence_score, subject_entity_type, predicate, value_text, status, source_id, created_at)
    VALUES (
      v_claim_id,
      v_entity_id,
      'Demo claim: entity has been identified from internal reference data',
      'proposed',
      0.5,
      'knowledge_entity',
      'identified_from',
      'internal_reference',
      'suggested',
      v_src_id,
      NOW()
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Demo relations (30 — linking entities)
  INSERT INTO public.knowledge_relations (from_entity_id, to_entity_id, relation_type, weight, status, confidence_score, source_id, created_at)
  SELECT
    e1.id,
    e2.id,
    'entity_similar_to_entity',
    0.5,
    'suggested',
    0.4,
    v_src_id,
    NOW()
  FROM public.knowledge_entities e1
  CROSS JOIN public.knowledge_entities e2
  WHERE e1.is_demo = true AND e2.is_demo = true AND e1.id != e2.id
  LIMIT 20
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo data insertion encountered an issue: %', SQLERRM;
END $$;

-- ============================================================
-- SECTION 11: CLEANUP FUNCTION FOR DEMO DATA
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_kg_demo_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.knowledge_relations WHERE source_id IN (SELECT id FROM public.knowledge_sources WHERE title = 'Demo Internal Reference');
  DELETE FROM public.knowledge_claims WHERE source_id IN (SELECT id FROM public.knowledge_sources WHERE title = 'Demo Internal Reference');
  DELETE FROM public.knowledge_entities WHERE is_demo = true;
  DELETE FROM public.commercial_product_species WHERE product_id IN (SELECT id FROM public.commercial_products WHERE is_demo = true);
  DELETE FROM public.commercial_products WHERE is_demo = true;
  DELETE FROM public.packaging_configurations WHERE is_demo = true;
  DELETE FROM public.certifications WHERE is_demo = true;
  DELETE FROM public.markets WHERE is_demo = true;
  DELETE FROM public.document_types WHERE is_demo = true;
  DELETE FROM public.species WHERE is_demo = true AND slug LIKE 'demo-%';
  DELETE FROM public.knowledge_sources WHERE title = 'Demo Internal Reference';
  RAISE NOTICE 'KG demo data deleted successfully';
END;
$$;
