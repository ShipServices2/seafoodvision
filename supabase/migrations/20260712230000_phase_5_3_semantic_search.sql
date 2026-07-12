-- ============================================================
-- PHASE 5.3 — SEMANTIC SEARCH & INTELLIGENT DISCOVERY
-- Migration: phase_5_3_semantic_search
-- ============================================================
-- SAFE: idempotent, no existing tables dropped or recreated
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. ANALYTICS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.search_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  query_text_normalized text NOT NULL,
  selected_result_type  text,
  selected_object_id    uuid,
  result_count          integer DEFAULT 0,
  locale                text DEFAULT 'en',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_zero_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized text NOT NULL,
  locale        text DEFAULT 'en',
  frequency     integer NOT NULL DEFAULT 1,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (query_normalized, locale)
);

-- ============================================================
-- 3. RLS ON ANALYTICS TABLES
-- ============================================================

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_zero_results ENABLE ROW LEVEL SECURITY;

-- search_events: anyone can insert (anonymous logging), only admins can read
DROP POLICY IF EXISTS "search_events_insert_public" ON public.search_events;
CREATE POLICY "search_events_insert_public" ON public.search_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "search_events_select_admin" ON public.search_events;
CREATE POLICY "search_events_select_admin" ON public.search_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('administrator', 'super_admin')
    )
  );

-- search_zero_results: insert/upsert public, read admin only
DROP POLICY IF EXISTS "search_zero_results_insert_public" ON public.search_zero_results;
CREATE POLICY "search_zero_results_insert_public" ON public.search_zero_results
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "search_zero_results_update_public" ON public.search_zero_results;
CREATE POLICY "search_zero_results_update_public" ON public.search_zero_results
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "search_zero_results_select_admin" ON public.search_zero_results;
CREATE POLICY "search_zero_results_select_admin" ON public.search_zero_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('administrator', 'super_admin')
    )
  );

-- ============================================================
-- 4. INDEXES FOR SEMANTIC SEARCH
-- ============================================================

