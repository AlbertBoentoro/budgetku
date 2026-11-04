-- STAGING FIRST: 30-day, row-level transaction change history.
-- Do NOT apply to production without explicit owner approval and reviewed rollout.
-- Current transactions are never purged by this migration.
--
-- Postgres AFTER ROW trigger writes in the same transaction as the ledger DML.
-- An insert, update, or delete fails if its audit record cannot be stored.

CREATE TABLE IF NOT EXISTS public.transaction_change_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create', 'edit', 'delete')),
  before_row jsonb,
  after_row jsonb,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT transaction_history_images CHECK (
    (operation = 'create' AND before_row IS NULL AND after_row IS NOT NULL) OR
    (operation = 'edit' AND before_row IS NOT NULL AND after_row IS NOT NULL) OR
    (operation = 'delete' AND before_row IS NOT NULL AND after_row IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS transaction_change_history_user_time_idx
  ON public.transaction_change_history (user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS transaction_change_history_expiration_idx
  ON public.transaction_change_history (changed_at);

ALTER TABLE public.transaction_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_change_history_owner_read ON public.transaction_change_history;
CREATE POLICY transaction_change_history_owner_read
  ON public.transaction_change_history FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.transaction_change_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transaction_change_history TO authenticated;
REVOKE ALL ON SEQUENCE public.transaction_change_history_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_transaction_history_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'transactions' THEN
    RAISE EXCEPTION 'Unexpected transaction history trigger target';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_change_history
      (user_id, transaction_id, operation, after_row)
    VALUES (NEW.user_id, NEW.id, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
    IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Changing transaction identity is not allowed';
    END IF;
    INSERT INTO public.transaction_change_history
      (user_id, transaction_id, operation, before_row, after_row)
    VALUES (OLD.user_id, OLD.id, 'edit', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.transaction_change_history
      (user_id, transaction_id, operation, before_row)
    VALUES (OLD.user_id, OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Unrecognized transaction change operation';
END
$$;
REVOKE ALL ON FUNCTION public.capture_transaction_history_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS budgetku_capture_transaction_history ON public.transactions;
CREATE TRIGGER budgetku_capture_transaction_history
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.capture_transaction_history_v1();

-- Supabase Cron runs cleanup once each day. A history entry older than 30 days
-- is deleted; active transaction rows and immutable backups are NEVER deleted.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'budgetku-purge-transaction-history-30d',
  '13 3 * * *',
  $$DELETE FROM public.transaction_change_history
    WHERE changed_at < now() - interval '30 days'$$
);
