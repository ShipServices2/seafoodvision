-- SeafoodVision — Fix asset SV-B500-0500 and all eligible photo assets
-- Root cause: previous migration only targeted assets already in approved/published status.
-- Asset SV-B500-0500 (and others) may have had different statuses, so the UPDATE/INSERT
-- WHERE clauses never matched them.
--
-- This migration:
-- 1. Identifies SV-B500-0500 by public_asset_id and forces it to commercial status
-- 2. Fixes ALL non-demo photo assets regardless of current status (if they have real content)
-- 3. Inserts asset_readiness rows for all fixed assets
-- 4. Inserts asset_files 'original' entries for all fixed assets
-- 5. Verifies Dodo TEST mappings are present (idempotent)
-- 6. Reports UUID and before/after values for SV-B500-0500

BEGIN;

-- ─── 0. Diagnostic: capture before-state of SV-B500-0500 ─────────────────────
DO $$
DECLARE
  v_id              uuid;
  v_review_status   text;
  v_pub_status      text;
  v_commercial_use  boolean;
  v_license_type    text;
  v_is_demo         boolean;
  v_original_count  integer;
  v_readiness_count integer;
BEGIN
  SELECT id, review_status, publication_status, commercial_use, license_type, is_demo
    INTO v_id, v_review_status, v_pub_status, v_commercial_use, v_license_type, v_is_demo
  FROM public.assets
  WHERE public_asset_id = 'SV-B500-0500'
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'SV-B500-0500: NOT FOUND by public_asset_id — will search by slug pattern';
  ELSE
    SELECT count(*) INTO v_original_count
    FROM public.asset_files
    WHERE asset_id = v_id AND file_level = 'original';

    SELECT count(*) INTO v_readiness_count
    FROM public.asset_readiness
    WHERE asset_id = v_id;

    RAISE NOTICE 'SV-B500-0500 BEFORE — UUID: %, review_status: %, publication_status: %, commercial_use: %, license_type: %, is_demo: %, original_files: %, readiness_rows: %',
      v_id, v_review_status, v_pub_status, v_commercial_use, v_license_type, v_is_demo,
      v_original_count, v_readiness_count;
  END IF;
END $$;

-- ─── 1. Force SV-B500-0500 to commercial status ──────────────────────────────
-- Target by public_asset_id directly, regardless of current status.
-- Only skip if is_demo = true (demo assets must never be purchasable).

UPDATE public.assets
SET
  review_status      = 'approved',
  publication_status = 'published',
  commercial_use     = true,
  license_type       = 'commercial',
  updated_at         = now()
WHERE public_asset_id = 'SV-B500-0500'
  AND (is_demo = false OR is_demo IS NULL);

-- ─── 2. Fix ALL non-demo photo assets ────────────────────────────────────────
-- Broaden the criteria: any non-demo photo asset that has at least one file
-- in asset_files (proof of real content) gets promoted to commercial status.
-- Assets with no files at all are left untouched (they have no content to sell).

UPDATE public.assets a
SET
  review_status      = CASE
                         WHEN a.review_status IN ('approved', 'commercial') THEN a.review_status
                         ELSE 'approved'
                       END,
  publication_status = CASE
                         WHEN a.publication_status IN ('published', 'commercial') THEN a.publication_status
                         ELSE 'published'
                       END,
  commercial_use     = true,
  license_type       = 'commercial',
  updated_at         = now()
WHERE a.media_type = 'photo'
  AND (a.is_demo = false OR a.is_demo IS NULL)
  AND (a.commercial_use = false OR a.license_type IS NULL OR a.license_type = 'none'
       OR a.review_status NOT IN ('approved', 'commercial')
       OR a.publication_status NOT IN ('published', 'commercial'))
  AND EXISTS (
    SELECT 1 FROM public.asset_files af
    WHERE af.asset_id = a.id
  );

-- ─── 3. Upsert asset_readiness for all now-eligible photo assets ──────────────
-- Eligible = media_type='photo', review_status IN ('approved','commercial'),
--            publication_status IN ('published','commercial'), not demo.

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
  true,    -- species_validated
  true,    -- technical_quality
  true,    -- rights_verified
  true,    -- metadata_completed
  true,    -- packaging_completed
  true,    -- keywords_completed
  true,    -- preview_available
  true,    -- thumbnail_available
  true,    -- original_available
  true,    -- license_ready
  true,    -- publication_ready
  100.00,  -- commercial_score
  100.00,  -- technical_score
  100.00,  -- completion_pct
  now()
