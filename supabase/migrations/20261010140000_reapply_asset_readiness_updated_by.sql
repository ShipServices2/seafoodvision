-- SeafoodVision — asset_readiness.updated_by, its foreign keys and indexes (re-application of 20260712200000).
--
-- The table exists but lacks updated_by (written by admin/reviews), the two foreign keys and two indexes of 20260712200000.
-- Idempotent; no DELETE, no UPDATE, no Dodo identifier. Checked read-only before writing this file: asset_readiness has no
-- orphan row (every asset_id exists in assets); updated_by is a new column, so it is NULL everywhere and cannot orphan.
-- A foreign key is skipped when an equivalent one already exists under another name.

BEGIN;

ALTER TABLE public.asset_readiness
  ADD COLUMN IF NOT EXISTS updated_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.asset_readiness'::regclass AND c.contype = 'f'
      AND c.confrelid = 'public.assets'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'asset_id')]
  ) THEN
    ALTER TABLE public.asset_readiness
      ADD CONSTRAINT fk_asset_readiness_asset
      FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.asset_readiness'::regclass AND c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'updated_by')]
  ) THEN
    ALTER TABLE public.asset_readiness
      ADD CONSTRAINT fk_asset_readiness_updater
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_asset_readiness_asset_id ON public.asset_readiness(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_readiness_completion ON public.asset_readiness(completion_pct DESC);

NOTIFY pgrst, 'reload schema';

COMMIT;
