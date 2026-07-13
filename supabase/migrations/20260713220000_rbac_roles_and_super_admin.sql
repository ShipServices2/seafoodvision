-- ============================================================
-- Seafood Vision — RBAC Role Authorization System
-- Timestamp: 20260713220000
-- Promotes senshipservices@gmail.com to super_admin
-- Adds server-side role enforcement functions
-- Restricts /admin routes to super_admin and administrator only
-- ============================================================

-- ============================================================
-- SECTION 1: ENSURE user_role ENUM HAS ALL REQUIRED VALUES
-- (Already exists from full schema — this is a safety guard)
-- ============================================================

DO $$
BEGIN
  -- Add 'super_admin' if missing (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'super_admin'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'user_role' AND typnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = 'public'
        )
      )
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- ============================================================
-- SECTION 2: ROLE AUTHORIZATION FUNCTIONS
-- (SECURITY DEFINER — safe for RLS use on non-profiles tables)
-- ============================================================

-- Check if current user is admin (administrator OR super_admin)
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
      AND is_active = true
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
      AND is_active = true
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
      AND is_active = true
  );
$$;

-- Get current user role as text (used by middleware/server components)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- ============================================================
-- SECTION 3: PROMOTE senshipservices@gmail.com TO super_admin
-- ============================================================

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'senshipservices@gmail.com'
  LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    -- Update or insert profile with super_admin role
    INSERT INTO public.profiles (id, email, role, is_active, created_at, updated_at)
    VALUES (
      target_user_id,
      'senshipservices@gmail.com',
      'super_admin'::public.user_role,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
      SET role = 'super_admin'::public.user_role,
          is_active = true,
          updated_at = NOW();

    RAISE NOTICE 'Successfully promoted senshipservices@gmail.com (%) to super_admin', target_user_id;
  ELSE
    RAISE NOTICE 'User senshipservices@gmail.com not found in auth.users. They will receive super_admin role upon first sign-in via trigger.';
    -- Pre-create a placeholder that the trigger will update on first login
    -- This is handled by the handle_new_user trigger which reads raw_user_meta_data
  END IF;
END $$;

-- ============================================================
-- SECTION 4: RLS POLICIES FOR ADMIN-ONLY TABLES
-- ============================================================

-- IMPORT BATCHES: only admins can manage
DROP POLICY IF EXISTS "import_batches_admin_only" ON public.import_batches;
CREATE POLICY "import_batches_admin_only"
  ON public.import_batches FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PLATFORM SETTINGS: only super_admin can manage
DROP POLICY IF EXISTS "platform_settings_super_admin_only" ON public.platform_settings;
CREATE POLICY "platform_settings_super_admin_only"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- AUDIT LOGS: admins can read; system writes
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_system_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_system_insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- REVIEW TASKS: reviewers and above can access
DROP POLICY IF EXISTS "review_tasks_reviewer_access" ON public.review_tasks;
CREATE POLICY "review_tasks_reviewer_access"
  ON public.review_tasks FOR ALL
  TO authenticated
  USING (public.is_reviewer_or_above())
  WITH CHECK (public.is_reviewer_or_above());

-- ASSET STATUS HISTORY: reviewers and above can read; admins manage
DROP POLICY IF EXISTS "asset_status_history_reviewer_read" ON public.asset_status_history;
CREATE POLICY "asset_status_history_reviewer_read"
  ON public.asset_status_history FOR SELECT
  TO authenticated
  USING (public.is_reviewer_or_above());

DROP POLICY IF EXISTS "asset_status_history_admin_manage" ON public.asset_status_history;
CREATE POLICY "asset_status_history_admin_manage"
  ON public.asset_status_history FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PROFILES: admins can update any profile (for user management)
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 5: SERVER-SIDE ROLE VALIDATION FUNCTION
-- Returns full profile role for a given user_id (used by API routes)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_profile_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT
  FROM public.profiles
  WHERE id = user_id AND is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- SECTION 6: INDEXES FOR ROLE LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles(role, is_active)
  WHERE is_active = true;

-- ============================================================
-- SECTION 7: VERIFICATION
-- ============================================================

DO $$
DECLARE
  admin_count INTEGER;
  super_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role IN ('administrator', 'super_admin') AND is_active = true;

  SELECT COUNT(*) INTO super_admin_count
  FROM public.profiles
  WHERE role = 'super_admin' AND is_active = true;

  RAISE NOTICE 'RBAC Migration complete. Active admins: %, Super admins: %', admin_count, super_admin_count;
END $$;
