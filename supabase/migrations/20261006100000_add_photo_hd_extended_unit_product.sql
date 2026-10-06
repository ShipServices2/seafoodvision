-- Étape 4c : produit unitaire « Photo HD + licence étendue » (299 EUR, prix de src/lib/pricingConfig.ts).
-- Strictement additif (INSERT d'une ligne si absente). Aucun mapping Dodo n'est créé ici : le produit TEST à 299 EUR
-- doit être créé dans Dodo puis relié depuis /admin/commerce/mappings (internal_product_type = one_time_asset_license).
INSERT INTO public.unit_products (name, description, product_code, product_type, price, currency, license_type_code, resolution_allowed, download_quota, discount_pct, is_active)
SELECT 'Photo HD — Extended licence',
       'HD file with extended rights (print runs, broadcast, merchandise)',
       'photo_hd_extended', 'image', 299.00, 'EUR', 'extended', 'hd', 1, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.unit_products WHERE product_code = 'photo_hd_extended');
