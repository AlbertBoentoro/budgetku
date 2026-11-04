-- STAGING ONLY. Restore missing rows from a verified Budgetku backup, never
-- delete/update existing financial rows. One PostgreSQL transaction or rollback.
-- Protected existing rows/modified transaction IDs are never overwritten.
-- Do not enable in production without approved migration + staging tests.
CREATE OR REPLACE FUNCTION public.restore_missing_budgetku_v1(p_backup jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb;
  v_key text;
  v_bad boolean;
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
  v_new_categories uuid[] := '{}'::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_backup IS NULL OR pg_catalog.jsonb_typeof(p_backup) <> 'object'
     OR p_backup->>'format' <> 'budgetku-backup'
     OR p_backup->>'version' <> '1'
     OR pg_catalog.jsonb_typeof(p_backup->'data') <> 'object' THEN
    RAISE EXCEPTION 'Invalid Budgetku backup' USING ERRCODE = '22023';
  END IF;
  v_data := p_backup->'data';
  PERFORM pg_catalog.pg_advisory_xact_lock(762052, pg_catalog.hashtext(v_uid::text));
  FOREACH v_key IN ARRAY ARRAY[
    'accounts','budgets','budgetItems','categories','transactions',
    'recurringTransactions','financialGoals','goalContributions','merchantRules'
  ] LOOP
    IF pg_catalog.jsonb_typeof(v_data->v_key) <> 'array'
      OR pg_catalog.jsonb_array_length(v_data->v_key) > 20000 THEN
      RAISE EXCEPTION 'Missing/oversized backup section: %',v_key USING ERRCODE='22023';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_data->v_key) AS x(value)
      WHERE pg_catalog.jsonb_typeof(x.value) <> 'object'
        OR coalesce(x.value->>'id','') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (
          v_key='categories' AND NOT (
            (x.value->>'user_id'=v_uid::text AND x.value->>'is_system'='false')
            OR (x.value->'user_id'='null'::jsonb AND x.value->>'is_system'='true')
          )
        )
        OR (v_key<>'categories' AND x.value->>'user_id' IS DISTINCT FROM v_uid::text)
    ) INTO v_bad;
    IF v_bad THEN RAISE EXCEPTION 'Foreign/invalid rows in %',v_key USING ERRCODE='22023'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(v_data->v_key) AS x(value)
      GROUP BY x.value->>'id' HAVING count(*)>1
    ) INTO v_bad;
    IF v_bad THEN RAISE EXCEPTION 'Duplicate IDs in %',v_key USING ERRCODE='22023'; END IF;
  END LOOP;
  -- The application preflight checks all foreign keys and conflicts. SQL
  -- enforces their correctness again; a bad reference aborts all inserts.
  -- Insert all parent entities first, preserving existing IDs and all metadata.
  INSERT INTO public.accounts(
    id,user_id,name,account_type,initial_balance,currency,icon,color,
    include_in_total,is_archived,created_at,updated_at)
  SELECT id,user_id,name,account_type,initial_balance,currency,icon,color,
    include_in_total,is_archived,created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.accounts,v_data->'accounts')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('accounts',v_count);

  WITH inserted AS (
    INSERT INTO public.categories(
      id,user_id,name,category_type,icon,color,is_system,is_archived,
      sort_order,created_at,updated_at,parent_id)
    SELECT id,user_id,name,category_type,icon,color,is_system,is_archived,
      sort_order,created_at,updated_at,NULL::uuid
    FROM pg_catalog.jsonb_populate_recordset(NULL::public.categories,v_data->'categories')
    WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING RETURNING id
  )
  SELECT coalesce(pg_catalog.array_agg(id),'{}'::uuid[])
    INTO v_new_categories FROM inserted;
  v_counts := v_counts || pg_catalog.jsonb_build_object('categories',pg_catalog.array_length(v_new_categories,1));
  UPDATE public.categories c SET parent_id=NULLIF(row.value->>'parent_id','')::uuid
  FROM pg_catalog.jsonb_array_elements(v_data->'categories') AS row(value)
  WHERE c.user_id=v_uid AND c.id=ANY(v_new_categories)
    AND c.id=(row.value->>'id')::uuid
    AND row.value->>'parent_id' IS NOT NULL;

  INSERT INTO public.financial_goals(
    id,user_id,name,target_amount,start_date,target_date,account_id,status,
    icon,color,notes,created_at,updated_at)
  SELECT id,user_id,name,target_amount,start_date,target_date,account_id,status,
    icon,color,notes,created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.financial_goals,v_data->'financialGoals')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('financialGoals',v_count);

  INSERT INTO public.budgets(
    id,user_id,name,month,notes,created_at,updated_at)
  SELECT id,user_id,name,month,notes,created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.budgets,v_data->'budgets')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('budgets',v_count);

  INSERT INTO public.transactions(
    id,user_id,account_id,destination_account_id,category_id,transaction_type,
    amount,merchant,description,transaction_at,currency,source,source_reference,
    created_at,updated_at)
  SELECT id,user_id,account_id,destination_account_id,category_id,transaction_type,
    amount,merchant,description,transaction_at,currency,source,source_reference,
    created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.transactions,v_data->'transactions')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('transactions',v_count);

  INSERT INTO public.recurring_transactions(
    id,user_id,account_id,destination_account_id,category_id,transaction_type,
    name,amount,merchant,description,frequency,interval_count,start_date,
    next_due_date,end_date,is_active,auto_create,last_generated_at,created_at,updated_at)
  SELECT id,user_id,account_id,destination_account_id,category_id,transaction_type,
    name,amount,merchant,description,frequency,interval_count,start_date,
    next_due_date,end_date,is_active,auto_create,last_generated_at,created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.recurring_transactions,v_data->'recurringTransactions')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('recurringTransactions',v_count);

  INSERT INTO public.budget_items(
    id,budget_id,user_id,category_id,planned_amount,is_fixed,notes,created_at,updated_at)
  SELECT id,budget_id,user_id,category_id,planned_amount,is_fixed,notes,created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.budget_items,v_data->'budgetItems')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('budgetItems',v_count);

  INSERT INTO public.goal_contributions(
    id,goal_id,user_id,amount,contributed_at,note,created_at)
  SELECT id,goal_id,user_id,amount,contributed_at,note,created_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.goal_contributions,v_data->'goalContributions')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('goalContributions',v_count);

  INSERT INTO public.merchant_rules(
    id,user_id,category_id,pattern,match_type,priority,is_system,is_active,
    created_at,updated_at)
  SELECT id,user_id,category_id,pattern,match_type,priority,is_system,is_active,
    created_at,updated_at
  FROM pg_catalog.jsonb_populate_recordset(NULL::public.merchant_rules,v_data->'merchantRules')
  WHERE user_id=v_uid ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || pg_catalog.jsonb_build_object('merchantRules',v_count);

  IF pg_catalog.jsonb_typeof(v_data->'preferences') = 'object' THEN
    INSERT INTO public.user_settings(
      user_id,locale,currency,first_day_of_week,daily_reminder_enabled,daily_reminder_time)
    VALUES (
      v_uid,coalesce(v_data->'preferences'->>'locale','id-ID'),
      coalesce(v_data->'preferences'->>'currency','IDR'),
      coalesce(v_data->'preferences'->>'first_day_of_week','monday'),
      coalesce((v_data->'preferences'->>'daily_reminder_enabled')::boolean,false),
      coalesce((v_data->'preferences'->>'daily_reminder_time')::time,'20:00'::time)
    ) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok',true,'inserted',v_counts);
END;
$fn$;
REVOKE ALL ON FUNCTION public.restore_missing_budgetku_v1(jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_missing_budgetku_v1(jsonb)
  TO authenticated;