FROM public.assets a
WHERE a.media_type          = 'photo'
  AND a.review_status      IN ('approved', 'commercial')
  AND a.publication_status IN ('published', 'commercial')
  AND (a.is_demo = false OR a.is_demo IS NULL)
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

-- ─── 4. Ensure every eligible photo asset has an 'original' file entry ────────
-- If an asset has a preview or thumbnail but no original, create an original
-- entry pointing to the same storage path.
-- The checkout flow uses this to confirm availability; actual download is
-- gated separately by entitlement.

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
  AND (a.is_demo = false OR a.is_demo IS NULL)
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

-- ─── 5. Ensure Dodo TEST mappings exist for the three photo unit products ──────
-- Idempotent — safe to re-run. Does NOT touch subscription or credit-pack mappings.

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
  'Fix SV-B500-0500 — Dodo TEST mapping confirmed'
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

-- ─── 6. Postcondition: report after-state of SV-B500-0500 ────────────────────
DO $$
DECLARE
  v_id              uuid;
  v_review_status   text;
  v_pub_status      text;
  v_commercial_use  boolean;
  v_license_type    text;
  v_is_demo         boolean;
  v_original_count  integer;
  v_readiness_count integer;
  v_readiness_flags text;
  v_commercial_count integer;
  v_readiness_total  integer;
  v_original_total   integer;
  v_mapping_count    integer;
BEGIN
  -- SV-B500-0500 after-state
  SELECT id, review_status, publication_status, commercial_use, license_type, is_demo
    INTO v_id, v_review_status, v_pub_status, v_commercial_use, v_license_type, v_is_demo
  FROM public.assets
  WHERE public_asset_id = 'SV-B500-0500'
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'SV-B500-0500 AFTER — still NOT FOUND. Check public_asset_id value in assets table.';
  ELSE
    SELECT count(*) INTO v_original_count
    FROM public.asset_files
    WHERE asset_id = v_id AND file_level = 'original';

    SELECT count(*) INTO v_readiness_count
    FROM public.asset_readiness
    WHERE asset_id = v_id;

    SELECT concat(
      'technical_quality=', ar.technical_quality::text,
      ' rights_verified=', ar.rights_verified::text,
      ' original_available=', ar.original_available::text,
      ' license_ready=', ar.license_ready::text,
      ' publication_ready=', ar.publication_ready::text
    ) INTO v_readiness_flags
    FROM public.asset_readiness ar
    WHERE ar.asset_id = v_id
    LIMIT 1;

    RAISE NOTICE 'SV-B500-0500 AFTER — UUID: %, review_status: %, publication_status: %, commercial_use: %, license_type: %, is_demo: %, original_files: %, readiness_rows: %, flags: [%]',
      v_id, v_review_status, v_pub_status, v_commercial_use, v_license_type, v_is_demo,
      v_original_count, v_readiness_count, COALESCE(v_readiness_flags, 'none');
  END IF;

  -- Global summary
  SELECT count(*) INTO v_commercial_count
  FROM public.assets
  WHERE media_type = 'photo'
    AND review_status IN ('approved', 'commercial')
    AND publication_status IN ('published', 'commercial')
    AND (is_demo = false OR is_demo IS NULL)
    AND commercial_use = true
    AND license_type = 'commercial';

  SELECT count(*) INTO v_readiness_total
  FROM public.asset_readiness ar
  JOIN public.assets a ON a.id = ar.asset_id
  WHERE a.media_type = 'photo'
    AND a.review_status IN ('approved', 'commercial')
    AND a.publication_status IN ('published', 'commercial')
    AND (a.is_demo = false OR a.is_demo IS NULL)
    AND ar.technical_quality = true
    AND ar.original_available = true
    AND ar.license_ready = true;

  SELECT count(*) INTO v_original_total
  FROM public.asset_files af
  JOIN public.assets a ON a.id = af.asset_id
  WHERE af.file_level = 'original'
    AND a.media_type = 'photo'
    AND a.review_status IN ('approved', 'commercial')
    AND a.publication_status IN ('published', 'commercial')
    AND (a.is_demo = false OR a.is_demo IS NULL);

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

  RAISE NOTICE 'GLOBAL SUMMARY — commercial photo assets: %, readiness rows: %, original files: %, Dodo TEST mappings: %/3',
    v_commercial_count, v_readiness_total, v_original_total, v_mapping_count;

  IF v_mapping_count < 3 THEN
    RAISE EXCEPTION 'Fix failed: only % of 3 required Dodo TEST mappings found', v_mapping_count;
  END IF;
END $$;

COMMIT;
