-- ============================================================
-- SEAFOOD VISION — Extend sie_validation_action enum
-- Add 'human_validated', 'bulk_human_validated', 'mark_unknown',
-- 'reject_candidate' to support all validation workflow actions
-- ============================================================

-- Extend the enum with new values (safe — only adds, never removes)
DO $$ BEGIN
  ALTER TYPE public.sie_validation_action ADD VALUE IF NOT EXISTS 'human_validated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.sie_validation_action ADD VALUE IF NOT EXISTS 'bulk_human_validated';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.sie_validation_action ADD VALUE IF NOT EXISTS 'mark_unknown';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.sie_validation_action ADD VALUE IF NOT EXISTS 'reject_candidate';
EXCEPTION WHEN others THEN NULL; END $$;

-- Also extend sie_job_status to include partially_validated (used in UI filters)
DO $$ BEGIN
  ALTER TYPE public.sie_job_status ADD VALUE IF NOT EXISTS 'partially_validated';
EXCEPTION WHEN others THEN NULL; END $$;

-- Add reviewer_name to sie_validation_history if missing
ALTER TABLE public.sie_validation_history
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS new_value TEXT,
  ADD COLUMN IF NOT EXISTS previous_value TEXT;
