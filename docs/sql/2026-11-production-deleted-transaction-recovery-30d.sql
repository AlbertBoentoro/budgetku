-- NOT APPLIED TO PRODUCTION. Requires explicit owner approval before rollout.
-- Scope: record DELETED transactions only; do not archive edits or restores here.
-- Existing balances, cloud backups and active transactions are not touched.
-- This file is designed for production where transaction_change_history does not exist.
-- Staging already has an equivalent broader audit table/trigger for testing.

CREATE TABLE IF NOT EXISTS public.transaction_change_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation = 'delete'),
  before_row jsonb NOT NULL,
  after_row jsonb,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT deleted_tx_history_no_after CHECK (after_row IS NULL)
);
CREATE INDEX IF NOT EXISTS transaction_change_history_user_time_idx
  ON public.transaction_change_history (user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS transaction_change_history_transaction_idx
  ON public.transaction_change_history (user_id, transaction_id, id DESC);
CREATE INDEX IF NOT EXISTS transaction_change_history_expiration_idx
  ON public.transaction_change_history (changed_at);

ALTER TABLE public.transaction_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_change_history_owner_read ON public.transaction_change_history;
CREATE POLICY transaction_change_history_owner_read ON public.transaction_change_history
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.transaction_change_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transaction_change_history TO authenticated;
REVOKE ALL ON SEQUENCE public.transaction_change_history_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_deleted_transaction_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF TG_OP <> 'DELETE' OR TG_TABLE_SCHEMA <> 'public' OR
    TG_TABLE_NAME <> 'transactions' OR OLD.user_id IS NULL THEN
    RAISE EXCEPTION 'Unexpected deleted transaction trigger';
  END IF;
  INSERT INTO public.transaction_change_history
    (user_id,transaction_id,operation,before_row,after_row)
  VALUES (OLD.user_id, OLD.id, 'delete', to_jsonb(OLD),NULL);
  RETURN OLD;
END
$fn$;
REVOKE ALL ON FUNCTION public.capture_deleted_transaction_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS budgetku_capture_deleted_transaction ON public.transactions;
CREATE TRIGGER budgetku_capture_deleted_transaction
  AFTER DELETE ON public.transactions FOR EACH ROW
  EXECUTE FUNCTION public.capture_deleted_transaction_v1();

-- 30 days is ONLY the deletion-history retention; cloud backups retain their
-- independent existing lifetime. Do not purge any existing cloud backup here.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('budgetku-purge-deleted-transactions-30d',
  '13 3 * * *',
  $$DELETE FROM public.transaction_change_history
    WHERE changed_at < now() - interval '30 days'$$);
