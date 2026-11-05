-- STAGED ONLY: Prevent duplicate active user-owned category names.
-- No changes to existing default/system categories or transaction history.
-- Preflight: SELECT user_id, category_type,
--   lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
--   count(*) FROM public.categories WHERE user_id IS NOT NULL AND NOT is_archived
--   GROUP BY 1,2,3 HAVING count(*) > 1;
-- Only apply after inspecting any existing duplicates. This index allows
-- archived categories and system names (user_id IS NULL) to remain unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_active_type_name_uidx
ON public.categories (
  user_id,
  category_type,
  lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
)
WHERE user_id IS NOT NULL AND is_archived = false;

-- Rollback (reviewed only):
-- DROP INDEX public.categories_user_active_type_name_uidx;
