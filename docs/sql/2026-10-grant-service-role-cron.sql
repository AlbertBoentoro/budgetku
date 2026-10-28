-- Budgetku — grant the service role the table access the daily Cron needs
-- Date: 2026-10
--
-- WHY:
--   /api/cron/settings (daily backup and reminders) uses the service-role key
--   (lib/supabase/admin.ts). Every table query it makes fails with
--   "permission denied for table ..." (HTTP 403). The service role bypasses RLS,
--   but it still needs table-level GRANTs. This project's default privileges
--   for tables created by `postgres` give service_role only TRUNCATE,
--   REFERENCES, TRIGGER, and MAINTAIN, and the earlier migrations only granted
--   table access to `authenticated`.
--
-- WHAT (least privilege, only what the Cron reads or writes):
--   - SELECT on the tables included in the backup (lib/settings/backup.ts).
--   - SELECT, INSERT, UPDATE on user_settings (backup status, reminder date).
--   - SELECT, DELETE on push_subscriptions (reminder delivery, expired cleanup).
--   The Gmail tables (OAuth secrets) and profiles are intentionally not granted.
--
-- This does NOT change RLS policies, data, or what anon/authenticated can do.
-- The service-role key stays server-only (SUPABASE_SERVICE_ROLE_KEY).
-- SAFE TO RE-RUN: GRANT is idempotent.
--
-- CARA MENJALANKAN: Supabase Studio → SQL Editor → tempel seluruh file → Run.
-- Lalu jalankan Cron dari Vercel (Settings → Cron Jobs → Run) atau tunggu
-- jadwal berikutnya, dan pastikan log tidak lagi berisi "permission denied".

grant select on
  public.accounts,
  public.budgets,
  public.budget_items,
  public.categories,
  public.transactions,
  public.recurring_transactions,
  public.financial_goals,
  public.goal_contributions,
  public.merchant_rules
to service_role;

grant select, insert, update on public.user_settings to service_role;

grant select, delete on public.push_subscriptions to service_role;

-- Verify afterwards (optional): every row should show true.
-- select c.relname,
--        has_table_privilege('service_role', c.oid, 'SELECT') as can_select
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'accounts', 'budgets', 'budget_items', 'categories', 'transactions',
--     'recurring_transactions', 'financial_goals', 'goal_contributions',
--     'merchant_rules', 'user_settings', 'push_subscriptions'
--   )
-- order by 1;
