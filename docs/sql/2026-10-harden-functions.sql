-- Budgetku — harden database functions flagged by the Supabase security advisor
-- Date: 2026-10
--
-- WHY (Supabase advisor lints 0011, 0028, 0029):
--   1. Seven SECURITY DEFINER functions had the default EXECUTE grant to PUBLIC,
--      so `anon` and `authenticated` could reach them via /rest/v1/rpc/<name>.
--      They are all trigger / event-trigger functions and are never meant to be
--      called directly.
--   2. set_updated_at and validate_budget_month had no fixed search_path.
--
-- WHAT:
--   - Revoke EXECUTE from PUBLIC, anon, and authenticated on those functions.
--     Triggers keep working: Postgres checks EXECUTE on a trigger function only
--     when the trigger is created, not each time it fires.
--   - Pin search_path to '' on the two functions. Their bodies only use
--     NEW.<column>, now(), and date_trunc(), which live in pg_catalog (always
--     searched), so behavior does not change.
--
-- This does NOT touch tables, RLS policies, data, or function bodies.
-- SAFE TO RE-RUN: REVOKE and ALTER FUNCTION ... SET are idempotent.
--
-- CARA MENJALANKAN: Supabase Studio → SQL Editor → tempel seluruh file → Run.
-- Setelah itu, uji cepat di aplikasi: tambah satu transaksi lalu hapus lagi
-- (memastikan trigger validasi dan updated_at tetap berjalan).

-- ---------------------------------------------------------------------------
-- 1. Revoke direct RPC access to SECURITY DEFINER trigger functions
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()                from public, anon, authenticated;
revoke execute on function public.validate_budget_item()           from public, anon, authenticated;
revoke execute on function public.validate_goal_contribution()     from public, anon, authenticated;
revoke execute on function public.validate_merchant_rule()         from public, anon, authenticated;
revoke execute on function public.validate_recurring_transaction() from public, anon, authenticated;
revoke execute on function public.validate_transaction_category()  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on functions that had none
-- ---------------------------------------------------------------------------
alter function public.set_updated_at()        set search_path = '';
alter function public.validate_budget_month() set search_path = '';

-- ---------------------------------------------------------------------------
-- Verify afterwards (optional, read-only):
--   - acl must no longer list anon / authenticated / "=X" (PUBLIC)
--   - proconfig for the two functions must show search_path=""
--
-- select proname, prosecdef, proconfig, proacl::text
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
-- order by proname;
--
-- Then re-run Advisors → Security in the dashboard: lints 0011, 0028, and 0029
-- for these functions should be gone.
-- ---------------------------------------------------------------------------
