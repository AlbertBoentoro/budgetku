-- Budgetku P0: atomic, idempotent recurring ledger writes.
-- STAGED MIGRATION ONLY. Do NOT run against production without approval.
-- Preflight (read-only):
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.transactions'::regclass
--    AND conname='transactions_source_check';
-- SELECT indexdef FROM pg_indexes WHERE schemaname='public'
--  AND indexname='transactions_source_reference_uidx';
-- Rollback plan: revert app to previous release before dropping this function;
-- keep 'recurring' as an allowed source if any recurrence rows exist.

BEGIN;

-- The existing app writes source='recurring', but the live CHECK omits it.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN (
    'manual', 'email', 'receipt', 'screenshot',
    'statement', 'import', 'ai', 'recurring'
  ));

-- Prevent duplicate occurrences by a unique (template UUID, due date)
-- reference. The existing unique index on (user_id, source, source_reference)
-- WHERE source_reference IS NOT NULL is required. Verify before deploying.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='transactions'
      AND indexname='transactions_source_reference_uidx'
      AND indexdef ILIKE '%UNIQUE INDEX%'
  ) THEN
    RAISE EXCEPTION 'Missing transactions_source_reference_uidx; abort migration';
  END IF;
END;
$$;

-- Authenticated invoker only: RLS and GRANTs still apply.
-- FOR UPDATE serializes concurrent clicks on the same schedule.
-- INSERT and next_due_date UPDATE are one PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.generate_recurring_now(p_template_id uuid, p_expected_due_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_template public.recurring_transactions%ROWTYPE;
  v_due date;
  v_next date;
  v_created_id uuid;
  v_reference text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000';
  END IF;

  SELECT * INTO v_template
  FROM public.recurring_transactions
  WHERE id = p_template_id AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring template unavailable' USING ERRCODE='P0002';
  END IF;

  IF NOT v_template.is_active THEN
    RAISE EXCEPTION 'Recurring template paused' USING ERRCODE='P0001';
  END IF;

  -- The screen sends the occurrence it intends to record. A second request
  -- for the same old occurrence must NOT create next month's charge.
  IF p_expected_due_date IS NULL OR v_template.next_due_date IS DISTINCT FROM p_expected_due_date THEN
    RAISE EXCEPTION 'Stale recurrence; reload before recording' USING ERRCODE='P0001';
  END IF;

  v_due := v_template.next_due_date;
  IF v_template.end_date IS NOT NULL AND v_due > v_template.end_date THEN
    RAISE EXCEPTION 'Recurring template expired' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = v_template.account_id AND user_id = v_user AND is_archived = false
  ) THEN
    RAISE EXCEPTION 'Source account unavailable' USING ERRCODE='P0001';
  END IF;

  IF v_template.transaction_type = 'transfer' THEN
    IF v_template.destination_account_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = v_template.destination_account_id
        AND user_id = v_user AND is_archived = false
    ) THEN
      RAISE EXCEPTION 'Destination account unavailable' USING ERRCODE='P0001';
    END IF;
  ELSIF v_template.transaction_type IN ('income', 'expense') THEN
    IF v_template.category_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.categories
      WHERE id = v_template.category_id
        AND (user_id = v_user OR user_id IS NULL)
        AND category_type = v_template.transaction_type
        AND is_archived = false
    ) THEN
      RAISE EXCEPTION 'Category unavailable' USING ERRCODE='P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid recurring transaction type' USING ERRCODE='P0001';
  END IF;

  IF v_template.interval_count < 1 THEN
    RAISE EXCEPTION 'Invalid recurrence interval' USING ERRCODE='P0001';
  END IF;

  CASE v_template.frequency
    WHEN 'daily' THEN v_next := (v_due + make_interval(days => v_template.interval_count))::date;
    WHEN 'weekly' THEN v_next := (v_due + make_interval(days => 7 * v_template.interval_count))::date;
    WHEN 'monthly' THEN v_next := (v_due + make_interval(months => v_template.interval_count))::date;
    WHEN 'yearly' THEN v_next := (v_due + make_interval(months => 12 * v_template.interval_count))::date;
    ELSE RAISE EXCEPTION 'Invalid recurrence frequency' USING ERRCODE='P0001';
  END CASE;

  v_reference := v_template.id::text || ':' || to_char(v_due, 'YYYY-MM-DD');

  INSERT INTO public.transactions (
    user_id, account_id, destination_account_id, category_id,
    transaction_type, amount, currency, transaction_at,
    description, merchant, source, source_reference
  ) VALUES (
    v_user, v_template.account_id,
    CASE WHEN v_template.transaction_type='transfer' THEN v_template.destination_account_id ELSE NULL END,
    CASE WHEN v_template.transaction_type='transfer' THEN NULL ELSE v_template.category_id END,
    v_template.transaction_type, v_template.amount, 'IDR', v_due,
    v_template.description, v_template.merchant, 'recurring', v_reference
  ) RETURNING id INTO v_created_id;

  UPDATE public.recurring_transactions
  SET next_due_date = v_next,
      last_generated_at = now(),
      is_active = CASE WHEN end_date IS NOT NULL AND v_next > end_date
        THEN false ELSE is_active END
  WHERE id = v_template.id AND user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring schedule failed to advance' USING ERRCODE='P0001';
  END IF;

  RETURN v_created_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_now(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_now(uuid, date) TO authenticated;
COMMIT;

-- Post-deploy: test with synthetic authenticated accounts IN STAGING first:
-- concurrent invocation => one successful occurrence only,
-- rejected second click => no extra transaction,
-- wrong user => no access, failure on INSERT => schedule not advanced,
-- inactive/archived account/category => no new transaction,
-- end_date and month-end clamps => correct next due date.
