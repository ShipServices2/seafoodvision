-- ============================================================
-- SEAFOOD VISION — PHASE 7: SPECIES ENCYCLOPEDIA EXTENDED FIELDS
-- Adds all encyclopedia fields to the species table
-- Safe to run multiple times (idempotent)
-- ============================================================

-- 1. Add extended encyclopedia fields to species table
ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS order_name TEXT,
  ADD COLUMN IF NOT EXISTS habitat TEXT,
  ADD COLUMN IF NOT EXISTS habitat_depth TEXT,
  ADD COLUMN IF NOT EXISTS world_distribution TEXT,
  ADD COLUMN IF NOT EXISTS fishing_methods TEXT[],
  ADD COLUMN IF NOT EXISTS aquaculture_methods TEXT[],
  ADD COLUMN IF NOT EXISTS seasonality JSONB,
  ADD COLUMN IF NOT EXISTS size_info JSONB,
  ADD COLUMN IF NOT EXISTS nutritional_values JSONB,
  ADD COLUMN IF NOT EXISTS possible_certifications TEXT[],
  ADD COLUMN IF NOT EXISTS commercial_forms TEXT[],
  ADD COLUMN IF NOT EXISTS presentations TEXT[],
  ADD COLUMN IF NOT EXISTS packaging_notes TEXT,
  ADD COLUMN IF NOT EXISTS conservation_methods TEXT[],
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- 2. Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_species_common_name ON public.species USING gin(to_tsvector('english', common_name));
CREATE INDEX IF NOT EXISTS idx_species_scientific_name ON public.species USING gin(to_tsvector('english', scientific_name));
CREATE INDEX IF NOT EXISTS idx_species_family ON public.species(family);
CREATE INDEX IF NOT EXISTS idx_species_category ON public.species(category);
CREATE INDEX IF NOT EXISTS idx_species_is_public ON public.species(is_public);
CREATE INDEX IF NOT EXISTS idx_species_is_validated ON public.species(is_validated);

-- 3. Add index on species_names for fast synonym/local name search
CREATE INDEX IF NOT EXISTS idx_species_names_name ON public.species_names USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_species_names_species_id ON public.species_names(species_id);
CREATE INDEX IF NOT EXISTS idx_species_names_name_type ON public.species_names(name_type);
CREATE INDEX IF NOT EXISTS idx_species_names_language_code ON public.species_names(language_code);

-- 4. Create a species_duplicates table for merge tracking
CREATE TABLE IF NOT EXISTS public.species_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  duplicate_species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  merged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  merged_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_species_duplicates_primary ON public.species_duplicates(primary_species_id);
CREATE INDEX IF NOT EXISTS idx_species_duplicates_duplicate ON public.species_duplicates(duplicate_species_id);

ALTER TABLE public.species_duplicates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "species_duplicates_public_read" ON public.species_duplicates;
CREATE POLICY "species_duplicates_public_read"
  ON public.species_duplicates FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "species_duplicates_admin_write" ON public.species_duplicates;
CREATE POLICY "species_duplicates_admin_write"
  ON public.species_duplicates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('administrator', 'super_admin', 'reviewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('administrator', 'super_admin', 'reviewer')
    )
  );
