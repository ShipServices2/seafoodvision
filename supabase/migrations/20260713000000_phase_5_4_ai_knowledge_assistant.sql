-- ============================================================
-- PHASE 5.4 — AI KNOWLEDGE ASSISTANT
-- Minimal migration: assistant tables, indexes, RLS, functions
-- Does NOT recreate any previous tables
-- ============================================================

-- ---- 1. TYPES ----

DROP TYPE IF EXISTS public.assistant_message_role CASCADE;
CREATE TYPE public.assistant_message_role AS ENUM ('user', 'assistant', 'system');

DROP TYPE IF EXISTS public.assistant_confidence_level CASCADE;
CREATE TYPE public.assistant_confidence_level AS ENUM ('high', 'moderate', 'limited', 'none');

DROP TYPE IF EXISTS public.assistant_feedback_type CASCADE;
CREATE TYPE public.assistant_feedback_type AS ENUM (
  'helpful', 'not_helpful', 'incorrect', 'missing_information',
  'outdated_information', 'citation_problem', 'other'
);

DROP TYPE IF EXISTS public.assistant_unanswered_status CASCADE;
CREATE TYPE public.assistant_unanswered_status AS ENUM (
  'open', 'assigned', 'resolved', 'wont_fix'
);

DROP TYPE IF EXISTS public.assistant_source_type CASCADE;
CREATE TYPE public.assistant_source_type AS ENUM (
  'species', 'product', 'packaging', 'market', 'certification',
  'document', 'media', 'claim', 'source', 'relation'
);

-- ---- 2. TABLES ----

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_session_id TEXT,
  title TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'active',
  context_entities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role public.assistant_message_role NOT NULL,
  content TEXT NOT NULL,
  structured_content JSONB,
  confidence_level public.assistant_confidence_level,
  provider_mode TEXT NOT NULL DEFAULT 'retrieval_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_message_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  source_type public.assistant_source_type NOT NULL,
  source_id TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT,
  claim_id UUID,
  relevance_score NUMERIC(4,3) DEFAULT 1.0,
  citation_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id UUID NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  feedback_type public.assistant_feedback_type NOT NULL,
  reason TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_question TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.assistant_unanswered_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  failure_reason TEXT,
  probable_entities JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.assistant_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_session_id TEXT,
  event_type TEXT NOT NULL,
  model_provider TEXT,
  token_count INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assistant_saved_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- 3. INDEXES ----

CREATE INDEX IF NOT EXISTS idx_asst_conversations_user_id ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_asst_conversations_anon ON public.assistant_conversations(anonymous_session_id);
CREATE INDEX IF NOT EXISTS idx_asst_conversations_status ON public.assistant_conversations(status);
CREATE INDEX IF NOT EXISTS idx_asst_messages_conversation ON public.assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_asst_messages_created ON public.assistant_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_asst_sources_message ON public.assistant_message_sources(message_id);
CREATE INDEX IF NOT EXISTS idx_asst_feedback_message ON public.assistant_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_asst_feedback_user ON public.assistant_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_asst_unanswered_status ON public.assistant_unanswered_questions(status);
CREATE INDEX IF NOT EXISTS idx_asst_unanswered_locale ON public.assistant_unanswered_questions(locale);
CREATE INDEX IF NOT EXISTS idx_asst_usage_user ON public.assistant_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_asst_usage_created ON public.assistant_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_asst_saved_user ON public.assistant_saved_answers(user_id);

-- ---- 4. FUNCTIONS ----

