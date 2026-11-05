-- Disposable PostgreSQL only. NEVER run on production.
-- Regression test for audit finding F-01 (monthly recurrence drift).
--
-- Run AFTER, in the same database:
--   tests/sql/recurring-fixture.sql
--   docs/sql/2026-11-p0-atomic-recurring.sql
--   tests/sql/recurring-integration.sql
-- recurring-integration.sql records template ...bbb1 (monthly, start
-- 2026-01-31) once, leaving next_due_date = 2026-02-28.
--
-- EXPECTED TO FAIL until F-01 is fixed. It is deliberately not wired into the
-- CI workflow yet, because it would block every pull request.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- Record the Feb 28 occurrence of the Jan-31 schedule.
SELECT public.generate_recurring_now(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-02-28');

DO $$
DECLARE v_next date;
BEGIN
  SELECT next_due_date INTO v_next FROM public.recurring_transactions
  WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  -- A schedule that starts on the 31st must return to the 31st (or the last
  -- day of shorter months), not stay on the 28th from March onward.
  IF v_next <> '2026-03-31'::date THEN
    RAISE EXCEPTION 'F-01 monthly drift: next_due_date is %, expected 2026-03-31', v_next;
  END IF;
END $$;
