-- ============================================================
-- Seafood Vision — Full Schema Migration
-- Timestamp: 20260712140000
-- Covers: Auth, Catalogue, Collections, Admin, Knowledge Engine,
--         Import Pipeline, B2B, Commercial (future), Identification (future)
-- ============================================================

-- ============================================================
-- SECTION 1: ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM (
  'visitor',
  'member',
  'customer',
  'reviewer',
  'administrator',
  'super_admin'
);

DROP TYPE IF EXISTS public.asset_review_status CASCADE;
CREATE TYPE public.asset_review_status AS ENUM (
  'draft',
  'imported',
  'under_review',
  'approved',
  'preview_only',
  'editorial',
  'commercial',
  'restricted',
  'rejected',
  'archived'
);

DROP TYPE IF EXISTS public.asset_media_type CASCADE;
CREATE TYPE public.asset_media_type AS ENUM (
  'photo',
  'video',
  'document',
  'illustration'
);

DROP TYPE IF EXISTS public.file_level CASCADE;
CREATE TYPE public.file_level AS ENUM (
  'original',
  'preview',
  'thumbnail'
);

DROP TYPE IF EXISTS public.license_type CASCADE;
CREATE TYPE public.license_type AS ENUM (
  'web',
  'editorial',
  'commercial',
  'extended',
  'enterprise'
);

DROP TYPE IF EXISTS public.subscription_status CASCADE;
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'cancelled',
  'expired',
  'trial',
  'paused'
);

DROP TYPE IF EXISTS public.review_task_status CASCADE;
CREATE TYPE public.review_task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'rejected'
);

DROP TYPE IF EXISTS public.import_batch_status CASCADE;
CREATE TYPE public.import_batch_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'partial'
);

DROP TYPE IF EXISTS public.knowledge_claim_status CASCADE;
CREATE TYPE public.knowledge_claim_status AS ENUM (
  'proposed',
  'verified',
  'disputed',
  'deprecated'
);

-- ============================================================
-- SECTION 2: CORE TABLES (no foreign keys)
-- ============================================================

-- User profiles (extends auth.users via trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  company TEXT,
  country TEXT,
  role public.user_role NOT NULL DEFAULT 'member',
  terms_accepted_at TIMESTAMPTZ,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company profiles (B2B)
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  country TEXT,
  vat_number TEXT,
  website TEXT,
  industry TEXT,
  size_range TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories (managed list)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Species reference
CREATE TABLE IF NOT EXISTS public.species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  family TEXT,
  category TEXT,
  fao_areas TEXT[],
  description TEXT,
  multilingual_names JSONB,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product forms
CREATE TABLE IF NOT EXISTS public.product_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  category_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packaging types
CREATE TABLE IF NOT EXISTS public.packaging_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Countries (ISO reference)
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code CHAR(2) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FAO areas (reference)
CREATE TABLE IF NOT EXISTS public.fao_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keywords
CREATE TABLE IF NOT EXISTS public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: CATALOGUE TABLES
-- ============================================================

-- Main assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_asset_id TEXT UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  media_type public.asset_media_type NOT NULL DEFAULT 'photo',
  category TEXT,
  species_id UUID,
  product_form TEXT,
  product_state TEXT,
  freezing_method TEXT,
  packaging TEXT,
  country TEXT,
  fao_area TEXT,
  orientation TEXT,
  width_px INTEGER,
  height_px INTEGER,
  file_format TEXT,
  file_size_bytes BIGINT,
  color_space TEXT,
  capture_period TEXT,
  license_type TEXT,
  commercial_use BOOLEAN NOT NULL DEFAULT false,
  editorial_use BOOLEAN NOT NULL DEFAULT false,
  rights_info TEXT,
  restrictions TEXT,
  is_real_photo BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  review_status public.asset_review_status NOT NULL DEFAULT 'under_review',
  publication_status TEXT NOT NULL DEFAULT 'draft',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset file storage references (never expose paths publicly)
CREATE TABLE IF NOT EXISTS public.asset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  file_level public.file_level NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  width_px INTEGER,
  height_px INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset previews (watermarked, controlled access)
CREATE TABLE IF NOT EXISTS public.asset_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL UNIQUE,
  storage_bucket TEXT NOT NULL DEFAULT 'asset-previews',
  storage_path TEXT NOT NULL,
  watermark_applied BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset keywords (junction)
CREATE TABLE IF NOT EXISTS public.asset_keywords (
  asset_id UUID NOT NULL,
  keyword_id UUID NOT NULL,
  PRIMARY KEY (asset_id, keyword_id)
);

-- Asset species (junction — one asset can relate to multiple species)
CREATE TABLE IF NOT EXISTS public.asset_species (
  asset_id UUID NOT NULL,
  species_id UUID NOT NULL,
  PRIMARY KEY (asset_id, species_id)
);

-- ============================================================
-- SECTION 4: USER & COLLECTION TABLES
-- ============================================================

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset_id)
);

