-- STAGING ONLY: minimal reference graph to model production Gmail imports.
-- Existing production email_imports table is NOT changed by this fixture.
CREATE TABLE IF NOT EXISTS public.email_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY stage_email_imports_owner ON public.email_imports
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_imports TO authenticated;
