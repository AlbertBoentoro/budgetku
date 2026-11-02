-- Synthetic staging-only Gmail linkage fixture for read-only restore preview.
-- No credentials, OAuth tokens or actual Gmail messages are stored.
CREATE TABLE IF NOT EXISTS public.email_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY stage_email_imports_select ON public.email_imports
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY stage_email_imports_insert ON public.email_imports
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY stage_email_imports_update ON public.email_imports
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY stage_email_imports_delete ON public.email_imports
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_imports TO authenticated;