-- Collections
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collection items
CREATE TABLE IF NOT EXISTS public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, asset_id)
);

-- ============================================================
-- SECTION 5: COMMERCIAL TABLES (structure only, not activated)
-- ============================================================

-- Pricing plans
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_monthly NUMERIC(10,2),
  download_allowance INTEGER,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'trial',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchase items
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  license_type public.license_type NOT NULL DEFAULT 'web',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Licenses
CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  purchase_id UUID,
  license_type public.license_type NOT NULL DEFAULT 'web',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Downloads
CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  license_id UUID,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 6: ADMINISTRATION TABLES
-- ============================================================

-- Review tasks
CREATE TABLE IF NOT EXISTS public.review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  assigned_to UUID,
  status public.review_task_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Asset status history (append-only audit trail)
CREATE TABLE IF NOT EXISTS public.asset_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  changed_by UUID,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  payload JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 7: IMPORT PIPELINE
-- ============================================================

-- Import batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,
  source_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0,
  status public.import_batch_status NOT NULL DEFAULT 'pending',
  rejection_reasons JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- SECTION 8: KNOWLEDGE ENGINE
-- ============================================================

-- Knowledge entities (species, products, concepts)
CREATE TABLE IF NOT EXISTS public.knowledge_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  label TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge relations (entity → entity)
CREATE TABLE IF NOT EXISTS public.knowledge_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID NOT NULL,
  to_entity_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  weight NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge claims (verifiable facts)