CREATE OR REPLACE FUNCTION public.assistant_update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.assistant_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_upsert_unanswered(
  p_question TEXT,
  p_locale TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.assistant_unanswered_questions
    (normalized_question, locale, occurrence_count, first_seen_at, last_seen_at)
  VALUES (p_question, p_locale, 1, now(), now())
  ON CONFLICT (normalized_question, locale)
  DO UPDATE SET
    occurrence_count = public.assistant_unanswered_questions.occurrence_count + 1,
    last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_get_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_conversations', (SELECT COUNT(*) FROM public.assistant_conversations),
    'total_messages', (SELECT COUNT(*) FROM public.assistant_messages WHERE role = 'user'),
    'unanswered_open', (SELECT COUNT(*) FROM public.assistant_unanswered_questions WHERE status = 'open'),
    'feedback_positive', (SELECT COUNT(*) FROM public.assistant_feedback WHERE feedback_type = 'helpful'),
    'feedback_negative', (SELECT COUNT(*) FROM public.assistant_feedback WHERE feedback_type != 'helpful'),
    'avg_latency_ms', (SELECT ROUND(AVG(latency_ms)) FROM public.assistant_usage_events WHERE success = true),
    'top_locales', (
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT locale, COUNT(*) AS cnt
        FROM public.assistant_conversations
        GROUP BY locale
        ORDER BY cnt DESC
        LIMIT 5
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- ---- 5. UNIQUE CONSTRAINT for unanswered questions ----

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_asst_unanswered_question_locale'
  ) THEN
    ALTER TABLE public.assistant_unanswered_questions
    ADD CONSTRAINT uq_asst_unanswered_question_locale
    UNIQUE (normalized_question, locale);
  END IF;
END $$;

-- ---- 6. ENABLE RLS ----

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_message_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_saved_answers ENABLE ROW LEVEL SECURITY;

-- ---- 7. RLS POLICIES ----

-- assistant_conversations
DROP POLICY IF EXISTS "asst_conv_user_own" ON public.assistant_conversations;
CREATE POLICY "asst_conv_user_own"
ON public.assistant_conversations
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "asst_conv_anon_insert" ON public.assistant_conversations;
CREATE POLICY "asst_conv_anon_insert"
ON public.assistant_conversations
FOR INSERT TO public
WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "asst_conv_anon_select" ON public.assistant_conversations;
CREATE POLICY "asst_conv_anon_select"
ON public.assistant_conversations
FOR SELECT TO public
USING (user_id IS NULL);

-- assistant_messages (readable if conversation is accessible)
DROP POLICY IF EXISTS "asst_msg_public_read" ON public.assistant_messages;
CREATE POLICY "asst_msg_public_read"
ON public.assistant_messages
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "asst_msg_insert" ON public.assistant_messages;
CREATE POLICY "asst_msg_insert"
ON public.assistant_messages
FOR INSERT TO public
WITH CHECK (true);

-- assistant_message_sources (public read)
DROP POLICY IF EXISTS "asst_sources_public_read" ON public.assistant_message_sources;
CREATE POLICY "asst_sources_public_read"
ON public.assistant_message_sources
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "asst_sources_insert" ON public.assistant_message_sources;
CREATE POLICY "asst_sources_insert"
ON public.assistant_message_sources
FOR INSERT TO public
WITH CHECK (true);

-- assistant_feedback
DROP POLICY IF EXISTS "asst_feedback_user_own" ON public.assistant_feedback;
CREATE POLICY "asst_feedback_user_own"
ON public.assistant_feedback
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "asst_feedback_anon_insert" ON public.assistant_feedback;
CREATE POLICY "asst_feedback_anon_insert"
ON public.assistant_feedback
FOR INSERT TO public
WITH CHECK (user_id IS NULL);

-- assistant_unanswered_questions (admin only)
DROP POLICY IF EXISTS "asst_unanswered_admin" ON public.assistant_unanswered_questions;
CREATE POLICY "asst_unanswered_admin"
ON public.assistant_unanswered_questions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('administrator', 'super_admin', 'reviewer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('administrator', 'super_admin', 'reviewer')
  )
);

DROP POLICY IF EXISTS "asst_unanswered_insert_public" ON public.assistant_unanswered_questions;
CREATE POLICY "asst_unanswered_insert_public"
ON public.assistant_unanswered_questions
FOR INSERT TO public
WITH CHECK (true);

-- assistant_usage_events
DROP POLICY IF EXISTS "asst_usage_insert" ON public.assistant_usage_events;
CREATE POLICY "asst_usage_insert"
ON public.assistant_usage_events
FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "asst_usage_admin_read" ON public.assistant_usage_events;
CREATE POLICY "asst_usage_admin_read"
ON public.assistant_usage_events
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('administrator', 'super_admin')
  )
);

-- assistant_saved_answers
DROP POLICY IF EXISTS "asst_saved_user_own" ON public.assistant_saved_answers;
CREATE POLICY "asst_saved_user_own"
ON public.assistant_saved_answers
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---- 8. TRIGGERS ----

DROP TRIGGER IF EXISTS asst_update_conv_timestamp ON public.assistant_messages;
CREATE TRIGGER asst_update_conv_timestamp
AFTER INSERT ON public.assistant_messages
FOR EACH ROW
EXECUTE FUNCTION public.assistant_update_conversation_timestamp();
