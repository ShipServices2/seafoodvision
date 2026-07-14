-- ============================================================
-- Seafood Vision — Storage Buckets + Signed URL Support
-- Timestamp: 20260714120000
-- Creates asset-thumbnails and asset-previews buckets (private)
-- Adds RLS policies for admin upload and signed URL access
-- NEVER creates asset-originals bucket
-- Idempotent: safe to run multiple times
-- ============================================================

-- ============================================================
-- SECTION 1: Storage Buckets
-- Supabase storage buckets are managed via the storage schema.
-- We use INSERT ... ON CONFLICT to be idempotent.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-thumbnails',
  'asset-thumbnails',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-previews',
  'asset-previews',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- ============================================================
-- SECTION 2: Helper function to check admin role
-- (reuse existing is_admin if present, otherwise create)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_for_storage()
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

-- ============================================================
-- SECTION 3: Storage RLS Policies — asset-thumbnails
-- ============================================================

-- Admins can upload/update/delete thumbnails
DROP POLICY IF EXISTS "admins_manage_thumbnails" ON storage.objects;
CREATE POLICY "admins_manage_thumbnails"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'asset-thumbnails'
  AND public.is_admin_for_storage()
)
WITH CHECK (
  bucket_id = 'asset-thumbnails'
  AND public.is_admin_for_storage()
);

-- Authenticated users can read thumbnails (via signed URL)
DROP POLICY IF EXISTS "authenticated_read_thumbnails" ON storage.objects;
CREATE POLICY "authenticated_read_thumbnails"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'asset-thumbnails');

-- ============================================================
-- SECTION 4: Storage RLS Policies — asset-previews
-- ============================================================

-- Admins can upload/update/delete previews
DROP POLICY IF EXISTS "admins_manage_previews" ON storage.objects;
CREATE POLICY "admins_manage_previews"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'asset-previews'
  AND public.is_admin_for_storage()
)
WITH CHECK (
  bucket_id = 'asset-previews'
  AND public.is_admin_for_storage()
);

-- Authenticated users can read previews (via signed URL)
DROP POLICY IF EXISTS "authenticated_read_previews" ON storage.objects;
CREATE POLICY "authenticated_read_previews"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'asset-previews');

-- ============================================================
-- SECTION 5: asset_files upsert index
-- Ensure we can upsert on (asset_id, file_level) without duplicates
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_files_asset_level
ON public.asset_files (asset_id, file_level);
