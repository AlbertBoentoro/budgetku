-- Financial-integrity F-01/F-04/F-05: a follow-up patch to the existing
-- recurring functions. STAGING / disposable PostgreSQL ONLY until approved.
-- Never edit prior ledger rows or future_due values during migration.
-- Safe rollout: apply both function replacements in one transaction, test,
-- then release app amount validation after approved production migration.
-- Rollback: redeploy the last known-good function definitions from DB backup,
-- NOT the initial historical SQL (which contains the audited defects).
BEGIN;

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
  v_month_step integer;
  v_elapsed_months integer;
  v_period integer;
  v_first date;
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
  -- Never post future liabilities into today's account balance, or rewind
  -- before the template's starting date. Date policy uses WIB, not UTC.
  IF v_due < v_template.start_date
     OR v_due > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Occurrence not due yet or before schedule start' USING ERRCODE='P0001';
  END IF;
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

  -- Ledger amounts must also be exactly representable by JS and restorable.
  IF v_template.amount IS NULL OR v_template.amount <= 0
     OR v_template.amount > 1000000000000
     OR v_template.amount <> trunc(v_template.amount) THEN
    RAISE EXCEPTION 'Invalid recurring amount' USING ERRCODE='22023';
  END IF;

  -- Initial transaction created with a recurring schedule uses a different
  -- source reference. Resolve its deterministic template UUID before posting,
  -- otherwise editing next_due_date back to start_date silently duplicates it.
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = v_user
      AND t.source = 'manual'
      AND t.source_reference LIKE 'initial-recurring:%'
      AND md5(v_user::text || ':' ||
        substring(t.source_reference FROM char_length('initial-recurring:') + 1))::uuid
        = v_template.id
      AND t.transaction_at::date = v_due
  ) THEN
    RAISE EXCEPTION 'Initial occurrence already recorded' USING ERRCODE='23505';
  END IF;

  IF v_template.interval_count < 1 THEN
    RAISE EXCEPTION 'Invalid recurrence interval' USING ERRCODE='P0001';
  END IF;

  CASE v_template.frequency
    WHEN 'daily' THEN v_next := (v_due + make_interval(days => v_template.interval_count))::date;
    WHEN 'weekly' THEN v_next := (v_due + make_interval(days => 7 * v_template.interval_count))::date;
    WHEN 'monthly' THEN v_month_step := v_template.interval_count;
    WHEN 'yearly' THEN v_month_step := 12 * v_template.interval_count;
    ELSE RAISE EXCEPTION 'Invalid recurrence frequency' USING ERRCODE='P0001';
  END CASE;

  IF v_month_step IS NOT NULL THEN
    -- Advance by periods from the ORIGINAL start day, not from a February
    -- clamped due date (Jan 31 -> Feb 28 -> Mar 31 -> Apr 30).
    v_elapsed_months :=
      (EXTRACT(YEAR FROM v_due)::integer - EXTRACT(YEAR FROM v_template.start_date)::integer) * 12
      + EXTRACT(MONTH FROM v_due)::integer - EXTRACT(MONTH FROM v_template.start_date)::integer;
    v_period := GREATEST(1, v_elapsed_months / v_month_step);
    v_first := (date_trunc('month', v_template.start_date)::date
      + make_interval(months => v_period * v_month_step))::date;
    v_next := v_first + (
      LEAST(EXTRACT(DAY FROM v_template.start_date)::integer,
        EXTRACT(DAY FROM ((v_first + interval '1 month')::date - 1))::integer) - 1
    );
    IF v_next <= v_due THEN
      v_period := v_period + 1;
      v_first := (date_trunc('month', v_template.start_date)::date
        + make_interval(months => v_period * v_month_step))::date;
      v_next := v_first + (
        LEAST(EXTRACT(DAY FROM v_template.start_date)::integer,
          EXTRACT(DAY FROM ((v_first + interval '1 month')::date - 1))::integer) - 1
      );
    END IF;
  END IF;

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
    OR p_amount > 1000000000000 OR p_amount <> trunc(p_amount)
    OR p_frequency IS NULL
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

-- Retain least-privilege permissions of the existing SECURITY INVOKER RPCs.
REVOKE ALL ON FUNCTION public.generate_recurring_now(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_now(uuid, date) TO authenticated;
REVOKE ALL ON FUNCTION public.create_transaction_with_recurring(
  uuid,text,numeric,uuid,uuid,uuid,date,text,text,text,text,date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_transaction_with_recurring(
  uuid,text,numeric,uuid,uuid,uuid,date,text,text,text,text,date
) TO authenticated;
COMMIT;
