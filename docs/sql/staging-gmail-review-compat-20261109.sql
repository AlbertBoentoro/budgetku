-- STAGING ONLY. The budgetku-staging database has a deliberately minimal
-- Gmail fixture schema. Align it with production metadata for PR review.
-- Never apply this to production; production already has these structures.
-- No production user data/tokens are copied into staging.
BEGIN;
CREATE TABLE IF NOT EXISTS public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'gmail'
    CONSTRAINT email_connections_provider_check CHECK (provider = 'gmail'),
  email_address text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CONSTRAINT email_connections_status_check CHECK (status IN ('active','disconnected','error')),
  sync_cursor text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_connections_user_id_provider_email_address_key
    UNIQUE (user_id, provider, email_address)
);
CREATE UNIQUE INDEX IF NOT EXISTS email_connections_user_id_id_uidx
 ON public.email_connections (user_id,id);
CREATE INDEX IF NOT EXISTS email_connections_user_idx
 ON public.email_connections (user_id);

CREATE TABLE IF NOT EXISTS public.email_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.email_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_connection_secrets_user_id_connection_id_fkey
    FOREIGN KEY (user_id,connection_id)
    REFERENCES public.email_connections(user_id,id) ON DELETE CASCADE
);

-- Staging starts with an empty minimal email_imports table; fail closed if
-- someone added draft rows between initial inspection and this migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.email_imports) THEN
    RAISE EXCEPTION 'Staging email_imports is not empty: inspect before upgrading';
  END IF;
END $$;
ALTER TABLE public.email_imports
  ADD COLUMN IF NOT EXISTS connection_id uuid,
  ADD COLUMN IF NOT EXISTS gmail_thread_id text,
  ADD COLUMN IF NOT EXISTS sender text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS parsed_preview jsonb;
ALTER TABLE public.email_imports
  ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE public.email_imports
  ADD CONSTRAINT email_imports_user_id_connection_id_fkey
  FOREIGN KEY (user_id,connection_id)
  REFERENCES public.email_connections(user_id,id) ON DELETE CASCADE;
ALTER TABLE public.email_imports
  ADD CONSTRAINT email_imports_status_check
  CHECK (status IN ('pending','imported','skipped','failed'));
ALTER TABLE public.email_imports
  ADD CONSTRAINT email_imports_connection_id_gmail_message_id_key
  UNIQUE (connection_id,gmail_message_id);
CREATE INDEX IF NOT EXISTS email_imports_status_idx
 ON public.email_imports (user_id,status);
CREATE INDEX IF NOT EXISTS email_imports_received_idx
 ON public.email_imports (user_id,received_at DESC);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_email_connections_owner"
 ON public.email_connections FOR ALL TO authenticated
 USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "stage_email_connection_secrets_owner"
 ON public.email_connection_secrets FOR ALL TO authenticated
 USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_connections TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_connection_secrets TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_imports TO authenticated;
REVOKE ALL ON public.email_connections FROM anon;
REVOKE ALL ON public.email_connection_secrets FROM anon;
REVOKE ALL ON public.email_imports FROM anon;
COMMIT;
