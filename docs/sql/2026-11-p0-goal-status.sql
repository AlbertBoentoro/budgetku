-- P0: align financial_goals.status CHECK with the status values already used
-- by the existing application's goals UI. STAGED ONLY: do not run in production
-- without explicit approval and a preflight schema/data inspection.
--
-- Live CHECK observed on 2026-11-02:
-- active | paused | completed | cancelled
-- Application writes:
-- active | achieved | archived
--
-- Preserve legacy values to avoid rejecting any existing records. A later
-- migration can normalize semantics only after a separate UX/data review.
BEGIN;
ALTER TABLE public.financial_goals
  DROP CONSTRAINT IF EXISTS financial_goals_status_check;
ALTER TABLE public.financial_goals
  ADD CONSTRAINT financial_goals_status_check
  CHECK (status IN (
    'active', 'paused', 'completed', 'cancelled', 'achieved', 'archived'
  ));
COMMIT;
-- Rollback: never remove statuses while matching rows still exist.
-- Instead revert application code first and reconcile legacy/new values.
