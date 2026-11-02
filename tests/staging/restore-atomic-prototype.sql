-- STAGING-ONLY proof of atomic restore. NOT a production migration.
-- All operations run in the CALLER'S database transaction under caller RLS.
-- No SECURITY DEFINER; no service_role; no action against Gmail OAuth data.
CREATE OR REPLACE FUNCTION public.budgetku_restore_atomic_v1_test(
  p_backup_data jsonb,
  p_expected_current_data jsonb,
  p_force_rollback boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_key text;
  v_table text;
  v_saved jsonb;
  v_current jsonb;
  v_actual jsonb;
  v_element jsonb;
  v_count int;
  v_existing int;
  v_categories jsonb;
  v_linked record;
  v_existing_link jsonb;
  v_target_link jsonb;
  v_ledger_before int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  -- User-specific advisory mutex. Production version needs independent
  -- app-write concurrency coordination before release.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 8192));

  IF pg_catalog.jsonb_typeof(p_backup_data) <> 'object' OR
     pg_catalog.jsonb_typeof(p_expected_current_data) <> 'object' THEN
    RAISE EXCEPTION 'Malformed restore data' USING ERRCODE = '22023';
  END IF;
  -- Immutable statement snapshots; client supplied expected current data
  -- MUST match database exactly or restoration fails before writing.
  FOR v_key, v_table IN SELECT * FROM (VALUES
    ('accounts','accounts'),
    ('budgets','budgets'),
    ('budgetItems','budget_items'),
    ('categories','categories'),
    ('transactions','transactions'),
    ('recurringTransactions','recurring_transactions'),
    ('financialGoals','financial_goals'),
    ('goalContributions','goal_contributions'),
    ('merchantRules','merchant_rules')) AS entries(k,t)
  LOOP
    v_saved := p_backup_data -> v_key;
    v_current := p_expected_current_data -> v_key;
    IF pg_catalog.jsonb_typeof(v_saved) <> 'array' OR
       pg_catalog.jsonb_typeof(v_current) <> 'array' THEN
      RAISE EXCEPTION 'Restore array missing: %', v_key USING ERRCODE = '22023';
    END IF;
    FOR v_element IN SELECT value FROM pg_catalog.jsonb_array_elements(v_saved)
    LOOP
      IF pg_catalog.jsonb_typeof(v_element) <> 'object' OR
         (v_element ->> 'id') IS NULL THEN
        RAISE EXCEPTION 'Invalid restore record in %', v_key;
      END IF;
      IF v_key = 'categories' AND v_element ->> 'user_id' IS NULL THEN
        IF (v_element ->> 'is_system') IS DISTINCT FROM 'true' OR
           NOT EXISTS(SELECT 1 FROM public.categories c WHERE c.id=(v_element ->> 'id')::uuid
                      AND c.user_id IS NULL AND c.is_system) THEN
          RAISE EXCEPTION 'Unknown shared category in restore';
        END IF;
      ELSIF (v_element ->> 'user_id') IS DISTINCT FROM v_user::text THEN
        RAISE EXCEPTION 'Cross-user restore rejected: %', v_key USING ERRCODE = '42501';
      END IF;
    END LOOP;
    EXECUTE pg_catalog.format(
      'SELECT pg_catalog.coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id), ''[]''::jsonb) FROM public.%I r WHERE %s',
      v_table,
      CASE WHEN v_key='categories' THEN '(r.user_id = $1 OR r.user_id IS NULL)' ELSE 'r.user_id = $1' END
    ) INTO v_actual USING v_user;

    -- Normalize input array order; backup query sorts rows by ID.
    SELECT pg_catalog.coalesce(pg_catalog.jsonb_agg(e.value ORDER BY e.value ->> 'id'),'[]'::jsonb)
      INTO v_current
      FROM pg_catalog.jsonb_array_elements(v_current) AS e(value);
    IF v_actual IS DISTINCT FROM v_current THEN
      RAISE EXCEPTION 'Restore stale baseline: %', v_key USING ERRCODE = '40001';
    END IF;
  END LOOP;

  -- Gmail imports deliberately stay outside the backup and must never be
  -- detached or silently rewritten. Require FULL row identity for linkage.
  FOR v_linked IN
    SELECT t.id, pg_catalog.to_jsonb(t) AS live_row
      FROM public.email_imports ei
      JOIN public.transactions t ON t.id = ei.transaction_id
      WHERE ei.user_id = v_user
      FOR SHARE OF ei, t
  LOOP
    SELECT e.value INTO v_target_link
      FROM pg_catalog.jsonb_array_elements(p_backup_data -> 'transactions') e(value)
      WHERE e.value ->> 'id' = v_linked.id::text;
    IF v_target_link IS NULL OR v_target_link IS DISTINCT FROM v_linked.live_row THEN
      RAISE EXCEPTION 'Gmail-linked transaction conflict' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  -- A test-only failure injector tests rollback after destructive statements.
  -- Any RAISE EXCEPTION aborts this entire RPC database transaction.
  DELETE FROM public.goal_contributions WHERE user_id=v_user;
  DELETE FROM public.merchant_rules WHERE user_id=v_user;
  DELETE FROM public.budget_items WHERE user_id=v_user;
  DELETE FROM public.recurring_transactions WHERE user_id=v_user;
  DELETE FROM public.financial_goals WHERE user_id=v_user;
  DELETE FROM public.transactions
    WHERE user_id=v_user
      AND id NOT IN (SELECT transaction_id FROM public.email_imports
                     WHERE user_id=v_user AND transaction_id IS NOT NULL);
  IF p_force_rollback THEN
    RAISE EXCEPTION 'Injected failure after deleting child data (rollback expected)';
  END IF;
  -- Existing parent rows must survive until their linked financial
  -- transactions have been validated, otherwise ON DELETE SET NULL would
  -- silently mutate Gmail-linked category references.
  INSERT INTO public.accounts AS dst
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.accounts,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'accounts') e(value)
  ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name,account_type=EXCLUDED.account_type,
    initial_balance=EXCLUDED.initial_balance,currency=EXCLUDED.currency,
    icon=EXCLUDED.icon,color=EXCLUDED.color,
    include_in_total=EXCLUDED.include_in_total,is_archived=EXCLUDED.is_archived,
    created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at;

  -- Insert/update owned categories without parent first so children may
  -- reference parent rows regardless of their order in the snapshot.
  INSERT INTO public.categories AS dst
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.categories,
       pg_catalog.jsonb_set(e.value,'{parent_id}','null'::jsonb))).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'categories') e(value)
      WHERE e.value ->> 'user_id' = v_user::text
  ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name,category_type=EXCLUDED.category_type,
    parent_id=NULL,icon=EXCLUDED.icon,color=EXCLUDED.color,
    is_archived=EXCLUDED.is_archived,sort_order=EXCLUDED.sort_order,
    created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at;
  UPDATE public.categories AS c
    SET parent_id = (e.value ->> 'parent_id')::uuid
    FROM pg_catalog.jsonb_array_elements(p_backup_data->'categories') e(value)
    WHERE c.id=(e.value->>'id')::uuid AND c.user_id=v_user;
  -- Only after adding/updating intended parents may missing ones be removed.
  -- Refuse to drop an existing parent still used by an imported transaction.
  IF EXISTS (
    SELECT 1 FROM public.email_imports ei
    JOIN public.transactions t ON t.id=ei.transaction_id
    WHERE ei.user_id=v_user AND (
      NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_backup_data->'accounts') e
        WHERE e.value->>'id'=t.account_id::text)
      OR (t.destination_account_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_backup_data->'accounts') e
        WHERE e.value->>'id'=t.destination_account_id::text))
      OR (t.category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_backup_data->'categories') e
        WHERE e.value->>'id'=t.category_id::text))
    )
  ) THEN
    RAISE EXCEPTION 'Gmail-linked parent record omitted from backup';
  END IF;
  DELETE FROM public.budgets WHERE user_id=v_user;
  INSERT INTO public.budgets
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.budgets,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'budgets') e(value);
  INSERT INTO public.financial_goals
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.financial_goals,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'financialGoals') e(value);
  INSERT INTO public.budget_items
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.budget_items,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'budgetItems') e(value);
  INSERT INTO public.recurring_transactions
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.recurring_transactions,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'recurringTransactions') e(value);
  INSERT INTO public.transactions
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.transactions,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'transactions') e(value)
      WHERE NOT EXISTS (SELECT 1 FROM public.email_imports ei
         WHERE ei.user_id=v_user AND ei.transaction_id=(e.value->>'id')::uuid);
  INSERT INTO public.goal_contributions
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.goal_contributions,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'goalContributions') e(value);
  INSERT INTO public.merchant_rules
    SELECT (pg_catalog.jsonb_populate_record(NULL::public.merchant_rules,e.value)).*
      FROM pg_catalog.jsonb_array_elements(p_backup_data->'merchantRules') e(value);

  -- At this point child relationships are already restored. Delete only
  -- owned records not in the verified snapshot; shared categories stay.
  DELETE FROM public.categories c
    WHERE c.user_id=v_user AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_backup_data->'categories') e
      WHERE e.value->>'id'=c.id::text);
  DELETE FROM public.accounts a
    WHERE a.user_id=v_user AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_backup_data->'accounts') e
      WHERE e.value->>'id'=a.id::text);

  IF p_backup_data->'preferences' IS NOT NULL
     AND p_backup_data->'preferences' <> 'null'::jsonb THEN
    UPDATE public.user_settings
      SET locale = p_backup_data->'preferences'->>'locale',
          currency = p_backup_data->'preferences'->>'currency',
          first_day_of_week = p_backup_data->'preferences'->>'first_day_of_week',
          daily_reminder_enabled = (p_backup_data->'preferences'->>'daily_reminder_enabled')::boolean,
          daily_reminder_time = (p_backup_data->'preferences'->>'daily_reminder_time')::time
      WHERE user_id = v_user;
  END IF;
  SELECT count(*) INTO v_ledger_before FROM public.transactions WHERE user_id=v_user;
  RETURN pg_catalog.jsonb_build_object('restored',true,'transactions',v_ledger_before);
END;
$function$;
REVOKE ALL ON FUNCTION public.budgetku_restore_atomic_v1_test(jsonb,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budgetku_restore_atomic_v1_test(jsonb,jsonb,boolean) TO authenticated;
