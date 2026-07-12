-- ============================================================
-- SEAFOOD VISION — Phase 6.1: Seafood Identification Foundation
-- Migration: phase_6_1_seafood_identification
-- ============================================================
-- Extends existing identification_requests table
-- Adds: identification_candidates, identification_reviews,
--       identification_feedback, identification_events
-- ============================================================

-- ============================================================
-- STEP 1: EXTEND identification_requests (existing table)
-- ============================================================

ALTER TABLE public.identification_requests
  ADD COLUMN IF NOT EXISTS anonymous_session_id TEXT,
  ADD COLUMN IF NOT EXISTS upload_path TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS quality_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_category_hint TEXT,
  ADD COLUMN IF NOT EXISTS user_state_hint TEXT,
  ADD COLUMN IF NOT EXISTS user_context_hint TEXT,
  ADD COLUMN IF NOT EXISTS user_country_hint TEXT,
  ADD COLUMN IF NOT EXISTS user_notes TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS consent_for_retention BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Migrate existing status values if needed
UPDATE public.identification_requests
SET status = 'uploaded'
WHERE status = 'pending';

-- ============================================================
-- STEP 2: NEW TABLE — identification_candidates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identification_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.identification_requests(id) ON DELETE CASCADE,
  species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  asset_id UUID,
  candidate_type TEXT NOT NULL DEFAULT 'species',
  rank INTEGER NOT NULL DEFAULT 1,
  confidence_level TEXT NOT NULL DEFAULT 'limited_evidence',
  confidence_score NUMERIC,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  source_type TEXT DEFAULT 'structured_search',
  model_name TEXT,
  model_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 3: NEW TABLE — identification_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.identification_requests(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'requested',
  confirmed_species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  confirmed_product_id UUID,
  confidence_level TEXT DEFAULT 'limited_evidence',
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 4: NEW TABLE — identification_feedback
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.identification_requests(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.identification_candidates(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL DEFAULT 'not_sure',
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 5: NEW TABLE — identification_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.identification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.identification_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 6: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_identification_requests_user_id
  ON public.identification_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_identification_requests_status
  ON public.identification_requests(status);

CREATE INDEX IF NOT EXISTS idx_identification_requests_created_at
  ON public.identification_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identification_candidates_request_id
  ON public.identification_candidates(request_id);

CREATE INDEX IF NOT EXISTS idx_identification_candidates_species_id
  ON public.identification_candidates(species_id);

CREATE INDEX IF NOT EXISTS idx_identification_candidates_rank
  ON public.identification_candidates(request_id, rank);

CREATE INDEX IF NOT EXISTS idx_identification_reviews_request_id
  ON public.identification_reviews(request_id);

CREATE INDEX IF NOT EXISTS idx_identification_reviews_reviewer_id
  ON public.identification_reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_identification_feedback_request_id
  ON public.identification_feedback(request_id);

CREATE INDEX IF NOT EXISTS idx_identification_events_request_id
  ON public.identification_events(request_id);

CREATE INDEX IF NOT EXISTS idx_identification_events_created_at
  ON public.identification_events(created_at DESC);

-- ============================================================
-- STEP 7: HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role_for_identification()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(role::TEXT, 'visitor')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_identification_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('administrator', 'super_admin', 'reviewer')
  );
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_identification_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 8: ENABLE RLS
-- ============================================================

ALTER TABLE public.identification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identification_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 9: RLS POLICIES — identification_requests
-- ============================================================

DROP POLICY IF EXISTS "users_view_own_identification_requests" ON public.identification_requests;
CREATE POLICY "users_view_own_identification_requests"
ON public.identification_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_identification_admin());

DROP POLICY IF EXISTS "anon_view_own_identification_requests" ON public.identification_requests;
CREATE POLICY "anon_view_own_identification_requests"
ON public.identification_requests
FOR SELECT
TO anon
USING (user_id IS NULL);

DROP POLICY IF EXISTS "users_insert_identification_requests" ON public.identification_requests;
CREATE POLICY "users_insert_identification_requests"
ON public.identification_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_identification_requests" ON public.identification_requests;
CREATE POLICY "anon_insert_identification_requests"
ON public.identification_requests
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "users_update_own_identification_requests" ON public.identification_requests;
CREATE POLICY "users_update_own_identification_requests"
ON public.identification_requests
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_identification_admin())
WITH CHECK (user_id = auth.uid() OR public.is_identification_admin());

