-- ============================================================
-- Étape 4b : stockage des vrais originaux + clé d'idempotence d'import
-- Strictement additif : aucun DROP / DELETE / UPDATE de données.
--  1. bucket privé asset-originals (aucune policy storage : accès service role uniquement,
--     livraison via URL signée côté serveur après achat)
--  2. colonne assets.source_sha256 (nullable) + index unique partiel
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-originals',
  'asset-originals',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS source_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS assets_source_sha256_key
  ON public.assets (source_sha256)
  WHERE source_sha256 IS NOT NULL;

COMMENT ON COLUMN public.assets.source_sha256 IS
  'SHA-256 du fichier source original (clé d''idempotence de l''import ; chemin Storage originals/<sha[0:2]>/<sha>.<ext>)';
