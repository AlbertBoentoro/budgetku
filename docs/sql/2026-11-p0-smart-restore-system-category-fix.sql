-- Fix read-only system-category restoration (staging first). Production DB must be approved separately.
-- Global system categories are SELECT-able, not UPDATE-able under RLS.
-- SELECT FOR SHARE applies UPDATE row security and falsely rejects these rows.
-- Plain SELECT uses category SELECT RLS; existing foreign key checks the category on INSERT.
-- Restore selected *missing* manual transactions only; no UPDATE / DELETE.
-- One call = one PostgreSQL transaction, preserving original IDs.
CREATE OR REPLACE FUNCTION public.restore_selected_transactions_v1(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item jsonb;
  v_row public.transactions%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authenticated account required' USING ERRCODE = '28000';
  END IF;
  IF p_rows IS NULL OR pg_catalog.jsonb_typeof(p_rows) <> 'array'
    OR pg_catalog.jsonb_array_length(p_rows) < 1
    OR pg_catalog.jsonb_array_length(p_rows) > 50 THEN
    RAISE EXCEPTION 'Choose between 1 and 50 transactions' USING ERRCODE = '22023';
  END IF;

  -- Serialize requests using this restore RPC for the same user. External
  -- writes cannot claim this advisory lock, so PK / FK / RLS remain essential.
  PERFORM pg_catalog.pg_advisory_xact_lock(762039, pg_catalog.hashtext(v_user::text));

  IF EXISTS (
    SELECT 1 FROM (
      SELECT x.value->>'id' AS id, COUNT(*) AS n
      FROM pg_catalog.jsonb_array_elements(p_rows) AS x(value)
      GROUP BY x.value->>'id'
    ) duplicates
    WHERE duplicates.n > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate selected transaction' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT x.value FROM pg_catalog.jsonb_array_elements(p_rows) AS x(value)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Malformed transaction in selection' USING ERRCODE = '22023';
    END IF;

    -- Only known DB columns are inserted. Extra JSON fields cannot affect SQL.
    v_row := pg_catalog.jsonb_populate_record(NULL::public.transactions, v_item);

    IF v_row.id IS NULL OR v_row.user_id IS DISTINCT FROM v_user
      OR v_row.source IS DISTINCT FROM 'manual' OR v_row.source_reference IS NOT NULL
      OR v_row.currency IS DISTINCT FROM 'IDR'
      OR v_row.amount IS NULL OR v_row.amount <= 0
      OR v_row.amount > 1000000000000
      OR v_row.amount <> pg_catalog.trunc(v_row.amount)
      OR v_row.transaction_type NOT IN ('income','expense','transfer')
      OR v_row.transaction_type IS NULL
      OR v_row.account_id IS NULL OR v_row.transaction_at IS NULL
      OR v_row.created_at IS NULL OR v_row.updated_at IS NULL THEN
      RAISE EXCEPTION 'Invalid or unsupported transaction' USING ERRCODE = '22023';
    END IF;

    -- Lock existing references so they cannot disappear or change ownership
    -- during this insert. Never create accounts or categories as side effects.
    PERFORM 1 FROM public.accounts a
      WHERE a.id = v_row.account_id AND a.user_id = v_user
        AND a.currency = 'IDR' AND NOT a.is_archived FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source account unavailable' USING ERRCODE = 'P0001';
    END IF;

    IF v_row.transaction_type = 'transfer' THEN
      IF v_row.destination_account_id IS NULL
        OR v_row.destination_account_id = v_row.account_id
        OR v_row.category_id IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid transfer references' USING ERRCODE = 'P0001';
      END IF;
      PERFORM 1 FROM public.accounts a
        WHERE a.id = v_row.destination_account_id AND a.user_id = v_user
          AND a.currency = 'IDR' AND NOT a.is_archived FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account unavailable' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF v_row.category_id IS NULL OR v_row.destination_account_id IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid category / destination' USING ERRCODE = 'P0001';
      END IF;
      PERFORM 1 FROM public.categories c
        WHERE c.id = v_row.category_id
          AND (c.user_id = v_user OR (c.user_id IS NULL AND c.is_system))
          AND c.category_type = v_row.transaction_type AND NOT c.is_archived;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Category unavailable' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- No overwrite and no duplication. If ANY row fails, PostgreSQL aborts
    -- all selected inserts in this RPC; no half-restored financial state.
    INSERT INTO public.transactions(
      id, user_id, account_id, destination_account_id, category_id,
      transaction_type, amount, merchant, description, transaction_at,
      currency, source, source_reference, created_at, updated_at
    ) VALUES (
      v_row.id, v_user, v_row.account_id, v_row.destination_account_id,
      v_row.category_id, v_row.transaction_type, v_row.amount,
      v_row.merchant, v_row.description, v_row.transaction_at,
      'IDR', 'manual', NULL, v_row.created_at, v_row.updated_at
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_selected_transactions_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_selected_transactions_v1(jsonb) TO authenticated;