DROP POLICY IF EXISTS "users_delete_own_identification_requests" ON public.identification_requests;
CREATE POLICY "users_delete_own_identification_requests"
ON public.identification_requests
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_identification_admin());

-- ============================================================
-- STEP 10: RLS POLICIES — identification_candidates
-- ============================================================

DROP POLICY IF EXISTS "users_view_own_candidates" ON public.identification_candidates;
CREATE POLICY "users_view_own_candidates"
ON public.identification_candidates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.identification_requests ir
    WHERE ir.id = identification_candidates.request_id
    AND (ir.user_id = auth.uid() OR public.is_identification_admin())
  )
);

DROP POLICY IF EXISTS "anon_view_candidates" ON public.identification_candidates;
CREATE POLICY "anon_view_candidates"
ON public.identification_candidates
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.identification_requests ir
    WHERE ir.id = identification_candidates.request_id
    AND ir.user_id IS NULL
  )
);

DROP POLICY IF EXISTS "admins_manage_candidates" ON public.identification_candidates;
CREATE POLICY "admins_manage_candidates"
ON public.identification_candidates
FOR ALL
TO authenticated
USING (public.is_identification_admin())
WITH CHECK (public.is_identification_admin());

-- ============================================================
-- STEP 11: RLS POLICIES — identification_reviews
-- ============================================================

DROP POLICY IF EXISTS "users_view_own_reviews" ON public.identification_reviews;
CREATE POLICY "users_view_own_reviews"
ON public.identification_reviews
FOR SELECT
TO authenticated
USING (
  reviewer_id = auth.uid()
  OR public.is_identification_admin()
  OR EXISTS (
    SELECT 1 FROM public.identification_requests ir
    WHERE ir.id = identification_reviews.request_id
    AND ir.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admins_manage_reviews" ON public.identification_reviews;
CREATE POLICY "admins_manage_reviews"
ON public.identification_reviews
FOR ALL
TO authenticated
USING (public.is_identification_admin())
WITH CHECK (public.is_identification_admin());

-- ============================================================
-- STEP 12: RLS POLICIES — identification_feedback
-- ============================================================

DROP POLICY IF EXISTS "users_manage_own_feedback" ON public.identification_feedback;
CREATE POLICY "users_manage_own_feedback"
ON public.identification_feedback
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_identification_admin())
WITH CHECK (user_id = auth.uid() OR public.is_identification_admin());

DROP POLICY IF EXISTS "anon_insert_feedback" ON public.identification_feedback;
CREATE POLICY "anon_insert_feedback"
ON public.identification_feedback
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- ============================================================
-- STEP 13: RLS POLICIES — identification_events
-- ============================================================

DROP POLICY IF EXISTS "users_view_own_events" ON public.identification_events;
CREATE POLICY "users_view_own_events"
ON public.identification_events
FOR SELECT
TO authenticated
USING (
  public.is_identification_admin()
  OR EXISTS (
    SELECT 1 FROM public.identification_requests ir
    WHERE ir.id = identification_events.request_id
    AND ir.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admins_manage_events" ON public.identification_events;
CREATE POLICY "admins_manage_events"
ON public.identification_events
FOR ALL
TO authenticated
USING (public.is_identification_admin())
WITH CHECK (public.is_identification_admin());

-- ============================================================
-- STEP 14: TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_identification_request_updated_at ON public.identification_requests;
CREATE TRIGGER update_identification_request_updated_at
  BEFORE UPDATE ON public.identification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_identification_request_updated_at();

-- ============================================================
-- END OF MIGRATION
-- ============================================================
