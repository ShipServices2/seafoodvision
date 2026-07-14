-- ============================================================
-- Seafood Vision — Fix Pilot Assets Visibility
-- Timestamp: 20260714130000
-- Purpose:
--   1. Set review_status = 'approved' for the 8 pilot assets
--      (SV-PILOT-0001 to SV-PILOT-0008) so they pass all
--      public-facing filters.
--   2. Ensure publication_status is not 'archived' for these assets.
--   3. Add anon (public) storage read policies so unauthenticated
--      visitors can receive signed URLs via the API route.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ============================================================
-- SECTION 1: Approve the 8 pilot assets
-- Only updates review_status and publication_status — no other
-- metadata is touched.
-- ============================================================

UPDATE public.assets
SET
  review_status     = 'approved',
  publication_status = CASE
    WHEN publication_status = 'archived' THEN 'published'
    ELSE publication_status
  END,
  updated_at = now()
WHERE public_asset_id IN (
  'SV-PILOT-0001',
  'SV-PILOT-0002',
  'SV-PILOT-0003',
  'SV-PILOT-0004',
  'SV-PILOT-0005',
  'SV-PILOT-0006',
  'SV-PILOT-0007',
  'SV-PILOT-0008'
)
AND review_status NOT IN ('approved', 'commercial', 'editorial', 'preview_only');

-- ============================================================
-- SECTION 2: Also ensure publication_status is not 'archived'
-- for all 8 pilot assets regardless of review_status
-- ============================================================

UPDATE public.assets
SET
  publication_status = 'published',
  updated_at = now()
WHERE public_asset_id IN (
  'SV-PILOT-0001',
  'SV-PILOT-0002',
  'SV-PILOT-0003',
  'SV-PILOT-0004',
  'SV-PILOT-0005',
  'SV-PILOT-0006',
  'SV-PILOT-0007',
  'SV-PILOT-0008'
)
AND publication_status = 'archived';

-- ============================================================
-- SECTION 3: Storage RLS — allow anon role to read thumbnails
-- and previews so unauthenticated visitors can receive signed URLs
-- ============================================================

DROP POLICY IF EXISTS "anon_read_thumbnails" ON storage.objects;
CREATE POLICY "anon_read_thumbnails"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'asset-thumbnails');

DROP POLICY IF EXISTS "anon_read_previews" ON storage.objects;
CREATE POLICY "anon_read_previews"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'asset-previews');

-- ============================================================
-- SECTION 4: Ensure public (anon) RLS policy on assets table
-- allows reading the pilot assets
-- ============================================================

DROP POLICY IF EXISTS "assets_public_read_approved" ON public.assets;
CREATE POLICY "assets_public_read_approved"
  ON public.assets FOR SELECT
  TO public
  USING (
    review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
    AND publication_status != 'archived'
  );

-- ============================================================
-- SECTION 5: Ensure asset_files are readable by anon for
-- approved assets (so thumbnailBucket/thumbnailPath are returned)
-- ============================================================

DROP POLICY IF EXISTS "asset_files_public_read" ON public.asset_files;
CREATE POLICY "asset_files_public_read"
  ON public.asset_files FOR SELECT
  TO public
  USING (
    file_level != 'original'
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status != 'archived'
    )
  );
