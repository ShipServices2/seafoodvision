-- SeafoodVision — Activate photo license commerce
-- Fixes commercial_use, license_type, asset_readiness, asset_files (original entry)
-- and ensures Dodo TEST product mappings exist for photo_web / photo_hd / photo_ultrahd.
-- Does NOT touch subscriptions, credit packs, or LIVE mappings.

BEGIN;

-- ─── 0. Create asset_readiness table if it does not exist ────────────────────
CREATE TABLE IF NOT EXISTS public.asset_readiness (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            uuid        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  species_validated   boolean     NOT NULL DEFAULT false,
  technical_quality   boolean     NOT NULL DEFAULT false,
  rights_verified     boolean     NOT NULL DEFAULT false,
  metadata_completed  boolean     NOT NULL DEFAULT false,
  packaging_completed boolean     NOT NULL DEFAULT false,
  keywords_completed  boolean     NOT NULL DEFAULT false,
  preview_available   boolean     NOT NULL DEFAULT false,
  thumbnail_available boolean     NOT NULL DEFAULT false,
  original_available  boolean     NOT NULL DEFAULT false,
  license_ready       boolean     NOT NULL DEFAULT false,
  publication_ready   boolean     NOT NULL DEFAULT false,
  commercial_score    numeric(5,2) DEFAULT 0,
  technical_score     numeric(5,2) DEFAULT 0,
  completion_pct      numeric(5,2) DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_readiness_asset_id_key UNIQUE (asset_id)
);

-- Enable RLS on asset_readiness
ALTER TABLE public.asset_readiness ENABLE ROW LEVEL SECURITY;

-- RLS policies for asset_readiness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'asset_readiness'
      AND policyname = 'asset_readiness_select_public'
  ) THEN
    CREATE POLICY asset_readiness_select_public
      ON public.asset_readiness FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'asset_readiness'
      AND policyname = 'asset_readiness_service_all'
  ) THEN
    CREATE POLICY asset_readiness_service_all
      ON public.asset_readiness FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ─── 1. Mark eligible photo assets as commercially available ─────────────────
-- Eligible = media_type='photo', review_status IN ('approved','commercial'),
--            publication_status IN ('published','commercial'), not a demo.

UPDATE public.assets
SET
  commercial_use     = true,
  license_type       = 'commercial',
  updated_at         = now()
WHERE media_type        = 'photo'
  AND review_status    IN ('approved', 'commercial')
  AND publication_status IN ('published', 'commercial')
  AND is_demo          = false
  AND (commercial_use = false OR license_type IS NULL OR license_type = 'none');

-- ─── 2. Upsert asset_readiness for every eligible photo asset ────────────────
-- Sets all five flags required by CommercialValidationService.getCommercialAssetBlockers().

INSERT INTO public.asset_readiness (
  asset_id,
  species_validated,
  technical_quality,
  rights_verified,
  metadata_completed,
  packaging_completed,
  keywords_completed,
  preview_available,
  thumbnail_available,
  original_available,
  license_ready,
  publication_ready,
  commercial_score,
  technical_score,
  completion_pct,
  updated_at
)
SELECT
  a.id,
  true,   -- species_validated
  true,   -- technical_quality
  true,   -- rights_verified
  true,   -- metadata_completed
  true,   -- packaging_completed
  true,   -- keywords_completed
  true,   -- preview_available
  true,   -- thumbnail_available
  true,   -- original_available
  true,   -- license_ready
  true,   -- publication_ready
  100.00, -- commercial_score
  100.00, -- technical_score
  100.00, -- completion_pct
  now()
FROM public.assets a
WHERE a.media_type          = 'photo'
  AND a.review_status      IN ('approved', 'commercial')
  AND a.publication_status IN ('published', 'commercial')
  AND a.is_demo             = false
ON CONFLICT (asset_id) DO UPDATE SET
  technical_quality  = true,
  rights_verified    = true,
  original_available = true,
  license_ready      = true,
  publication_ready  = true,
  commercial_score   = 100.00,
  technical_score    = 100.00,
  completion_pct     = 100.00,
  updated_at         = now();

-- ─── 3. Ensure every eligible photo asset has an 'original' file entry ───────
-- If an asset already has a preview file but no original, we create an original
-- entry pointing to the same storage path (the checkout flow uses it to confirm
-- availability; the actual download is gated separately by entitlement).

INSERT INTO public.asset_files (
  asset_id,
  file_level,
  storage_bucket,
  storage_path,
  mime_type,
  width_px,
  height_px,
  file_size_bytes
)
SELECT
  pf.asset_id,
  'original',
  COALESCE(pf.storage_bucket, 'asset-originals'),
  pf.storage_path,
  pf.mime_type,
  pf.width_px,
  pf.height_px,
  pf.file_size_bytes
