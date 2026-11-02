-- Phase 0: initial transaction + recurring schedule must be ONE atomic write.
-- STAGED ONLY: run in disposable PostgreSQL CI and staging first.
-- Never execute on production without an explicit separate YES.
--
-- Existing unique index:
--   transactions_source_reference_uidx
--   (user_id, source, source_reference) WHERE source_reference IS NOT NULL
-- This guarantees one initial transaction per form request token.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'transactions'
      AND indexname = 'transactions_source_reference_uidx'
      AND indexdef ILIKE '%UNIQUE INDEX%'
  ) THEN
    RAISE EXCEPTION 'Unique source reference index required; no migration applied';
  END IF;
END;
$$;

-- SECURITY INVOKER: RLS for the authenticated caller applies to ALL reads/writes.
-- The transaction is only committed if both ledger and template INSERT succeed.
CREATE OR REPLACE FUNCTION public.create_transaction_with_recurring(
  p_client_key uuid,
  p_transaction_type text,
  p_amount numeric,
  p_account_id uuid,
  p_destination_account_id uuid,
  p_category_id uuid,
  p_transaction_date date,
  p_description text,
  p_merchant text,
  p_recurring_name text,
  p_frequency text,
  p_end_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reference text;
  v_existing public.transactions%ROWTYPE;
  v_existing_schedule public.recurring_transactions%ROWTYPE;
  -- Namespace the stable schedule identifier by user, so two different
  -- users with the same client token cannot collide on the global UUID PK.
  v_template_id uuid;
  v_new_id uuid;
  v_next_date date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_client_key IS NULL OR p_transaction_date IS NULL
    OR p_account_id IS NULL OR p_transaction_type NOT IN ('income','expense','transfer')
    OR p_transaction_type IS NULL OR p_amount IS NULL OR p_amount <= 0
    OR p_amount > 100000000000000000 OR p_frequency IS NULL
    OR p_frequency NOT IN ('daily','weekly','monthly','yearly')
    OR NULLIF(trim(p_recurring_name),'') IS NULL
    OR (p_end_date IS NOT NULL AND p_end_date < p_transaction_date)
  THEN
    RAISE EXCEPTION 'Invalid transaction or schedule input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id=p_account_id AND user_id=v_user AND is_archived=false
  ) THEN
    RAISE EXCEPTION 'Source account unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF p_transaction_type = 'transfer' THEN
    IF p_destination_account_id IS NULL OR p_category_id IS NOT NULL
      OR p_destination_account_id = p_account_id
      OR NOT EXISTS (
        SELECT 1 FROM public.accounts
        WHERE id=p_destination_account_id AND user_id=v_user AND is_archived=false
      )
    THEN
      RAISE EXCEPTION 'Destination account unavailable' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF p_destination_account_id IS NOT NULL OR p_category_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id=p_category_id
          AND (user_id=v_user OR user_id IS NULL)
          AND category_type=p_transaction_type AND is_archived=false
      )
    THEN
      RAISE EXCEPTION 'Category unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  CASE p_frequency
    WHEN 'daily' THEN v_next_date := p_transaction_date + 1;
    WHEN 'weekly' THEN v_next_date := p_transaction_date + 7;
    WHEN 'monthly' THEN v_next_date := (p_transaction_date + interval '1 month')::date;
    WHEN 'yearly' THEN v_next_date := (p_transaction_date + interval '1 year')::date;
  END CASE;

  v_reference := 'initial-recurring:' || p_client_key::text;
  v_template_id := md5(v_user::text || ':' || p_client_key::text)::uuid;

  INSERT INTO public.transactions (
    user_id, account_id, destination_account_id, category_id, transaction_type,
    amount, currency, transaction_at, description, merchant, source, source_reference
  )
  VALUES (
    v_user, p_account_id, p_destination_account_id, p_category_id,
    p_transaction_type, p_amount, 'IDR', p_transaction_date, p_description,
    p_merchant, 'manual', v_reference
  )
  ON CONFLICT (user_id,source,source_reference)
    WHERE source_reference IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    -- A parallel or retried request already succeeded. Return its row only
    -- if the entire intended transaction matches. Never create a second
    -- schedule or silently claim a different input was saved.
    SELECT * INTO v_existing FROM public.transactions
    WHERE user_id=v_user AND source='manual' AND source_reference=v_reference;
    IF NOT FOUND
      OR v_existing.account_id IS DISTINCT FROM p_account_id
      OR v_existing.destination_account_id IS DISTINCT FROM p_destination_account_id
      OR v_existing.category_id IS DISTINCT FROM p_category_id
      OR v_existing.transaction_type IS DISTINCT FROM p_transaction_type
      OR v_existing.amount IS DISTINCT FROM p_amount
      OR v_existing.transaction_at::date IS DISTINCT FROM p_transaction_date
      OR v_existing.description IS DISTINCT FROM p_description
      OR v_existing.merchant IS DISTINCT FROM p_merchant
    THEN
      RAISE EXCEPTION 'Request key was already used for another transaction'
        USING ERRCODE = 'P0001';
    END IF;

    -- The same transaction details with a DIFFERENT recurrence definition
    -- must not be reported as saved. Recurrence ID is derived from the
    -- authenticated user and original request token, never from user input.
    SELECT * INTO v_existing_schedule FROM public.recurring_transactions
    WHERE id=v_template_id AND user_id=v_user;
    IF NOT FOUND
      OR v_existing_schedule.name IS DISTINCT FROM p_recurring_name
      OR v_existing_schedule.account_id IS DISTINCT FROM p_account_id
      OR v_existing_schedule.destination_account_id IS DISTINCT FROM p_destination_account_id
      OR v_existing_schedule.category_id IS DISTINCT FROM p_category_id
      OR v_existing_schedule.transaction_type IS DISTINCT FROM p_transaction_type
      OR v_existing_schedule.amount IS DISTINCT FROM p_amount
      OR v_existing_schedule.frequency IS DISTINCT FROM p_frequency
      OR v_existing_schedule.interval_count IS DISTINCT FROM 1
      OR v_existing_schedule.start_date IS DISTINCT FROM p_transaction_date
      OR v_existing_schedule.end_date IS DISTINCT FROM p_end_date
      OR v_existing_schedule.description IS DISTINCT FROM p_description
      OR v_existing_schedule.merchant IS DISTINCT FROM p_merchant
    THEN
      RAISE EXCEPTION 'Request key was already used for another schedule'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.recurring_transactions (
    id, user_id, name, account_id, destination_account_id, category_id,
    transaction_type, amount, frequency, interval_count, start_date,
    end_date, next_due_date, last_generated_at, auto_create, is_active,
    description, merchant
  ) VALUES (
    v_template_id, v_user, p_recurring_name, p_account_id, p_destination_account_id,
    p_category_id, p_transaction_type, p_amount, p_frequency, 1,
    p_transaction_date, p_end_date, v_next_date, now(), false,
    p_end_date IS NULL OR v_next_date <= p_end_date,
    p_description, p_merchant
  );

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_transaction_with_recurring(
  uuid,text,numeric,uuid,uuid,uuid,date,text,text,text,text,date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_transaction_with_recurring(
  uuid,text,numeric,uuid,uuid,uuid,date,text,text,text,text,date
) TO authenticated;

COMMIT;

-- Release gate: first apply to staging & confirm multi-user RLS, retry,
-- conflicting retry, concurrent submission, month-end clamp, and rollback.
-- Function is additive; old code still works before app deployment.
