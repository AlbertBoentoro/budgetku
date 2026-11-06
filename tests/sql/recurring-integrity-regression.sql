-- Run in a DISPOSABLE PostgreSQL CI database only, after existing recurring
-- integration tests and after the financial-integrity function patch.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

-- F-01: a February clamp must not permanently move a 31st-day schedule.
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2022-02-28');
DO $$
BEGIN
  IF (SELECT next_due_date FROM public.recurring_transactions
      WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> '2026-03-31'::date
  THEN RAISE EXCEPTION 'F-01: Feb 28 -> March 31 anchor lost'; END IF;
END $$;
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-03-31');
DO $$
BEGIN
  IF (SELECT next_due_date FROM public.recurring_transactions
      WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> '2026-04-30'::date
  THEN RAISE EXCEPTION 'F-01: March 31 -> April 30 clamp failed'; END IF;
END $$;

-- Yearly Feb 29 returns to leap day, not February 28 forever.
INSERT INTO public.recurring_transactions
 (id,user_id,account_id,category_id,transaction_type,name,amount,
  frequency,interval_count,start_date,next_due_date)
VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8','11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'expense','Leap-year anchor',12345,'yearly',1,'2020-02-29','2021-02-28');
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', '2021-02-28');
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', '2026-02-28');
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', '2023-02-28');
DO $$
BEGIN
  IF (SELECT next_due_date FROM public.recurring_transactions
      WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8') <> '2024-02-29'::date
  THEN RAISE EXCEPTION 'F-01: leap day was not restored in 2024'; END IF;
END $$;

-- F-05: editing a schedule back to the already-recorded initial date must
-- not duplicate the original ledger transaction.
UPDATE public.recurring_transactions
  SET next_due_date='2026-01-31'
  WHERE name='Monthly expense';
DO $$
BEGIN
  PERFORM public.generate_recurring_now(
    (SELECT id FROM public.recurring_transactions WHERE name='Monthly expense'),
    '2026-01-31');
  RAISE EXCEPTION 'F-05: duplicate initial occurrence accepted' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.transactions
    WHERE source_reference='initial-recurring:cccccccc-cccc-4ccc-8ccc-ccccccccccc1') <> 1
  THEN RAISE EXCEPTION 'F-05: original ledger count changed'; END IF;
END $$;

-- Posting tomorrow's expense today must not reduce today's balance.
INSERT INTO public.recurring_transactions
 (id,user_id,account_id,category_id,transaction_type,name,amount,
  frequency,interval_count,start_date,next_due_date)
VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9','11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'expense','Future invoice',12345,'monthly',1,
  (now() AT TIME ZONE 'Asia/Jakarta')::date + 1,
  (now() AT TIME ZONE 'Asia/Jakarta')::date + 1);
DO $$
BEGIN
  PERFORM public.generate_recurring_now(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9',
    (now() AT TIME ZONE 'Asia/Jakarta')::date + 1);
  RAISE EXCEPTION 'F-05: future invoice accepted' USING ERRCODE='XX000';
EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
END $$;

-- F-04: reject fractional and above-recovery-limit atomic creation.
DO $$
DECLARE bad_amount numeric;
BEGIN
  FOREACH bad_amount IN ARRAY ARRAY[12.5::numeric,1000000000001::numeric] LOOP
    BEGIN
      PERFORM public.create_transaction_with_recurring(
        gen_random_uuid(),'expense',bad_amount,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null,
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','2026-01-31',
        null,null,'Invalid amount','monthly',null);
      RAISE EXCEPTION 'F-04: invalid amount accepted' USING ERRCODE='XX000';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
  END LOOP;
END $$;

RESET ROLE;
SELECT 'PASS: recurring integrity F-01/F-04/F-05' AS result;
