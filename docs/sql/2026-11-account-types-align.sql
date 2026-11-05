-- F-02 (audit PR #31): align accounts.account_type CHECK with the values the
-- application writes. STAGED ONLY: apply to staging first; do not run in
-- production without explicit approval and the preflight below.
--
-- Live CHECK observed on 2026-11-05 (production, read-only):
--   bank | cash | ewallet | credit_card | investment | other
-- Application writes (lib/account-types.ts ACCOUNT_TYPE_VALUES):
--   cash | bank | ewallet | credit_card | savings | investment
-- So "savings" (Tabungan) was always rejected. The app previously sent
-- "e_wallet"; it now sends "ewallet", which the live CHECK already accepts.
--
-- This patch only WIDENS the constraint (adds "savings", keeps "other"), so no
-- existing row can be rejected. It also normalizes any "e_wallet" rows that
-- could exist in an environment where the old CHECK was absent; production
-- had 0 such rows on 2026-11-05 because the old CHECK rejected them.
--
-- Preflight (read-only), expect zero rows outside the new set:
--   SELECT account_type, count(*) FROM public.accounts GROUP BY 1;
BEGIN;

UPDATE public.accounts
SET account_type = 'ewallet'
WHERE account_type = 'e_wallet';

DO $$
DECLARE v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad FROM public.accounts
  WHERE account_type NOT IN (
    'cash', 'bank', 'ewallet', 'credit_card', 'savings', 'investment', 'other'
  );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'accounts has % row(s) with an unknown account_type; review before applying', v_bad;
  END IF;
END $$;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_account_type_check;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_account_type_check
  CHECK (account_type IN (
    'cash', 'bank', 'ewallet', 'credit_card', 'savings', 'investment', 'other'
  ));

COMMIT;

-- Verify after applying:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'accounts_account_type_check';
-- Then in the app (staging): create and edit an account of type E-wallet and
-- of type Tabungan; both must save.
--
-- Rollback: do not remove "savings" while rows with that type exist. Revert
-- the application first, then move such rows to another type in a reviewed
-- change before narrowing the CHECK again.
