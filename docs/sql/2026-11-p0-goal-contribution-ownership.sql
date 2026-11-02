-- P0: prevent contributions from referencing another user's goal.
-- STAGED ONLY: do not apply to production without explicit approval.
-- Keeps the existing ON DELETE CASCADE behavior.
--
-- Live read-only precheck on 2026-11-02 returned 0 owner mismatches.
-- The migration independently verifies this precondition again.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.goal_contributions AS c
    JOIN public.financial_goals AS g ON g.id = c.goal_id
    WHERE c.user_id IS DISTINCT FROM g.user_id
  ) THEN
    RAISE EXCEPTION 'Inconsistent goal contribution ownership; abort';
  END IF;
END $$;

ALTER TABLE public.financial_goals
  ADD CONSTRAINT financial_goals_user_id_id_key UNIQUE (user_id, id);

ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_user_id_goal_id_fkey
  FOREIGN KEY (user_id, goal_id)
  REFERENCES public.financial_goals (user_id, id)
  ON DELETE CASCADE;

ALTER TABLE public.goal_contributions
  DROP CONSTRAINT goal_contributions_goal_id_fkey;
COMMIT;
-- Production preflight: check existing index names/constraint names, RLS,
-- and the owner mismatch count. The above statements are NOT run live.
