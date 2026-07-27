-- ============================================================
-- SEAFOOD INTELLIGENCE HUB — Phase 1
-- Tables: hub_credit_costs, hub_ai_conversations, hub_business_services
-- ============================================================

-- 1. hub_credit_costs: admin-configurable credit costs per feature
CREATE TABLE IF NOT EXISTS public.hub_credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_label TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_credit_costs_feature_key ON public.hub_credit_costs(feature_key);

-- 2. hub_ai_conversations: stores AI Advisor Q&A per user/species
CREATE TABLE IF NOT EXISTS public.hub_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  species_id UUID REFERENCES public.species(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  mode TEXT NOT NULL DEFAULT 'simple' CHECK (mode IN ('simple', 'advanced')),
  credits_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_ai_conversations_user_id ON public.hub_ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_ai_conversations_species_id ON public.hub_ai_conversations(species_id);

-- 3. hub_business_services: services linked to species
CREATE TABLE IF NOT EXISTS public.hub_business_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID REFERENCES public.species(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  contact_info JSONB,
  url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_business_services_species_id ON public.hub_business_services(species_id);

-- 4. Enable RLS
ALTER TABLE public.hub_credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_business_services ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- hub_credit_costs: public read, admin write
DROP POLICY IF EXISTS "hub_credit_costs_public_read" ON public.hub_credit_costs;
CREATE POLICY "hub_credit_costs_public_read"
  ON public.hub_credit_costs FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "hub_credit_costs_admin_write" ON public.hub_credit_costs;
CREATE POLICY "hub_credit_costs_admin_write"
  ON public.hub_credit_costs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'super_admin'))
  );

-- hub_ai_conversations: users manage own
DROP POLICY IF EXISTS "hub_ai_conversations_own" ON public.hub_ai_conversations;
CREATE POLICY "hub_ai_conversations_own"
  ON public.hub_ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- hub_business_services: public read, admin write
DROP POLICY IF EXISTS "hub_business_services_public_read" ON public.hub_business_services;
CREATE POLICY "hub_business_services_public_read"
  ON public.hub_business_services FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "hub_business_services_admin_write" ON public.hub_business_services;
CREATE POLICY "hub_business_services_admin_write"
  ON public.hub_business_services FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('administrator', 'super_admin'))
  );

-- 6. Seed default credit costs
INSERT INTO public.hub_credit_costs (feature_key, feature_label, credits, description) VALUES
  ('ai_advisor_simple',       'AI Advisor — Simple question',       2, 'Single question to the Seafood AI Advisor'),
  ('ai_advisor_advanced',     'AI Advisor — Advanced question',     5, 'In-depth analysis by the Seafood AI Advisor'),
  ('global_map_advanced',     'Advanced global availability map',   1, 'Detailed worldwide availability map'),
  ('download_spec_sheet',     'Download spec sheet',                2, 'Download species technical specification sheet'),
  ('download_catalogue',      'Download catalogue',                 3, 'Download full product catalogue'),
  ('download_brochure',       'Download brochure',                  3, 'Download commercial brochure'),
  ('pdf_full_report',         'Full PDF report',                    5, 'Complete species intelligence PDF report'),
  ('species_comparison',      'Advanced species comparison',        3, 'Side-by-side advanced species comparison')
ON CONFLICT (feature_key) DO NOTHING;