-- species
CREATE INDEX IF NOT EXISTS idx_species_common_name_trgm
  ON public.species USING gin (common_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_species_scientific_name_trgm
  ON public.species USING gin (scientific_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_species_family_trgm
  ON public.species USING gin (family gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_species_fts
  ON public.species USING gin (
    to_tsvector('simple', coalesce(common_name,'') || ' ' || coalesce(scientific_name,'') || ' ' || coalesce(family,'') || ' ' || coalesce(description,''))
  );

-- species_names
CREATE INDEX IF NOT EXISTS idx_species_names_name_trgm
  ON public.species_names USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_species_names_lang
  ON public.species_names (language_code, name_type);

-- commercial_products
CREATE INDEX IF NOT EXISTS idx_commercial_products_name_trgm
  ON public.commercial_products USING gin (public_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_commercial_products_fts
  ON public.commercial_products USING gin (
    to_tsvector('simple', coalesce(public_name,'') || ' ' || coalesce(description,''))
  );

-- markets
CREATE INDEX IF NOT EXISTS idx_markets_name_trgm
  ON public.markets USING gin (name gin_trgm_ops);

-- certifications
CREATE INDEX IF NOT EXISTS idx_certifications_name_trgm
  ON public.certifications USING gin (name gin_trgm_ops);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON public.documents USING gin (public_title gin_trgm_ops);

-- knowledge_entities
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_name_trgm
  ON public.knowledge_entities USING gin (
    coalesce(canonical_name, label, '') gin_trgm_ops
  );

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_title_trgm
  ON public.assets USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_fts
  ON public.assets USING gin (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(product_form,'') || ' ' || coalesce(product_state,''))
  );

-- search_events
CREATE INDEX IF NOT EXISTS idx_search_events_created_at
  ON public.search_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_events_query
  ON public.search_events (query_text_normalized);

-- search_zero_results
CREATE INDEX IF NOT EXISTS idx_search_zero_results_query
  ON public.search_zero_results (query_normalized);
CREATE INDEX IF NOT EXISTS idx_search_zero_results_freq
  ON public.search_zero_results (frequency DESC);

-- ============================================================
-- 5. HELPER: normalize text (unaccent + lowercase + trim)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT lower(trim(regexp_replace(unaccent(input_text), '\s+', ' ', 'g')))
$$;

-- ============================================================
-- 6. MAIN SEARCH RPC: search_seafood_knowledge
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_seafood_knowledge(
  query_text        text,
  result_types      text[]    DEFAULT NULL,
  language_code     text      DEFAULT 'en',
  status_filter     text      DEFAULT NULL,
  verified_only     boolean   DEFAULT false,
  include_demo      boolean   DEFAULT false,
  p_page            integer   DEFAULT 1,
  p_page_size       integer   DEFAULT 20
)
RETURNS TABLE (
  object_type     text,
  object_id       uuid,
  slug            text,
  title           text,
  subtitle        text,
  excerpt         text,
  relevance_score float,
  match_type      text,
  matched_terms   text[],
  status          text,
  cover_image     text,
  updated_at      timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_norm      text;
  v_offset    integer;
  v_limit     integer;
BEGIN
  v_norm   := normalize_search_text(query_text);
  v_offset := (p_page - 1) * p_page_size;
  v_limit  := p_page_size;

  RETURN QUERY
  WITH candidates AS (

    -- ── LEVEL 1 & 2: Species exact + normalized + trgm ──────────────────
    SELECT
      'species'::text                                           AS obj_type,
      s.id                                                      AS obj_id,
      s.slug                                                    AS obj_slug,
      s.common_name                                             AS obj_title,
      s.scientific_name                                         AS obj_subtitle,
      left(coalesce(s.description,''), 200)                     AS obj_excerpt,
      CASE
        WHEN normalize_search_text(s.common_name) = v_norm     THEN 1.0
        WHEN normalize_search_text(s.scientific_name) = v_norm THEN 0.98
        WHEN s.common_name ILIKE '%' || query_text || '%'      THEN 0.85
        WHEN s.scientific_name ILIKE '%' || query_text || '%'  THEN 0.83
        WHEN s.family ILIKE '%' || query_text || '%'           THEN 0.60
        ELSE similarity(normalize_search_text(s.common_name), v_norm) * 0.7
      END                                                       AS score,
      CASE
        WHEN normalize_search_text(s.common_name) = v_norm     THEN 'exact'
        WHEN normalize_search_text(s.scientific_name) = v_norm THEN 'scientific_name'
        WHEN s.common_name ILIKE '%' || query_text || '%'      THEN 'commercial_name'
        WHEN s.scientific_name ILIKE '%' || query_text || '%'  THEN 'scientific_name'
        ELSE 'fuzzy'
      END                                                       AS match_t,
      ARRAY[s.common_name, s.scientific_name]                  AS m_terms,
      CASE WHEN s.is_validated THEN 'verified' ELSE 'unverified' END AS obj_status,
      NULL::text                                                AS cover_img,
      s.updated_at
    FROM public.species s
    WHERE
      (result_types IS NULL OR 'species' = ANY(result_types))
      AND (NOT verified_only OR s.is_validated = true)
      AND (include_demo OR s.is_demo = false)
      AND (
        normalize_search_text(s.common_name) = v_norm
        OR normalize_search_text(s.scientific_name) = v_norm
        OR s.common_name ILIKE '%' || query_text || '%'
        OR s.scientific_name ILIKE '%' || query_text || '%'
        OR s.family ILIKE '%' || query_text || '%'
        OR s.description ILIKE '%' || query_text || '%'
        OR similarity(normalize_search_text(s.common_name), v_norm) > 0.3
        OR similarity(normalize_search_text(s.scientific_name), v_norm) > 0.3
      )

    UNION ALL

    -- ── LEVEL 3: Species names (synonyms, translations, local names) ─────
    SELECT
      'species'::text,
      s.id,
      s.slug,
      s.common_name,
      sn.name || ' (' || sn.language_code || ')',
      left(coalesce(s.description,''), 200),
      CASE
        WHEN normalize_search_text(sn.name) = v_norm THEN 0.92
        WHEN sn.name ILIKE '%' || query_text || '%'  THEN 0.75
        ELSE 0.50
      END,
      CASE
        WHEN sn.name_type = 'scientific_synonym' THEN 'synonym'
        WHEN sn.language_code != 'en'            THEN 'translation'
        ELSE 'local_name'
      END,
      ARRAY[sn.name, s.common_name],
      CASE WHEN s.is_validated THEN 'verified' ELSE 'unverified' END,
      NULL::text,
      s.updated_at
    FROM public.species_names sn
    JOIN public.species s ON s.id = sn.species_id
    WHERE
      (result_types IS NULL OR 'species' = ANY(result_types))
      AND (NOT verified_only OR s.is_validated = true)
      AND (include_demo OR s.is_demo = false)
      AND sn.status IN ('verified', 'under_review')
      AND (
        normalize_search_text(sn.name) = v_norm
        OR sn.name ILIKE '%' || query_text || '%'
        OR similarity(normalize_search_text(sn.name), v_norm) > 0.35
      )

    UNION ALL

    -- ── Products ─────────────────────────────────────────────────────────
    SELECT
      'product'::text,
      cp.id,
      cp.slug,
      cp.public_name,
      NULL,
      left(coalesce(cp.description,''), 200),
      CASE
        WHEN normalize_search_text(cp.public_name) = v_norm THEN 0.95
        WHEN cp.public_name ILIKE '%' || query_text || '%'  THEN 0.80
        ELSE similarity(normalize_search_text(cp.public_name), v_norm) * 0.65
      END,
      CASE
        WHEN normalize_search_text(cp.public_name) = v_norm THEN 'exact'
        WHEN cp.public_name ILIKE '%' || query_text || '%'  THEN 'commercial_name'
        ELSE 'fuzzy'
      END,
      ARRAY[cp.public_name],
      cp.status,
      NULL::text,
      cp.updated_at
    FROM public.commercial_products cp
    WHERE
      (result_types IS NULL OR 'product' = ANY(result_types))
      AND cp.is_public = true
      AND (NOT verified_only OR cp.status = 'verified')
      AND (include_demo OR cp.is_demo = false)
      AND (
        normalize_search_text(cp.public_name) = v_norm
        OR cp.public_name ILIKE '%' || query_text || '%'
        OR cp.description ILIKE '%' || query_text || '%'
        OR similarity(normalize_search_text(cp.public_name), v_norm) > 0.3
      )

    UNION ALL

    -- ── Markets ──────────────────────────────────────────────────────────
    SELECT
      'market'::text,
      m.id,
      m.slug,
      m.name,
      m.market_type,
      left(coalesce(m.description,''), 200),
      CASE
        WHEN normalize_search_text(m.name) = v_norm THEN 0.95
        WHEN m.name ILIKE '%' || query_text || '%'  THEN 0.80
        ELSE 0.50
      END,
      CASE
        WHEN normalize_search_text(m.name) = v_norm THEN 'exact'
        ELSE 'keyword'
      END,
      ARRAY[m.name],
      m.status,
      NULL::text,
      m.updated_at
    FROM public.markets m
    WHERE
      (result_types IS NULL OR 'market' = ANY(result_types))
      AND m.is_public = true
      AND (NOT verified_only OR m.status = 'verified')
      AND (include_demo OR m.is_demo = false)
      AND (
        normalize_search_text(m.name) = v_norm
        OR m.name ILIKE '%' || query_text || '%'
        OR m.description ILIKE '%' || query_text || '%'
        OR m.region ILIKE '%' || query_text || '%'
      )

    UNION ALL

    -- ── Certifications ───────────────────────────────────────────────────
    SELECT
      'certification'::text,
      c.id,
      c.slug,
      c.name,
      c.certification_type,
      left(coalesce(c.description,''), 200),
      CASE
        WHEN normalize_search_text(c.name) = v_norm THEN 0.95
        WHEN c.name ILIKE '%' || query_text || '%'  THEN 0.80
        ELSE 0.50
      END,
      CASE
        WHEN normalize_search_text(c.name) = v_norm THEN 'exact'
        ELSE 'keyword'
      END,
      ARRAY[c.name],
      c.status,
      NULL::text,
      c.updated_at
    FROM public.certifications c
    WHERE
      (result_types IS NULL OR 'certification' = ANY(result_types))
      AND c.is_public = true
      AND (NOT verified_only OR c.status = 'verified')
      AND (
        normalize_search_text(c.name) = v_norm
        OR c.name ILIKE '%' || query_text || '%'
        OR c.description ILIKE '%' || query_text || '%'
        OR c.issuing_body ILIKE '%' || query_text || '%'
      )

    UNION ALL

    -- ── Documents (public only) ──────────────────────────────────────────
    SELECT
      'document'::text,
      d.id,
      NULL::text,
      d.public_title,
      dt.name,
      NULL::text,
      CASE
        WHEN normalize_search_text(d.public_title) = v_norm THEN 0.90
        WHEN d.public_title ILIKE '%' || query_text || '%'  THEN 0.75
        ELSE 0.45
      END,
      CASE
        WHEN normalize_search_text(d.public_title) = v_norm THEN 'exact'
        ELSE 'description'
      END,
      ARRAY[d.public_title],
      d.status,
      NULL::text,
      d.updated_at
    FROM public.documents d
    LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
    WHERE
      (result_types IS NULL OR 'document' = ANY(result_types))
      AND d.is_public = true
      AND d.confidentiality_level = 'public'
      AND (NOT verified_only OR d.status = 'verified')
      AND (include_demo OR d.is_demo = false)
      AND (
        normalize_search_text(d.public_title) = v_norm
        OR d.public_title ILIKE '%' || query_text || '%'
        OR d.issuing_body ILIKE '%' || query_text || '%'
      )

    UNION ALL

    -- ── Media assets ─────────────────────────────────────────────────────
    SELECT
      'media'::text,
      a.id,
      a.slug,
      a.title,
      a.category,
      left(coalesce(a.description,''), 200),
      CASE
        WHEN normalize_search_text(a.title) = v_norm THEN 0.88
        WHEN a.title ILIKE '%' || query_text || '%'  THEN 0.72
        ELSE 0.45
      END,
      CASE
        WHEN normalize_search_text(a.title) = v_norm THEN 'exact'
        ELSE 'description'
      END,
      ARRAY[a.title],
      a.review_status,
      NULL::text,
      a.updated_at
    FROM public.assets a
    WHERE
      (result_types IS NULL OR 'media' = ANY(result_types))
      AND a.publication_status IN ('approved', 'commercial', 'editorial')
      AND (include_demo OR a.is_demo = false)
      AND (
        normalize_search_text(a.title) = v_norm
        OR a.title ILIKE '%' || query_text || '%'
        OR a.description ILIKE '%' || query_text || '%'
        OR a.product_form ILIKE '%' || query_text || '%'
        OR a.product_state ILIKE '%' || query_text || '%'
        OR a.category ILIKE '%' || query_text || '%'
      )

    UNION ALL

    -- ── LEVEL 4: Knowledge Graph relations ──────────────────────────────
    SELECT
      'knowledge_entity'::text,
      ke.id,
      ke.slug,
      coalesce(ke.canonical_name, ke.label),
      ke.entity_type,
      left(coalesce(ke.description,''), 200),
      0.55,
      'related_entity',
      ARRAY[coalesce(ke.canonical_name, ke.label)],
      ke.status::text,
      NULL::text,
      ke.updated_at
    FROM public.knowledge_entities ke
    WHERE
      (result_types IS NULL OR 'knowledge_entity' = ANY(result_types))
      AND ke.is_public = true
      AND ke.status IN ('verified', 'under_review')
      AND (include_demo OR ke.is_demo = false)
      AND (
        coalesce(ke.canonical_name, ke.label) ILIKE '%' || query_text || '%'
        OR ke.description ILIKE '%' || query_text || '%'
      )

  ),
  -- Deduplicate by (obj_type, obj_id), keep highest score
  deduped AS (
    SELECT DISTINCT ON (obj_type, obj_id)
      obj_type, obj_id, obj_slug, obj_title, obj_subtitle,
      obj_excerpt, score, match_t, m_terms, obj_status, cover_img, updated_at
    FROM candidates
    ORDER BY obj_type, obj_id, score DESC
  )
  SELECT
    d.obj_type,
    d.obj_id,
    d.obj_slug,
    d.obj_title,
    d.obj_subtitle,
    d.obj_excerpt,
    d.score,
    d.match_t,
    d.m_terms,
    d.obj_status,
    d.cover_img,
    d.updated_at
  FROM deduped d
  ORDER BY d.score DESC, d.obj_title ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- ============================================================
-- 7. AUTOCOMPLETE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.autocomplete_seafood(
  query_text  text,
  max_results integer DEFAULT 8
)
RETURNS TABLE (
  object_type text,
  object_id   uuid,
  slug        text,
  title       text,
  subtitle    text,
  is_verified boolean
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
  WITH ac AS (
    SELECT 'species'::text AS ot, s.id, s.slug, s.common_name AS t, s.scientific_name AS st, s.is_validated AS iv,
           CASE WHEN normalize_search_text(s.common_name) LIKE v_norm || '%' THEN 1.0
                WHEN s.common_name ILIKE query_text || '%' THEN 0.9
                ELSE 0.6 END AS sc
    FROM public.species s
    WHERE s.is_demo = false
      AND (s.common_name ILIKE query_text || '%' OR s.common_name ILIKE '%' || query_text || '%'
           OR similarity(normalize_search_text(s.common_name), v_norm) > 0.35)
    LIMIT 4

    UNION ALL

    SELECT 'product'::text, cp.id, cp.slug, cp.public_name, NULL, cp.status = 'verified',
           CASE WHEN cp.public_name ILIKE query_text || '%' THEN 0.85 ELSE 0.55 END
    FROM public.commercial_products cp
    WHERE cp.is_public = true AND cp.is_demo = false
      AND cp.public_name ILIKE '%' || query_text || '%'
    LIMIT 3

    UNION ALL

    SELECT 'market'::text, m.id, m.slug, m.name, m.market_type, m.status = 'verified',
           CASE WHEN m.name ILIKE query_text || '%' THEN 0.80 ELSE 0.50 END
    FROM public.markets m
    WHERE m.is_public = true AND m.is_demo = false
      AND m.name ILIKE '%' || query_text || '%'
    LIMIT 2

    UNION ALL

    SELECT 'certification'::text, c.id, c.slug, c.name, c.certification_type, c.status = 'verified',
           CASE WHEN c.name ILIKE query_text || '%' THEN 0.80 ELSE 0.50 END
    FROM public.certifications c
    WHERE c.is_public = true
      AND c.name ILIKE '%' || query_text || '%'
    LIMIT 2

    UNION ALL

    SELECT 'species_name'::text, s.id, s.slug, sn.name, s.common_name, s.is_validated,
           0.70
    FROM public.species_names sn
    JOIN public.species s ON s.id = sn.species_id
    WHERE sn.status IN ('verified', 'under_review')
      AND s.is_demo = false
      AND sn.name ILIKE '%' || query_text || '%'
    LIMIT 3
  )
  SELECT DISTINCT ON (ot, id)
    ot, id, slug, t, st, iv
  FROM ac
  ORDER BY ot, id, sc DESC
  LIMIT max_results;
END;
$$;

-- ============================================================
-- 8. FUZZY SUGGESTION RPC (Did you mean?)
-- ============================================================
CREATE OR REPLACE FUNCTION public.suggest_search_correction(
  query_text text,
  max_suggestions integer DEFAULT 3
)
RETURNS TABLE (
  suggestion  text,
  object_type text,
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
    FROM public.species s WHERE s.is_demo = false
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

-- ============================================================
-- 9. LOG SEARCH EVENT (safe, no secrets)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_search_event(
  p_query       text,
  p_result_count integer DEFAULT 0,
  p_locale      text DEFAULT 'en',
  p_result_type text DEFAULT NULL,
  p_object_id   uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := normalize_search_text(p_query);
  -- Skip empty or very short queries
  IF length(v_norm) < 2 THEN RETURN; END IF;

  INSERT INTO public.search_events (
    user_id, query_text_normalized, selected_result_type,
    selected_object_id, result_count, locale
  ) VALUES (
    auth.uid(), v_norm, p_result_type, p_object_id, p_result_count, p_locale
  );

  -- Track zero-result queries
  IF p_result_count = 0 THEN
    INSERT INTO public.search_zero_results (query_normalized, locale, frequency, last_seen_at)
    VALUES (v_norm, p_locale, 1, now())
    ON CONFLICT (query_normalized, locale)
    DO UPDATE SET
      frequency = search_zero_results.frequency + 1,
      last_seen_at = now();
  END IF;
END;
$$;

-- ============================================================
-- 10. ADMIN SEARCH ANALYTICS VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.search_analytics_summary AS
SELECT
  date_trunc('day', created_at)::date AS search_date,
  locale,
  count(*)                            AS total_searches,
  count(DISTINCT query_text_normalized) AS unique_queries,
  sum(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) AS zero_result_count,
  avg(result_count)::numeric(10,2)    AS avg_results
FROM public.search_events
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ============================================================
-- 11. GRANT EXECUTE ON RPC FUNCTIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.search_seafood_knowledge TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autocomplete_seafood TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_search_correction TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_search_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_search_text TO anon, authenticated;