CREATE TABLE IF NOT EXISTS public.knowledge_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  claim_text TEXT NOT NULL,
  claim_status public.knowledge_claim_status NOT NULL DEFAULT 'proposed',
  confidence_score NUMERIC(5,4),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge sources (references for claims)
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  author TEXT,
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge versions (history of entity changes)
CREATE TABLE IF NOT EXISTS public.knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}',
  changed_by UUID,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 9: FUTURE — SEAFOOD IDENTIFICATION (structure only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  image_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.identification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  species_id UUID,
  confidence_score NUMERIC(5,4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 10: FOREIGN KEY CONSTRAINTS
-- ============================================================

ALTER TABLE public.product_forms
  ADD CONSTRAINT fk_product_forms_category
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.assets
  ADD CONSTRAINT fk_assets_species
  FOREIGN KEY (species_id) REFERENCES public.species(id) ON DELETE SET NULL;

ALTER TABLE public.asset_files
  ADD CONSTRAINT fk_asset_files_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.asset_previews
  ADD CONSTRAINT fk_asset_previews_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.asset_keywords
  ADD CONSTRAINT fk_asset_keywords_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.asset_keywords
  ADD CONSTRAINT fk_asset_keywords_keyword
  FOREIGN KEY (keyword_id) REFERENCES public.keywords(id) ON DELETE CASCADE;

ALTER TABLE public.asset_species
  ADD CONSTRAINT fk_asset_species_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.asset_species
  ADD CONSTRAINT fk_asset_species_species
  FOREIGN KEY (species_id) REFERENCES public.species(id) ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT fk_favorites_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.favorites
  ADD CONSTRAINT fk_favorites_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.collections
  ADD CONSTRAINT fk_collections_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.collection_items
  ADD CONSTRAINT fk_collection_items_collection
  FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;

ALTER TABLE public.collection_items
  ADD CONSTRAINT fk_collection_items_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscriptions_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscriptions_plan
  FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE RESTRICT;

ALTER TABLE public.purchases
  ADD CONSTRAINT fk_purchases_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_items
  ADD CONSTRAINT fk_purchase_items_purchase
  FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_items
  ADD CONSTRAINT fk_purchase_items_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.licenses
  ADD CONSTRAINT fk_licenses_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.licenses
  ADD CONSTRAINT fk_licenses_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.licenses
  ADD CONSTRAINT fk_licenses_purchase
  FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;

ALTER TABLE public.downloads
  ADD CONSTRAINT fk_downloads_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.downloads
  ADD CONSTRAINT fk_downloads_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;

ALTER TABLE public.downloads
  ADD CONSTRAINT fk_downloads_license
  FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE SET NULL;

ALTER TABLE public.review_tasks
  ADD CONSTRAINT fk_review_tasks_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.review_tasks
  ADD CONSTRAINT fk_review_tasks_assigned
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.asset_status_history
  ADD CONSTRAINT fk_status_history_asset
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.asset_status_history
  ADD CONSTRAINT fk_status_history_changer
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT fk_audit_logs_actor
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.import_batches
  ADD CONSTRAINT fk_import_batches_creator
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.knowledge_relations
  ADD CONSTRAINT fk_knowledge_relations_from
  FOREIGN KEY (from_entity_id) REFERENCES public.knowledge_entities(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_relations
  ADD CONSTRAINT fk_knowledge_relations_to
  FOREIGN KEY (to_entity_id) REFERENCES public.knowledge_entities(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_claims
  ADD CONSTRAINT fk_knowledge_claims_entity
  FOREIGN KEY (entity_id) REFERENCES public.knowledge_entities(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_claims
  ADD CONSTRAINT fk_knowledge_claims_creator
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT fk_knowledge_sources_claim
  FOREIGN KEY (claim_id) REFERENCES public.knowledge_claims(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_versions
  ADD CONSTRAINT fk_knowledge_versions_entity
  FOREIGN KEY (entity_id) REFERENCES public.knowledge_entities(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_versions
  ADD CONSTRAINT fk_knowledge_versions_changer
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.identification_requests
  ADD CONSTRAINT fk_identification_requests_user
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.identification_results
  ADD CONSTRAINT fk_identification_results_request
  FOREIGN KEY (request_id) REFERENCES public.identification_requests(id) ON DELETE CASCADE;

ALTER TABLE public.identification_results
  ADD CONSTRAINT fk_identification_results_species
  FOREIGN KEY (species_id) REFERENCES public.species(id) ON DELETE SET NULL;

ALTER TABLE public.platform_settings
  ADD CONSTRAINT fk_platform_settings_updater
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 11: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_assets_slug ON public.assets(slug);
CREATE INDEX IF NOT EXISTS idx_assets_review_status ON public.assets(review_status);
CREATE INDEX IF NOT EXISTS idx_assets_is_demo ON public.assets(is_demo);
CREATE INDEX IF NOT EXISTS idx_assets_species_id ON public.assets(species_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_media_type ON public.assets(media_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_files_asset_id ON public.asset_files(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_files_level ON public.asset_files(file_level);

CREATE INDEX IF NOT EXISTS idx_species_slug ON public.species(slug);
CREATE INDEX IF NOT EXISTS idx_species_scientific ON public.species(scientific_name);
CREATE INDEX IF NOT EXISTS idx_species_is_demo ON public.species(is_demo);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_asset_id ON public.favorites(asset_id);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON public.collection_items(collection_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

CREATE INDEX IF NOT EXISTS idx_asset_status_history_asset_id ON public.asset_status_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_tasks_asset_id ON public.review_tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_review_tasks_assigned_to ON public.review_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_slug ON public.knowledge_entities(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON public.knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_claims_entity_id ON public.knowledge_claims(entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_from ON public.knowledge_relations(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_to ON public.knowledge_relations(to_entity_id);

CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON public.import_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_asset_id ON public.downloads(asset_id);

-- ============================================================
-- SECTION 12: FUNCTIONS (must be before RLS policies)
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'member'::public.user_role
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Role check helper (for non-profiles tables only)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Check if current user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
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

-- Check if current user is reviewer or above
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

-- Check if current user is super_admin
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

-- ============================================================
-- SECTION 13: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fao_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 14: RLS POLICIES
-- ============================================================

-- PROFILES: users manage own profile; admins can read all
DROP POLICY IF EXISTS "profiles_own_access" ON public.profiles;
CREATE POLICY "profiles_own_access"
  ON public.profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- COMPANY PROFILES: authenticated users can read; admins manage
DROP POLICY IF EXISTS "company_profiles_authenticated_read" ON public.company_profiles;
CREATE POLICY "company_profiles_authenticated_read"
  ON public.company_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_profiles_admin_manage" ON public.company_profiles;
CREATE POLICY "company_profiles_admin_manage"
  ON public.company_profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ASSETS: public can read approved/commercial/editorial; admins manage all
DROP POLICY IF EXISTS "assets_public_read_approved" ON public.assets;
CREATE POLICY "assets_public_read_approved"
  ON public.assets FOR SELECT
  TO public
  USING (
    review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    AND publication_status != 'archived'
  );

DROP POLICY IF EXISTS "assets_admin_manage" ON public.assets;
CREATE POLICY "assets_admin_manage"
  ON public.assets FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "assets_reviewer_read_all" ON public.assets;
CREATE POLICY "assets_reviewer_read_all"
  ON public.assets FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

-- ASSET FILES: originals never public; previews/thumbnails only for approved assets
DROP POLICY IF EXISTS "asset_files_no_originals_public" ON public.asset_files;
CREATE POLICY "asset_files_no_originals_public"
  ON public.asset_files FOR SELECT
  TO public
  USING (
    file_level != 'original'
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    )
  );

DROP POLICY IF EXISTS "asset_files_admin_manage" ON public.asset_files;
CREATE POLICY "asset_files_admin_manage"
  ON public.asset_files FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ASSET PREVIEWS: public read for approved assets only
DROP POLICY IF EXISTS "asset_previews_public_read" ON public.asset_previews;
CREATE POLICY "asset_previews_public_read"
  ON public.asset_previews FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_previews.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    )
  );

DROP POLICY IF EXISTS "asset_previews_admin_manage" ON public.asset_previews;
CREATE POLICY "asset_previews_admin_manage"
  ON public.asset_previews FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ASSET KEYWORDS & SPECIES: public read
DROP POLICY IF EXISTS "asset_keywords_public_read" ON public.asset_keywords;
CREATE POLICY "asset_keywords_public_read"
  ON public.asset_keywords FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "asset_keywords_admin_manage" ON public.asset_keywords;
CREATE POLICY "asset_keywords_admin_manage"
  ON public.asset_keywords FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "asset_species_public_read" ON public.asset_species;
CREATE POLICY "asset_species_public_read"
  ON public.asset_species FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "asset_species_admin_manage" ON public.asset_species;
CREATE POLICY "asset_species_admin_manage"
  ON public.asset_species FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- REFERENCE TABLES: public read; admin write
DROP POLICY IF EXISTS "species_public_read" ON public.species;
CREATE POLICY "species_public_read"
  ON public.species FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "species_admin_manage" ON public.species;
CREATE POLICY "species_admin_manage"
  ON public.species FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "categories_admin_manage" ON public.categories;
CREATE POLICY "categories_admin_manage"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_forms_public_read" ON public.product_forms;
CREATE POLICY "product_forms_public_read"
  ON public.product_forms FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "product_forms_admin_manage" ON public.product_forms;
CREATE POLICY "product_forms_admin_manage"
  ON public.product_forms FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "packaging_types_public_read" ON public.packaging_types;
CREATE POLICY "packaging_types_public_read"
  ON public.packaging_types FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "packaging_types_admin_manage" ON public.packaging_types;
CREATE POLICY "packaging_types_admin_manage"
  ON public.packaging_types FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "countries_public_read" ON public.countries;
CREATE POLICY "countries_public_read"
  ON public.countries FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "fao_areas_public_read" ON public.fao_areas;
CREATE POLICY "fao_areas_public_read"
  ON public.fao_areas FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "keywords_public_read" ON public.keywords;
CREATE POLICY "keywords_public_read"
  ON public.keywords FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "keywords_admin_manage" ON public.keywords;
CREATE POLICY "keywords_admin_manage"
  ON public.keywords FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- FAVORITES: users manage own
DROP POLICY IF EXISTS "favorites_own_access" ON public.favorites;
CREATE POLICY "favorites_own_access"
  ON public.favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- COLLECTIONS: users manage own; future public sharing via is_private flag
DROP POLICY IF EXISTS "collections_own_access" ON public.collections;
CREATE POLICY "collections_own_access"
  ON public.collections FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collection_items_own_access" ON public.collection_items;
CREATE POLICY "collection_items_own_access"
  ON public.collection_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );

-- COMMERCIAL TABLES: users see own; admins manage all
DROP POLICY IF EXISTS "pricing_plans_public_read" ON public.pricing_plans;
CREATE POLICY "pricing_plans_public_read"
  ON public.pricing_plans FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "pricing_plans_admin_manage" ON public.pricing_plans;
CREATE POLICY "pricing_plans_admin_manage"
  ON public.pricing_plans FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subscriptions_own_access" ON public.subscriptions;
CREATE POLICY "subscriptions_own_access"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "purchases_own_access" ON public.purchases;
CREATE POLICY "purchases_own_access"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "purchase_items_own_access" ON public.purchase_items;
CREATE POLICY "purchase_items_own_access"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "licenses_own_access" ON public.licenses;
CREATE POLICY "licenses_own_access"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "downloads_own_access" ON public.downloads;
CREATE POLICY "downloads_own_access"
  ON public.downloads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ADMIN TABLES: reviewers+ read; admins manage
DROP POLICY IF EXISTS "review_tasks_reviewer_read" ON public.review_tasks;
CREATE POLICY "review_tasks_reviewer_read"
  ON public.review_tasks FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "review_tasks_admin_manage" ON public.review_tasks;
CREATE POLICY "review_tasks_admin_manage"
  ON public.review_tasks FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "asset_status_history_reviewer_read" ON public.asset_status_history;
CREATE POLICY "asset_status_history_reviewer_read"
  ON public.asset_status_history FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "asset_status_history_reviewer_insert" ON public.asset_status_history;
CREATE POLICY "asset_status_history_reviewer_insert"
  ON public.asset_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "audit_logs_super_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_super_admin_read"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_authenticated_insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "platform_settings_admin_manage" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_manage"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- IMPORT BATCHES: admins manage
DROP POLICY IF EXISTS "import_batches_admin_manage" ON public.import_batches;
CREATE POLICY "import_batches_admin_manage"
  ON public.import_batches FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- KNOWLEDGE ENGINE: public read published; admins manage
DROP POLICY IF EXISTS "knowledge_entities_public_read" ON public.knowledge_entities;
CREATE POLICY "knowledge_entities_public_read"
  ON public.knowledge_entities FOR SELECT
  TO public
  USING (is_published = true);

DROP POLICY IF EXISTS "knowledge_entities_admin_manage" ON public.knowledge_entities;
CREATE POLICY "knowledge_entities_admin_manage"
  ON public.knowledge_entities FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "knowledge_relations_public_read" ON public.knowledge_relations;
CREATE POLICY "knowledge_relations_public_read"
  ON public.knowledge_relations FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "knowledge_relations_admin_manage" ON public.knowledge_relations;
CREATE POLICY "knowledge_relations_admin_manage"
  ON public.knowledge_relations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "knowledge_claims_public_read" ON public.knowledge_claims;
CREATE POLICY "knowledge_claims_public_read"
  ON public.knowledge_claims FOR SELECT
  TO public
  USING (claim_status = 'verified');

DROP POLICY IF EXISTS "knowledge_claims_admin_manage" ON public.knowledge_claims;
CREATE POLICY "knowledge_claims_admin_manage"
  ON public.knowledge_claims FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "knowledge_sources_public_read" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources_public_read"
  ON public.knowledge_sources FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "knowledge_sources_admin_manage" ON public.knowledge_sources;
CREATE POLICY "knowledge_sources_admin_manage"
  ON public.knowledge_sources FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "knowledge_versions_admin_read" ON public.knowledge_versions;
CREATE POLICY "knowledge_versions_admin_read"
  ON public.knowledge_versions FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "knowledge_versions_admin_insert" ON public.knowledge_versions;
CREATE POLICY "knowledge_versions_admin_insert"
  ON public.knowledge_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- IDENTIFICATION (future): users manage own
DROP POLICY IF EXISTS "identification_requests_own_access" ON public.identification_requests;
CREATE POLICY "identification_requests_own_access"
  ON public.identification_requests FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "identification_results_own_read" ON public.identification_results;
CREATE POLICY "identification_results_own_read"
  ON public.identification_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.identification_requests ir
      WHERE ir.id = identification_results.request_id
        AND ir.user_id = auth.uid()
    )
  );

-- ============================================================
-- SECTION 15: TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS assets_updated_at ON public.assets;
CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS species_updated_at ON public.species;
CREATE TRIGGER species_updated_at
  BEFORE UPDATE ON public.species
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS collections_updated_at ON public.collections;
CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS knowledge_entities_updated_at ON public.knowledge_entities;
CREATE TRIGGER knowledge_entities_updated_at
  BEFORE UPDATE ON public.knowledge_entities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS knowledge_claims_updated_at ON public.knowledge_claims;
CREATE TRIGGER knowledge_claims_updated_at
  BEFORE UPDATE ON public.knowledge_claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 16: DEMO DATA (is_demo = true, clearly separated)
-- ============================================================

DO $$
DECLARE
  cat_fish_id UUID := gen_random_uuid();
  cat_crustaceans_id UUID := gen_random_uuid();
  cat_cephalopods_id UUID := gen_random_uuid();
  cat_fillets_id UUID := gen_random_uuid();
  cat_frozen_id UUID := gen_random_uuid();
  cat_packaging_id UUID := gen_random_uuid();

  sp_sardine_id UUID := gen_random_uuid();
  sp_mackerel_id UUID := gen_random_uuid();
  sp_tuna_id UUID := gen_random_uuid();
  sp_octopus_id UUID := gen_random_uuid();
  sp_squid_id UUID := gen_random_uuid();
  sp_cuttlefish_id UUID := gen_random_uuid();
  sp_shrimp_id UUID := gen_random_uuid();

  asset_001 UUID := gen_random_uuid();
  asset_002 UUID := gen_random_uuid();
  asset_003 UUID := gen_random_uuid();
  asset_004 UUID := gen_random_uuid();
  asset_005 UUID := gen_random_uuid();
  asset_006 UUID := gen_random_uuid();
  asset_007 UUID := gen_random_uuid();
  asset_008 UUID := gen_random_uuid();
  asset_009 UUID := gen_random_uuid();
  asset_010 UUID := gen_random_uuid();
  asset_011 UUID := gen_random_uuid();
  asset_012 UUID := gen_random_uuid();

  kw_mackerel UUID := gen_random_uuid();
  kw_octopus UUID := gen_random_uuid();
  kw_shrimp UUID := gen_random_uuid();
  kw_tuna UUID := gen_random_uuid();
  kw_sardine UUID := gen_random_uuid();
  kw_squid UUID := gen_random_uuid();
  kw_frozen UUID := gen_random_uuid();
  kw_fresh UUID := gen_random_uuid();
  kw_iqf UUID := gen_random_uuid();
  kw_fillet UUID := gen_random_uuid();
BEGIN

  -- Categories
  INSERT INTO public.categories (id, slug, label, description, sort_order)
  VALUES
    (cat_fish_id, 'fish', 'Fish', 'Whole, gutted, fillets, steaks', 1),
    (cat_crustaceans_id, 'crustaceans', 'Crustaceans', 'Shrimp, crab, lobster, langoustine', 2),
    (cat_cephalopods_id, 'cephalopods', 'Cephalopods', 'Octopus, squid, cuttlefish', 3),
    (cat_fillets_id, 'fillets-portions', 'Fillets & Portions', 'Processed cuts, portions, loins', 4),
    (cat_frozen_id, 'frozen-products', 'Frozen Products', 'IQF, block frozen, glazed', 5),
    (cat_packaging_id, 'packaging', 'Packaging', 'Retail packs, bulk, vacuum, MAP', 6)
  ON CONFLICT (slug) DO NOTHING;

  -- Demo species (is_demo = true)
  INSERT INTO public.species (id, slug, common_name, scientific_name, family, category, fao_areas, is_validated, is_demo)
  VALUES
    (sp_sardine_id, 'sardina-pilchardus', 'European Sardine', 'Sardina pilchardus', 'Clupeidae', 'Fish', ARRAY['FAO 27'], true, true),
    (sp_mackerel_id, 'scomber-scombrus', 'Atlantic Mackerel', 'Scomber scombrus', 'Scombridae', 'Fish', ARRAY['FAO 27'], true, true),
    (sp_tuna_id, 'thunnus-albacares', 'Yellowfin Tuna', 'Thunnus albacares', 'Scombridae', 'Fish', ARRAY['FAO 51', 'FAO 57'], true, true),
    (sp_octopus_id, 'octopus-vulgaris', 'Common Octopus', 'Octopus vulgaris', 'Octopodidae', 'Cephalopods', ARRAY['FAO 27', 'FAO 34'], true, true),
    (sp_squid_id, 'loligo-vulgaris', 'European Squid', 'Loligo vulgaris', 'Loliginidae', 'Cephalopods', ARRAY['FAO 27'], true, true),
    (sp_cuttlefish_id, 'sepia-officinalis', 'Common Cuttlefish', 'Sepia officinalis', 'Sepiidae', 'Cephalopods', ARRAY['FAO 27'], true, true),
    (sp_shrimp_id, 'penaeus-monodon', 'Giant Tiger Prawn', 'Penaeus monodon', 'Penaeidae', 'Crustaceans', ARRAY['FAO 51', 'FAO 57'], true, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Keywords
  INSERT INTO public.keywords (id, term)
  VALUES
    (kw_mackerel, 'mackerel'),
    (kw_octopus, 'octopus'),
    (kw_shrimp, 'shrimp'),
    (kw_tuna, 'tuna'),
    (kw_sardine, 'sardine'),
    (kw_squid, 'squid'),
    (kw_frozen, 'frozen'),
    (kw_fresh, 'fresh'),
    (kw_iqf, 'iqf'),
    (kw_fillet, 'fillet')
  ON CONFLICT (term) DO NOTHING;

  -- Demo assets (is_demo = true, review_status = approved for demo visibility)
  INSERT INTO public.assets (
    id, public_asset_id, slug, title, media_type, category, species_id,
    product_form, product_state, freezing_method, packaging, country, fao_area,
    orientation, license_type, commercial_use, editorial_use,
    is_real_photo, is_verified, review_status, publication_status, is_demo
  ) VALUES
    (asset_001, 'SV-DEMO-001', 'atlantic-mackerel-whole-fresh-sv001', 'Atlantic Mackerel — Whole, Fresh',
     'photo', 'Fish', sp_mackerel_id, 'Whole, ungutted', 'Fresh', NULL, 'None', 'France', 'FAO 27',
     'Landscape', 'commercial', true, false, true, true, 'approved', 'published', true),
    (asset_002, 'SV-DEMO-002', 'common-octopus-whole-fresh-sv002', 'Common Octopus — Whole, Fresh',
     'photo', 'Cephalopods', sp_octopus_id, 'Whole, uncleaned', 'Fresh', NULL, 'None', 'Portugal', 'FAO 27',
     'Portrait', 'editorial', false, true, true, true, 'approved', 'published', true),
    (asset_003, 'SV-DEMO-003', 'tiger-shrimp-headless-frozen-sv003', 'Giant Tiger Prawn — Headless, Frozen',
     'photo', 'Crustaceans', sp_shrimp_id, 'Headless shell-on', 'Frozen', 'IQF', 'Vacuum', 'Vietnam', 'FAO 57',
     'Landscape', 'commercial', true, false, true, true, 'approved', 'published', true),
    (asset_004, 'SV-DEMO-004', 'yellowfin-tuna-steak-sv004', 'Yellowfin Tuna — Steak, Fresh',
     'photo', 'Fish', sp_tuna_id, 'Steak', 'Fresh', NULL, 'None', 'Maldives', 'FAO 51',
     'Landscape', 'commercial', true, false, true, true, 'commercial', 'published', true),
    (asset_005, 'SV-DEMO-005', 'european-sardine-whole-sv005', 'European Sardine — Whole, Fresh',
     'photo', 'Fish', sp_sardine_id, 'Whole, fresh', 'Fresh', NULL, 'None', 'Portugal', 'FAO 27',
     'Landscape', 'editorial', false, true, true, false, 'preview_only', 'published', true),
    (asset_006, 'SV-DEMO-006', 'common-cuttlefish-whole-sv006', 'Common Cuttlefish — Whole, Fresh',
     'photo', 'Cephalopods', sp_cuttlefish_id, 'Whole, uncleaned', 'Fresh', NULL, 'None', 'Spain', 'FAO 27',
     'Portrait', 'editorial', false, true, true, true, 'approved', 'published', true),
    (asset_007, 'SV-DEMO-007', 'european-squid-cleaned-sv007', 'European Squid — Cleaned Tube',
     'photo', 'Cephalopods', sp_squid_id, 'Cleaned tube', 'Fresh', NULL, 'None', 'Spain', 'FAO 27',
     'Landscape', 'commercial', true, false, true, true, 'commercial', 'published', true),
    (asset_008, 'SV-DEMO-008', 'atlantic-mackerel-fillet-frozen-sv008', 'Atlantic Mackerel — Fillet, Frozen',
     'photo', 'Fillets & Portions', sp_mackerel_id, 'Fillet, skin-on', 'Frozen', 'Block frozen', 'Carton', 'Norway', 'FAO 27',
     'Landscape', 'commercial', true, false, true, true, 'commercial', 'published', true),
    (asset_009, 'SV-DEMO-009', 'tiger-shrimp-peeled-iqf-sv009', 'Giant Tiger Prawn — Peeled, IQF',
     'photo', 'Crustaceans', sp_shrimp_id, 'Peeled, deveined', 'Frozen', 'IQF', 'Polybag', 'Thailand', 'FAO 57',
     'Square', 'commercial', true, false, true, true, 'approved', 'published', true),
    (asset_010, 'SV-DEMO-010', 'sardine-vacuum-pack-sv010', 'European Sardine — Vacuum Packed, Fresh',
     'photo', 'Packaging', sp_sardine_id, 'Whole, gutted', 'Fresh', NULL, 'Vacuum', 'Portugal', 'FAO 27',
     'Landscape', 'commercial', true, false, true, false, 'preview_only', 'published', true),
    (asset_011, 'SV-DEMO-011', 'tuna-loin-frozen-sv011', 'Yellowfin Tuna — Loin, Frozen',
     'photo', 'Fillets & Portions', sp_tuna_id, 'Loin, skinless', 'Frozen', 'IQF', 'Vacuum', 'Indonesia', 'FAO 57',
     'Landscape', 'commercial', true, false, true, true, 'commercial', 'published', true),
    (asset_012, 'SV-DEMO-012', 'octopus-whole-frozen-sv012', 'Common Octopus — Whole, Frozen',
     'photo', 'Frozen Products', sp_octopus_id, 'Whole, cleaned', 'Frozen', 'Block frozen', 'Carton', 'Morocco', 'FAO 34',
     'Landscape', 'editorial', false, true, true, true, 'approved', 'published', true)
  ON CONFLICT (slug) DO NOTHING;

  -- Asset keywords (demo)
  INSERT INTO public.asset_keywords (asset_id, keyword_id)
  VALUES
    (asset_001, kw_mackerel), (asset_001, kw_fresh),
    (asset_002, kw_octopus), (asset_002, kw_fresh),
    (asset_003, kw_shrimp), (asset_003, kw_frozen), (asset_003, kw_iqf),
    (asset_004, kw_tuna), (asset_004, kw_fresh),
    (asset_005, kw_sardine), (asset_005, kw_fresh),
    (asset_006, kw_squid), (asset_006, kw_fresh),
    (asset_007, kw_squid), (asset_007, kw_fresh),
    (asset_008, kw_mackerel), (asset_008, kw_frozen), (asset_008, kw_fillet),
    (asset_009, kw_shrimp), (asset_009, kw_frozen), (asset_009, kw_iqf),
    (asset_010, kw_sardine), (asset_010, kw_fresh),
    (asset_011, kw_tuna), (asset_011, kw_frozen), (asset_011, kw_fillet),
    (asset_012, kw_octopus), (asset_012, kw_frozen)
  ON CONFLICT DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo data insertion failed: %', SQLERRM;
END $$;
