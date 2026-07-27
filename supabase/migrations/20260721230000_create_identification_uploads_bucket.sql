-- ============================================================
-- Create identification-uploads storage bucket
-- Required for OpenAI Vision identification to work
-- ============================================================

-- Insert the bucket into storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identification-uploads',
  'identification-uploads',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies for identification-uploads bucket ──────────────────────────

-- Allow authenticated users to upload their own files
DROP POLICY IF EXISTS "identification_uploads_insert" ON storage.objects;
CREATE POLICY "identification_uploads_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identification-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anonymous uploads (for users not logged in)
DROP POLICY IF EXISTS "identification_uploads_insert_anon" ON storage.objects;
CREATE POLICY "identification_uploads_insert_anon"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'identification-uploads'
  AND (storage.foldername(name))[1] = 'anonymous'
);

-- Allow authenticated users to read their own files
DROP POLICY IF EXISTS "identification_uploads_select" ON storage.objects;
CREATE POLICY "identification_uploads_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identification-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role to read all files (for engine.ts server-side download)
DROP POLICY IF EXISTS "identification_uploads_service_select" ON storage.objects;
CREATE POLICY "identification_uploads_service_select"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'identification-uploads');

-- Allow service role to delete files (cleanup)
DROP POLICY IF EXISTS "identification_uploads_service_delete" ON storage.objects;
CREATE POLICY "identification_uploads_service_delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'identification-uploads');
