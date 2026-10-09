-- Étape 6, migration 1 : prix barrés et fin de promotion.
-- La base est la source de vérité des prix (src/lib/pricingConfig.ts n'en garde aucune copie).
-- list_price = prix normal (barré) ; price = prix promotionnel facturé. Additif : 2 colonnes + valeurs.
ALTER TABLE public.unit_products
  ADD COLUMN IF NOT EXISTS list_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz;

ALTER TABLE public.unit_products
  DROP CONSTRAINT IF EXISTS unit_products_list_price_gte_price;
ALTER TABLE public.unit_products
  ADD CONSTRAINT unit_products_list_price_gte_price CHECK (list_price IS NULL OR list_price >= price);

UPDATE public.unit_products SET list_price = 15.00,  promo_ends_at = '2027-01-31 23:59:59+00' WHERE product_code = 'photo_web';
UPDATE public.unit_products SET list_price = 39.00,  promo_ends_at = '2027-01-31 23:59:59+00' WHERE product_code = 'photo_hd';
UPDATE public.unit_products SET list_price = 299.00, promo_ends_at = '2027-01-31 23:59:59+00' WHERE product_code = 'photo_hd_extended';
UPDATE public.unit_products SET list_price = 290.00, promo_ends_at = '2027-01-31 23:59:59+00' WHERE product_code = 'pack_10';

COMMENT ON COLUMN public.unit_products.list_price IS 'Prix normal (affiché barré tant que promo_ends_at n''est pas passé et que list_price > price).';
COMMENT ON COLUMN public.unit_products.promo_ends_at IS 'Fin de la promotion de lancement (affichée sur /pricing, la fiche photo et le panier).';
