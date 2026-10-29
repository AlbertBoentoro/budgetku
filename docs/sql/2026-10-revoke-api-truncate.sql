-- Budgetku — revoke TRUNCATE from the API roles (anon, authenticated)
-- Date: 2026-10
--
-- WHY:
--   anon has TRUNCATE on 14 of the 15 public tables and authenticated on 13.
--   It comes from this project's default privileges for tables created by
--   `postgres`, which give anon, authenticated, and service_role TRUNCATE,
--   REFERENCES, TRIGGER, and MAINTAIN. RLS does not apply to TRUNCATE, so one
--   statement would empty a table for every user. The app never needs it:
--   PostgREST has no TRUNCATE endpoint, no public function runs TRUNCATE, and
--   these roles cannot create objects in the public schema. There is no known
--   path to use it today; this removes it as defense in depth.
--
-- WHAT:
--   - Revoke TRUNCATE from anon and authenticated on every table in public.
--   - Stop granting it to them on tables `postgres` creates later.
--
-- This does NOT change SELECT/INSERT/UPDATE/DELETE, RLS policies, data, or the
-- service role (the daily Cron keeps its grants). Tables created by Supabase
-- itself (role supabase_admin) follow Supabase's own defaults, which the
-- postgres role cannot change.
-- SAFE TO RE-RUN: REVOKE and ALTER DEFAULT PRIVILEGES ... REVOKE are idempotent.
--
-- CARA MENJALANKAN: Supabase Studio → SQL Editor → tempel seluruh file → Run.
-- Tidak ada fitur aplikasi yang memakai TRUNCATE, jadi cukup jalankan query
-- verifikasi di bawah setelahnya.

revoke truncate on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

-- Verify afterwards (optional): both counts should be 0.
-- select
--   count(*) filter (where has_table_privilege('anon', c.oid, 'TRUNCATE'))
--     as anon_truncate,
--   count(*) filter (where has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
--     as authenticated_truncate
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind in ('r', 'p');
