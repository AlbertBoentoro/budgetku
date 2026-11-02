-- Read/write only to disposable CI database; authenticated fixture user.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Monthly Jan31 clamp, amount/type/source/reference and schedule move.
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-01-31');
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.transactions
 WHERE source='recurring' AND source_reference =
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1:2026-01-31';
 IF n <> 1 THEN RAISE EXCEPTION 'Monthly occurrence expected once, got %',n; END IF;
 IF (SELECT next_due_date FROM public.recurring_transactions
     WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> '2026-02-28'::date THEN
   RAISE EXCEPTION 'Month-end clamp failed';
 END IF;
 IF (SELECT amount FROM public.transactions WHERE source_reference =
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1:2026-01-31') <> 50000 THEN
   RAISE EXCEPTION 'Incorrect transaction amount';
 END IF;
END $$;

-- Same request twice: never book next month by accident.
DO $$
BEGIN
 PERFORM public.generate_recurring_now(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','2026-01-31');
 RAISE EXCEPTION 'Stale request unexpectedly succeeded' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;

-- User B cannot access user A's template, even with a known UUID.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 PERFORM public.generate_recurring_now(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','2026-02-01');
 RAISE EXCEPTION 'Cross-user request succeeded' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Transfer: destination exists, category null, next date +14 days.
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','2026-02-01');
DO $$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM public.transactions WHERE source_reference =
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2:2026-02-01'
 AND transaction_type='transfer'
 AND account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
 AND destination_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
 AND category_id IS NULL) THEN
 RAISE EXCEPTION 'Transfer transaction incorrect';
 END IF;
 IF (SELECT next_due_date FROM public.recurring_transactions
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') <> '2026-02-15'::date THEN
 RAISE EXCEPTION 'Biweekly schedule wrong';
 END IF;
END $$;

-- End date: one final occurrence, auto pause.
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','2026-01-31');
DO $$
BEGIN
 IF (SELECT is_active FROM public.recurring_transactions
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3') IS DISTINCT FROM false THEN
 RAISE EXCEPTION 'Expired recurrence remained active';
 END IF;
END $$;

-- Force insert failure -> no occurrence, no change to schedule.
DO $$
BEGIN
 PERFORM public.generate_recurring_now(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','2026-01-31');
 RAISE EXCEPTION 'Failing insert unexpectedly succeeded' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
END $$;
DO $$
BEGIN
 IF (SELECT next_due_date FROM public.recurring_transactions
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4') <> '2026-01-31'::date THEN
 RAISE EXCEPTION 'Schedule moved despite failed write';
 END IF;
 IF EXISTS (SELECT 1 FROM public.transactions WHERE source_reference =
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4:2026-01-31') THEN
 RAISE EXCEPTION 'Partial ledger write from failure';
 END IF;
END $$;

-- Archived account and category must be blocked.
UPDATE public.accounts SET is_archived=true
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
DO $$
BEGIN
 PERFORM public.generate_recurring_now(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6','2026-01-31');
 RAISE EXCEPTION 'Archived account accepted' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;
UPDATE public.accounts SET is_archived=false
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
UPDATE public.categories SET is_archived=true
WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
DO $$
BEGIN
 PERFORM public.generate_recurring_now(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7','2026-01-31');
 RAISE EXCEPTION 'Archived category accepted' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;
UPDATE public.categories SET is_archived=false
WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

RESET ROLE;
DO $$
BEGIN
 IF has_function_privilege('anon','public.generate_recurring_now(uuid,date)','EXECUTE') THEN
 RAISE EXCEPTION 'anon has execute permission unexpectedly';
 END IF;
END $$;
SELECT 'PASS: atomic recurring integration fixtures' AS result;
