-- STAGED ONLY — do not apply to production without explicit user approval.
-- Legacy duplicate names are NOT deleted, merged, or renamed.
-- Enforces uniqueness for NEW names and name changes across all account types,
-- including archived accounts. Editing other fields of a grandfathered
-- duplicate is allowed, even when the update payload includes its unchanged name.
--
-- Preflight: SELECT user_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS key,
--                  count(*) FROM public.accounts GROUP BY 1,2 HAVING count(*)>1;
-- The trigger intentionally supports existing duplicates. Do not create a
-- UNIQUE index until the owner has individually resolved legacy duplicates.

BEGIN;
CREATE OR REPLACE FUNCTION public.reject_duplicate_account_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  next_key text := lower(regexp_replace(btrim(NEW.name), '[[:space:]]+', ' ', 'g'));
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.user_id = OLD.user_id
     AND next_key = lower(regexp_replace(btrim(OLD.name), '[[:space:]]+', ' ', 'g'))
  THEN
    RETURN NEW;
  END IF;

  -- Serialize writes per owner to prevent two concurrent duplicate inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 42));

  IF EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.user_id = NEW.user_id
      AND a.id IS DISTINCT FROM NEW.id
      AND lower(regexp_replace(btrim(a.name), '[[:space:]]+', ' ', 'g')) = next_key
  ) THEN
    RAISE EXCEPTION 'duplicate_account_name'
      USING ERRCODE = '23505', CONSTRAINT = 'accounts_owner_normalized_name_guard';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_reject_duplicate_name ON public.accounts;
CREATE TRIGGER accounts_reject_duplicate_name
BEFORE INSERT OR UPDATE OF name, user_id ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.reject_duplicate_account_name();
COMMIT;

-- Verify: SELECT pg_get_triggerdef(oid) FROM pg_trigger
--         WHERE tgrelid='public.accounts'::regclass AND tgname='accounts_reject_duplicate_name';
-- Rollback (reviewed only): DROP TRIGGER accounts_reject_duplicate_name ON public.accounts;
--                          DROP FUNCTION public.reject_duplicate_account_name();
