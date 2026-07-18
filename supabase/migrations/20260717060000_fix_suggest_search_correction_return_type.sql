-- ============================================================
-- Fix: suggest_search_correction return type mismatch
-- similarity() returns float4 (real) but RETURNS TABLE declares
-- similarity_score as float (float8). Cast explicitly to fix:
-- "structure of query does not match function result type"
-- ============================================================

DROP FUNCTION IF EXISTS public.suggest_search_correction(integer, text);
DROP FUNCTION IF EXISTS public.suggest_search_correction(text, integer);

CREATE OR REPLACE FUNCTION public.suggest_search_correction(
  max_suggestions integer DEFAULT 3,
  query_text      text    DEFAULT ''
)
RETURNS TABLE (
  suggestion       text,
  object_type      text,
  similarity_score double precision
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
           similarity(normalize_search_text(s.common_name), v_norm)::double precision AS sim
    FROM public.species s WHERE s.is_demo = false
    UNION ALL
    SELECT s.scientific_name, 'species'::text,
           similarity(normalize_search_text(s.scientific_name), v_norm)::double precision
    FROM public.species s WHERE s.is_demo = false AND s.scientific_name IS NOT NULL
    UNION ALL
    SELECT cp.public_name, 'product'::text,
           similarity(normalize_search_text(cp.public_name), v_norm)::double precision
    FROM public.commercial_products cp WHERE cp.is_public = true AND cp.is_demo = false
    UNION ALL
    SELECT m.name, 'market'::text,
           similarity(normalize_search_text(m.name), v_norm)::double precision
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
