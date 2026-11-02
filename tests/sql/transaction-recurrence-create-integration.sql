-- Tests run ONLY in the disposable PostgreSQL database created by CI.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Initial expense and monthly schedule should commit atomically.
SELECT public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','expense',50000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
 'Monthly expense','shop','Monthly expense','monthly',null);

DO $$
DECLARE v_source text := 'initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
BEGIN
 IF (SELECT count(*) FROM public.transactions WHERE source_reference=v_source) <> 1 THEN
   RAISE EXCEPTION 'Expected one initial ledger row';
 END IF;
 IF (SELECT count(*) FROM public.recurring_transactions
     WHERE name='Monthly expense') <> 1 THEN
   RAISE EXCEPTION 'Expected one template';
 END IF;
 IF (SELECT next_due_date FROM public.recurring_transactions
     WHERE name='Monthly expense') <> '2026-02-28'::date THEN
   RAISE EXCEPTION 'Jan 31 clamp failed';
 END IF;
END $$;

-- Identical retry returns the first transaction ID without adding anything.
DO $$
DECLARE v_saved uuid; v_again uuid;
BEGIN
 SELECT id INTO v_saved FROM public.transactions
 WHERE source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
 v_again:=public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','expense',50000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
 'Monthly expense','shop','Monthly expense','monthly',null);
 IF v_again IS DISTINCT FROM v_saved THEN
  RAISE EXCEPTION 'Retry did not return existing transaction';
 END IF;
 IF (SELECT count(*) FROM public.transactions
    WHERE source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 1
    OR (SELECT count(*) FROM public.recurring_transactions
        WHERE name='Monthly expense') <> 1 THEN
  RAISE EXCEPTION 'Duplicate ledger or template on retry';
 END IF;
END $$;

-- Same request key, different amount must never be silently accepted.
DO $$
BEGIN
 PERFORM public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1','expense',60000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
 'Monthly expense','shop','Monthly expense','monthly',null);
 RAISE EXCEPTION 'Conflicting retry should fail' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;

-- Synthetic INSERT failure must roll back the entire request.
DO $$
BEGIN
 PERFORM public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2','expense',30000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
 'failing recurrence','fail-test','Do not persist','monthly',null);
 RAISE EXCEPTION 'Forced failure unexpectedly succeeded' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
END $$;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.transactions WHERE
  source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc2')
  OR EXISTS(SELECT 1 FROM public.recurring_transactions WHERE name='Do not persist') THEN
  RAISE EXCEPTION 'Partial transaction survived failed insert';
 END IF;
END $$;

-- Invalid category/account ownership is rejected by server-side checks.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 PERFORM public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3','expense',40000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
 null,null,'not allowed','monthly',null);
 RAISE EXCEPTION 'Cross-user insert succeeded' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Transfer has exactly one ledger record and one matching schedule.
SELECT public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4','transfer',120000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',null,
 '2026-03-10','Transfer rutin',null,'Transfer rutin','weekly',null);
DO $$
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM public.transactions WHERE
 source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
 AND destination_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
 AND category_id IS NULL AND transaction_type='transfer') THEN
 RAISE EXCEPTION 'Transfer was stored incorrectly';
 END IF;
 IF (SELECT next_due_date FROM public.recurring_transactions
     WHERE name='Transfer rutin') <> '2026-03-17'::date THEN
 RAISE EXCEPTION 'Weekly schedule day incorrect';
 END IF;
END $$;

-- End date at initial occurrence must not leave an inactive schedule active.
SELECT public.create_transaction_with_recurring(
 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5','income',90000,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','2026-01-31',
 'One last income',null,'One last income','monthly','2026-01-31');
DO $$
BEGIN
 IF (SELECT is_active FROM public.recurring_transactions
 WHERE name='One last income') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Past-end recurrence incorrectly active';
 END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
 IF has_function_privilege('anon',
 'public.create_transaction_with_recurring(uuid,text,numeric,uuid,uuid,uuid,date,text,text,text,text,date)', 'EXECUTE') THEN
  RAISE EXCEPTION 'Anon should not execute atomic creation RPC';
 END IF;
END $$;
SELECT 'PASS: new recurring creation atomic and idempotent' AS result;
