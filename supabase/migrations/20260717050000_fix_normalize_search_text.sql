-- ============================================================
-- Fix: normalize_search_text function missing from database
-- This function is required by suggest_search_correction and
-- search_seafood_knowledge RPCs.
-- ============================================================

-- 1. Ensure unaccent extension is available
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Recreate normalize_search_text (idempotent)
CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT lower(trim(regexp_replace(unaccent(input_text), '\s+', ' ', 'g')))
$$;

GRANT EXECUTE ON FUNCTION public.normalize_search_text TO anon, authenticated;

-- 3. Recreate suggest_search_correction using normalize_search_text
--    Params in alphabetical order (max_suggestions, query_text) so
--    PostgREST named-param resolution works correctly.
DROP FUNCTION IF EXISTS public.suggest_search_correction(text, integer);
DROP FUNCTION IF EXISTS public.suggest_search_correction(integer, text);

CREATE OR REPLACE FUNCTION public.suggest_search_correction(
  max_suggestions integer DEFAULT 3,
  query_text      text    DEFAULT ''
)
RETURNS TABLE (
  suggestion       text,
  object_type      text,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := normalize_search_text(query_text);

  RETURN QUERY
  WITH candidates AS (
    SELECT s.common_name AS term, 'species'::text AS ot,
           similarity(normalize_search_text(s.common_name), v_norm) AS sim
    FROM public.species s WHERE s.is_demo = false
    UNION ALL
    SELECT s.scientific_name, 'species'::text,
           similarity(normalize_search_text(s.scientific_name), v_norm)
    FROM public.species s WHERE s.is_demo = false AND s.scientific_name IS NOT NULL
    UNION ALL
    SELECT cp.public_name, 'product'::text,
           similarity(normalize_search_text(cp.public_name), v_norm)
    FROM public.commercial_products cp WHERE cp.is_public = true AND cp.is_demo = false
    UNION ALL
    SELECT m.name, 'market'::text,
           similarity(normalize_search_text(m.name), v_norm)
    FROM public.markets m WHERE m.is_public = true AND m.is_demo = false
  )
  SELECT term, ot, sim
  FROM candidates
  WHERE sim > 0.25
    AND normalize_search_text(term) != v_norm
  ORDER BY sim DESC
  LIMIT max_suggestions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_search_correction(integer, text) TO anon, authenticated;
