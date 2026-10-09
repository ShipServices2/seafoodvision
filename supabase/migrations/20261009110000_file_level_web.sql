-- Étape 6, migration 2 : niveau de fichier « web » (JPEG 1920 px max, sans filigrane, livré après achat de Photo Web).
-- Stocké dans le bucket privé asset-originals. Il ne doit JAMAIS être lisible publiquement :
-- les policies de lecture publique/authentifiée passent de « != original » à une liste blanche (preview, thumbnail).
ALTER TYPE public.file_level ADD VALUE IF NOT EXISTS 'web';

DROP POLICY IF EXISTS "asset_files_public_read" ON public.asset_files;
CREATE POLICY "asset_files_public_read"
  ON public.asset_files FOR SELECT
  TO public
  USING (
    file_level IN ('preview', 'thumbnail')
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "asset_files_authenticated_read" ON public.asset_files;
CREATE POLICY "asset_files_authenticated_read"
  ON public.asset_files FOR SELECT
  TO authenticated
  USING (
    file_level IN ('preview', 'thumbnail')
    AND EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_files.asset_id
        AND a.review_status IN ('approved', 'commercial', 'editorial', 'preview_only')
        AND a.publication_status = 'published'
    )
  );
