-- Budgetku v1 atomic user-scoped ledger restore.
-- Staging verification first. No production migration until separately approved.
-- Intentionally does not restore email credentials, Gmail drafts, push tokens or backups.
-- Invoker RLS, no service-role bypass. An unhandled error rolls back all ledger changes.
CREATE OR REPLACE FUNCTION public.restore_budgetku_backup_v1(p_backup jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $restore$
DECLARE
  v_uid uuid := auth.uid();
  v_data jsonb;
  v_key text;
  v_item jsonb;
  v_bad boolean;
  v_result jsonb;
  v_keys text[] := ARRAY['accounts','budgets','budgetItems','categories','transactions',
    'recurringTransactions','financialGoals','goalContributions','merchantRules'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Restore needs an authenticated user'; END IF;
  IF p_backup IS NULL OR jsonb_typeof(p_backup)<>'object'
    OR p_backup->>'format'<>'budgetku-backup'
    OR p_backup->>'version'<>'1'
    OR jsonb_typeof(p_backup->'data')<>'object'
    OR p_backup->>'generatedAt' IS NULL THEN
    RAISE EXCEPTION 'Unrecognized backup format';
  END IF;
  v_data := p_backup->'data';
  PERFORM pg_advisory_xact_lock(762034, hashtext(v_uid::text));

  FOREACH v_key IN ARRAY v_keys LOOP
    IF jsonb_typeof(v_data->v_key)<>'array' THEN
      RAISE EXCEPTION 'Missing or invalid backup list: %',v_key;
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_data->v_key) x
      WHERE jsonb_typeof(x)<>'object'
        OR COALESCE(x->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR (v_key='categories' AND NOT (
          (x->>'user_id'=v_uid::text AND x->>'is_system'='false')
          OR (x->'user_id'='null'::jsonb AND x->>'is_system'='true')))
        OR (v_key<>'categories' AND x->>'user_id' IS DISTINCT FROM v_uid::text)
    ) INTO v_bad;
    IF v_bad THEN RAISE EXCEPTION 'Backup contains malformed or foreign-owned rows in %',v_key; END IF;
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_data->v_key) x
      GROUP BY x->>'id' HAVING COUNT(*)>1
    ) INTO v_bad;
    IF v_bad THEN RAISE EXCEPTION 'Duplicate record id in %',v_key; END IF;
  END LOOP;

  IF jsonb_typeof(v_data->'preferences') NOT IN ('object','null')
    OR v_data->'preferences' IS NULL THEN
    RAISE EXCEPTION 'Invalid preferences object';
  END IF;

  -- Imported Gmail messages are NOT part of backup format v1. Do not silently
  -- clear their transaction_id foreign key via ON DELETE SET NULL. If any
  -- existing linked transaction would disappear, reject the entire restore.
  IF to_regclass('public.email_imports') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (
      SELECT 1 FROM public.email_imports e
      WHERE e.user_id=$1 AND e.transaction_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements($2->''transactions'') x
          WHERE x->>''id'' = e.transaction_id::text
        )
    )' INTO v_bad USING v_uid,v_data;
    IF v_bad THEN
      RAISE EXCEPTION 'Restore blocked: Gmail-linked transactions missing from snapshot';
    END IF;
  END IF;

  -- Shared categories are never owned or updated by users. Require the same
  -- global IDs to already exist, otherwise category relationships would break.
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_data->'categories') x
    WHERE x->'user_id'='null'::jsonb
      AND NOT EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id=(x->>'id')::uuid AND c.user_id IS NULL AND c.is_system
      )
  ) INTO v_bad;
  IF v_bad THEN RAISE EXCEPTION 'Snapshot references missing shared categories'; END IF;

  -- Remove stale dependents first; parent rows are updated/inserted later.
  -- Old linked Gmail transactions are explicitly protected above.
  DELETE FROM public.goal_contributions current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'goalContributions') candidate
      WHERE candidate->>'id'=current_row.id::text);
  DELETE FROM public.recurring_transactions current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'recurringTransactions') candidate
      WHERE candidate->>'id'=current_row.id::text);
  DELETE FROM public.transactions current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'transactions') candidate
      WHERE candidate->>'id'=current_row.id::text);
  DELETE FROM public.merchant_rules current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'merchantRules') candidate
      WHERE candidate->>'id'=current_row.id::text);
  -- Budgets are rebuilt as a pair, avoiding swapped month/category uniqueness
  -- collisions. Neither table is referenced by integrations outside this pair.
  DELETE FROM public.budget_items WHERE user_id=v_uid;
  DELETE FROM public.budgets WHERE user_id=v_uid;

  -- Upsert parents BEFORE their remaining child rows. Preserve existing
  -- transaction primary keys so matching Gmail imports stay attached.
  INSERT INTO public.accounts AS target (id, user_id, name, account_type, initial_balance, currency, icon, color, include_in_total, is_archived, created_at, updated_at)
    SELECT r.id, r.user_id, r.name, r.account_type, r.initial_balance, r.currency, r.icon, r.color, r.include_in_total, r.is_archived, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.accounts,v_data->'accounts') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, account_type=EXCLUDED.account_type, initial_balance=EXCLUDED.initial_balance, currency=EXCLUDED.currency, icon=EXCLUDED.icon, color=EXCLUDED.color, include_in_total=EXCLUDED.include_in_total, is_archived=EXCLUDED.is_archived, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.categories AS target (id, user_id, name, category_type, icon, color, is_system, is_archived, sort_order, created_at, updated_at)
    SELECT r.id, r.user_id, r.name, r.category_type, r.icon, r.color, r.is_system, r.is_archived, r.sort_order, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.categories,v_data->'categories') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category_type=EXCLUDED.category_type, icon=EXCLUDED.icon, color=EXCLUDED.color, is_system=EXCLUDED.is_system, is_archived=EXCLUDED.is_archived, sort_order=EXCLUDED.sort_order, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at, parent_id=NULL;
  INSERT INTO public.financial_goals AS target (id, user_id, name, target_amount, start_date, target_date, account_id, status, icon, color, notes, created_at, updated_at)
    SELECT r.id, r.user_id, r.name, r.target_amount, r.start_date, r.target_date, r.account_id, r.status, r.icon, r.color, r.notes, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.financial_goals,v_data->'financialGoals') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, target_amount=EXCLUDED.target_amount, start_date=EXCLUDED.start_date, target_date=EXCLUDED.target_date, account_id=EXCLUDED.account_id, status=EXCLUDED.status, icon=EXCLUDED.icon, color=EXCLUDED.color, notes=EXCLUDED.notes, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.transactions AS target (id, user_id, account_id, destination_account_id, category_id, transaction_type, amount, merchant, description, transaction_at, currency, source, source_reference, created_at, updated_at)
    SELECT r.id, r.user_id, r.account_id, r.destination_account_id, r.category_id, r.transaction_type, r.amount, r.merchant, r.description, r.transaction_at, r.currency, r.source, r.source_reference, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.transactions,v_data->'transactions') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET account_id=EXCLUDED.account_id, destination_account_id=EXCLUDED.destination_account_id, category_id=EXCLUDED.category_id, transaction_type=EXCLUDED.transaction_type, amount=EXCLUDED.amount, merchant=EXCLUDED.merchant, description=EXCLUDED.description, transaction_at=EXCLUDED.transaction_at, currency=EXCLUDED.currency, source=EXCLUDED.source, source_reference=EXCLUDED.source_reference, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.recurring_transactions AS target (id, user_id, account_id, destination_account_id, category_id, transaction_type, name, amount, merchant, description, frequency, interval_count, start_date, next_due_date, end_date, is_active, auto_create, last_generated_at, created_at, updated_at)
    SELECT r.id, r.user_id, r.account_id, r.destination_account_id, r.category_id, r.transaction_type, r.name, r.amount, r.merchant, r.description, r.frequency, r.interval_count, r.start_date, r.next_due_date, r.end_date, r.is_active, r.auto_create, r.last_generated_at, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.recurring_transactions,v_data->'recurringTransactions') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET account_id=EXCLUDED.account_id, destination_account_id=EXCLUDED.destination_account_id, category_id=EXCLUDED.category_id, transaction_type=EXCLUDED.transaction_type, name=EXCLUDED.name, amount=EXCLUDED.amount, merchant=EXCLUDED.merchant, description=EXCLUDED.description, frequency=EXCLUDED.frequency, interval_count=EXCLUDED.interval_count, start_date=EXCLUDED.start_date, next_due_date=EXCLUDED.next_due_date, end_date=EXCLUDED.end_date, is_active=EXCLUDED.is_active, auto_create=EXCLUDED.auto_create, last_generated_at=EXCLUDED.last_generated_at, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.budgets AS target (id, user_id, name, month, notes, created_at, updated_at)
    SELECT r.id, r.user_id, r.name, r.month, r.notes, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.budgets,v_data->'budgets') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, month=EXCLUDED.month, notes=EXCLUDED.notes, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.budget_items AS target (id, budget_id, user_id, category_id, planned_amount, is_fixed, notes, created_at, updated_at)
    SELECT r.id, r.budget_id, r.user_id, r.category_id, r.planned_amount, r.is_fixed, r.notes, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.budget_items,v_data->'budgetItems') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET budget_id=EXCLUDED.budget_id, category_id=EXCLUDED.category_id, planned_amount=EXCLUDED.planned_amount, is_fixed=EXCLUDED.is_fixed, notes=EXCLUDED.notes, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;
  INSERT INTO public.goal_contributions AS target (id, goal_id, user_id, amount, contributed_at, note, created_at)
    SELECT r.id, r.goal_id, r.user_id, r.amount, r.contributed_at, r.note, r.created_at FROM jsonb_populate_recordset(NULL::public.goal_contributions,v_data->'goalContributions') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET goal_id=EXCLUDED.goal_id, amount=EXCLUDED.amount, contributed_at=EXCLUDED.contributed_at, note=EXCLUDED.note, created_at=EXCLUDED.created_at;
  INSERT INTO public.merchant_rules AS target (id, user_id, category_id, pattern, match_type, priority, is_system, is_active, created_at, updated_at)
    SELECT r.id, r.user_id, r.category_id, r.pattern, r.match_type, r.priority, r.is_system, r.is_active, r.created_at, r.updated_at FROM jsonb_populate_recordset(NULL::public.merchant_rules,v_data->'merchantRules') r
    WHERE r.user_id=v_uid
    ON CONFLICT (id) DO UPDATE SET category_id=EXCLUDED.category_id, pattern=EXCLUDED.pattern, match_type=EXCLUDED.match_type, priority=EXCLUDED.priority, is_system=EXCLUDED.is_system, is_active=EXCLUDED.is_active, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at;

  -- Delete obsolete parent records, only after remaining children were moved.
  DELETE FROM public.financial_goals current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'financialGoals') candidate
      WHERE candidate->>'id'=current_row.id::text);
  DELETE FROM public.accounts current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'accounts') candidate
      WHERE candidate->>'id'=current_row.id::text);
  DELETE FROM public.categories current_row
    WHERE current_row.user_id=v_uid
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'categories') candidate
      WHERE candidate->>'id'=current_row.id::text);

  -- Resolve nested categories after all IDs and parent rows exist.
  UPDATE public.categories c
  SET parent_id = NULLIF(x->>'parent_id','')::uuid
  FROM jsonb_array_elements(v_data->'categories') x
  WHERE x->>'user_id'=v_uid::text
    AND c.user_id=v_uid AND c.id=(x->>'id')::uuid
    AND c.parent_id IS DISTINCT FROM NULLIF(x->>'parent_id','')::uuid;

  IF jsonb_typeof(v_data->'preferences')='object' THEN
    INSERT INTO public.user_settings
      (user_id,locale,currency,first_day_of_week,daily_reminder_enabled,daily_reminder_time)
    VALUES (
      v_uid,
      COALESCE(v_data->'preferences'->>'locale','id-ID'),
      COALESCE(v_data->'preferences'->>'currency','IDR'),
      COALESCE(v_data->'preferences'->>'first_day_of_week','monday'),
      COALESCE((v_data->'preferences'->>'daily_reminder_enabled')::boolean,false),
      COALESCE((v_data->'preferences'->>'daily_reminder_time')::time,'20:00'::time)
    )
    ON CONFLICT (user_id) DO UPDATE
      SET locale=EXCLUDED.locale,currency=EXCLUDED.currency,
        first_day_of_week=EXCLUDED.first_day_of_week,
        daily_reminder_enabled=EXCLUDED.daily_reminder_enabled,
        daily_reminder_time=EXCLUDED.daily_reminder_time;
  END IF;

  SELECT jsonb_object_agg(k,jsonb_array_length(v_data->k))
  INTO v_result FROM unnest(v_keys) k;
  RETURN jsonb_build_object('ok',true,'counts',v_result);
END;
$restore$;

REVOKE ALL ON FUNCTION public.restore_budgetku_backup_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_budgetku_backup_v1(jsonb) TO authenticated;