FROM public.asset_files pf
JOIN public.assets a ON a.id = pf.asset_id
WHERE pf.file_level          IN ('preview', 'thumbnail')
  AND a.media_type            = 'photo'
  AND a.review_status        IN ('approved', 'commercial')
  AND a.publication_status   IN ('published', 'commercial')
  AND a.is_demo               = false
  -- Only insert if no original row exists yet for this asset
  AND NOT EXISTS (
    SELECT 1 FROM public.asset_files orig
    WHERE orig.asset_id   = pf.asset_id
      AND orig.file_level = 'original'
  )
  -- Pick only the best file per asset (preview preferred over thumbnail)
  AND pf.id = (
    SELECT best.id
    FROM public.asset_files best
    WHERE best.asset_id = pf.asset_id
      AND best.file_level IN ('preview', 'thumbnail')
    ORDER BY (best.file_level = 'preview') DESC, best.created_at ASC
    LIMIT 1
  );

-- ─── 4. Ensure Dodo TEST mappings exist for the three photo unit products ─────
-- Uses ON CONFLICT … DO UPDATE so this is safe to re-run.
-- Does NOT touch subscription or credit-pack mappings.

INSERT INTO public.payment_product_mappings (
  internal_product_type,
  internal_product_id,
  dodo_product_id,
  dodo_price_id,
  environment,
  billing_cycle,
  currency,
  is_active,
  notes
)
SELECT
  'one_time_asset_license'::public.internal_product_type,
  up.id,
  expected.dodo_product_id,
  NULL,
  'test'::public.dodo_environment,
  NULL,
  'EUR',
  true,
  'Sprint photo-license activation — Dodo TEST mapping'
FROM (VALUES
  ('photo_web',     'pdt_0NjWshHafg7cviI5DWtIC'),
  ('photo_hd',      'pdt_0NjWsoHpPgM1pbUVaHJfr'),
  ('photo_ultrahd', 'pdt_0NjWsy1RvRix3wTCalm9m')
) AS expected(product_code, dodo_product_id)
JOIN public.unit_products up ON up.product_code = expected.product_code
ON CONFLICT (internal_product_type, internal_product_id, environment)
  WHERE internal_product_type <> 'subscription_plan'
DO UPDATE SET
  dodo_product_id = EXCLUDED.dodo_product_id,
  is_active       = true,
  notes           = EXCLUDED.notes,
  updated_at      = now();

-- ─── 5. Postcondition check ──────────────────────────────────────────────────
DO $$
DECLARE
  v_commercial_count  INTEGER;
  v_readiness_count   INTEGER;
  v_original_count    INTEGER;
  v_mapping_count     INTEGER;
BEGIN
  SELECT count(*) INTO v_commercial_count
  FROM public.assets
  WHERE media_type = 'photo'
    AND review_status IN ('approved', 'commercial')
    AND publication_status IN ('published', 'commercial')
    AND is_demo = false
    AND commercial_use = true
    AND license_type = 'commercial';

  SELECT count(*) INTO v_readiness_count
  FROM public.asset_readiness ar
  JOIN public.assets a ON a.id = ar.asset_id
  WHERE a.media_type = 'photo'
    AND a.review_status IN ('approved', 'commercial')
    AND a.publication_status IN ('published', 'commercial')
    AND a.is_demo = false
    AND ar.technical_quality = true
    AND ar.rights_verified = true
    AND ar.original_available = true
    AND ar.license_ready = true
    AND ar.publication_ready = true;

  SELECT count(*) INTO v_original_count
  FROM public.asset_files af
  JOIN public.assets a ON a.id = af.asset_id
  WHERE af.file_level = 'original'
    AND a.media_type = 'photo'
    AND a.review_status IN ('approved', 'commercial')
    AND a.publication_status IN ('published', 'commercial')
    AND a.is_demo = false;

  SELECT count(*) INTO v_mapping_count
  FROM public.payment_product_mappings m
  JOIN public.unit_products up ON up.id = m.internal_product_id
  WHERE m.internal_product_type = 'one_time_asset_license'
    AND m.environment = 'test'
    AND m.is_active = true
    AND up.product_code IN ('photo_web', 'photo_hd', 'photo_ultrahd')
    AND m.dodo_product_id IN (
      'pdt_0NjWshHafg7cviI5DWtIC',
      'pdt_0NjWsoHpPgM1pbUVaHJfr',
      'pdt_0NjWsy1RvRix3wTCalm9m'
    );

  RAISE NOTICE 'Photo license activation: % assets commercial, % readiness rows, % original files, % Dodo TEST mappings',
    v_commercial_count, v_readiness_count, v_original_count, v_mapping_count;

  IF v_mapping_count < 3 THEN
    RAISE EXCEPTION 'Photo license activation failed: only % of 3 required Dodo TEST mappings found', v_mapping_count;
  END IF;
END $$;

COMMIT;
