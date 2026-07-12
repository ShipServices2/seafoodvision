-- MVP: contact_requests table
-- Stores contact form submissions from the public contact page

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  country TEXT,
  role TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON public.contact_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON public.contact_requests(status);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit a contact request
DROP POLICY IF EXISTS "public_can_insert_contact_requests" ON public.contact_requests;
CREATE POLICY "public_can_insert_contact_requests"
  ON public.contact_requests
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read contact requests
DROP POLICY IF EXISTS "admins_can_read_contact_requests" ON public.contact_requests;
CREATE POLICY "admins_can_read_contact_requests"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('administrator', 'super_admin')
    )
  );

-- Only admins can update contact request status
DROP POLICY IF EXISTS "admins_can_update_contact_requests" ON public.contact_requests;
CREATE POLICY "admins_can_update_contact_requests"
  ON public.contact_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('administrator', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('administrator', 'super_admin')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_contact_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_requests_updated_at ON public.contact_requests;
CREATE TRIGGER trg_contact_requests_updated_at
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_requests_updated_at();
