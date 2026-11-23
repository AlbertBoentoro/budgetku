-- Audit every actual change of account.initial_balance atomically with the UPDATE.
-- No backfill is attempted: historical before-values cannot be inferred safely.
-- This separate ledger never contributes to account totals, budget, or reports.
CREATE TABLE IF NOT EXISTS public.account_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  account_name text NOT NULL,
  opening_balance_before numeric NOT NULL,
  opening_balance_after numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  delta numeric NOT NULL CHECK (delta <> 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT account_balance_adjustments_delta_check
    CHECK (delta = opening_balance_after - opening_balance_before),
  CONSTRAINT account_balance_adjustments_balances_check
    CHECK (delta = balance_after - balance_before)
);
CREATE INDEX IF NOT EXISTS account_balance_adjustments_user_created_idx
  ON public.account_balance_adjustments (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS account_balance_adjustments_account_created_idx
  ON public.account_balance_adjustments (user_id, account_id, created_at DESC);

ALTER TABLE public.account_balance_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_balance_adjustments_owner_read
  ON public.account_balance_adjustments;
CREATE POLICY account_balance_adjustments_owner_read
  ON public.account_balance_adjustments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Authenticated users can read their own adjustments, never forge, edit,
-- or delete records via REST. The AFTER UPDATE trigger performs inserts.
REVOKE ALL ON public.account_balance_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_balance_adjustments TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_account_balance_adjustment_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_net numeric := 0;
BEGIN
  IF TG_OP <> 'UPDATE' OR TG_TABLE_SCHEMA <> 'public'
      OR TG_TABLE_NAME <> 'accounts'
      OR OLD.user_id IS DISTINCT FROM NEW.user_id
      OR OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Invalid account adjustment audit invocation';
  END IF;

  IF OLD.initial_balance IS NOT DISTINCT FROM NEW.initial_balance THEN
    RETURN NEW;
  END IF;

  -- This matches computeTransactionEffects: income +, expense -,
  -- transfer from - and transfer to +. No adjustment is added to the ledger.
  SELECT COALESCE(SUM(CASE
    WHEN t.transaction_type = 'income' AND t.account_id = NEW.id
      THEN t.amount
    WHEN t.transaction_type = 'expense' AND t.account_id = NEW.id
      THEN -t.amount
    WHEN t.transaction_type = 'transfer' AND t.account_id = NEW.id
      THEN -t.amount
    WHEN t.transaction_type = 'transfer' AND t.destination_account_id = NEW.id
      THEN t.amount
    ELSE 0
  END), 0)
  INTO v_net
  FROM public.transactions t
  WHERE t.user_id = NEW.user_id
    AND (t.account_id = NEW.id OR t.destination_account_id = NEW.id);

  INSERT INTO public.account_balance_adjustments (
    user_id, account_id, account_name,
    opening_balance_before, opening_balance_after,
    balance_before, balance_after, delta
  ) VALUES (
    NEW.user_id, NEW.id, NEW.name,
    OLD.initial_balance, NEW.initial_balance,
    OLD.initial_balance + v_net, NEW.initial_balance + v_net,
    NEW.initial_balance - OLD.initial_balance
  );
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.capture_account_balance_adjustment_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS budgetku_audit_account_balance_change ON public.accounts;
CREATE TRIGGER budgetku_audit_account_balance_change
  AFTER UPDATE OF initial_balance ON public.accounts
  FOR EACH ROW
  WHEN (OLD.initial_balance IS DISTINCT FROM NEW.initial_balance)
  EXECUTE FUNCTION public.capture_account_balance_adjustment_v1();
