-- Étape 6, migration 3 : « Pack 10 Photos HD » (remise automatique par bloc de 10 Photo HD standard).
-- pack_10 passe de résolution web à hd ; pack_size = nombre de photos par pack (NULL pour les autres produits).
-- download_quota = 1 : le quota est par photo (le webhook crée une licence et un droit de téléchargement par photo).
ALTER TABLE public.unit_products ADD COLUMN IF NOT EXISTS pack_size integer;
ALTER TABLE public.unit_products DROP CONSTRAINT IF EXISTS unit_products_pack_size_positive;
ALTER TABLE public.unit_products ADD CONSTRAINT unit_products_pack_size_positive CHECK (pack_size IS NULL OR pack_size > 0);

UPDATE public.unit_products
SET name = 'Pack 10 Photos HD',
    description = 'Bundle of 10 standard HD photos (discount applied automatically in blocks of 10)',
    resolution_allowed = 'hd',
    pack_size = 10,
    download_quota = 1,
    updated_at = now()
WHERE product_code = 'pack_10';
