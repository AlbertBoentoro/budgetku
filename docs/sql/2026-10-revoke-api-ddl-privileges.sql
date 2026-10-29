-- Budgetku — revoke REFERENCES, TRIGGER, and MAINTAIN from the API roles
-- Date: 2026-10
--
-- WHY:
--   anon holds REFERENCES, TRIGGER, and MAINTAIN on 14 of the 15 public tables
--   and authenticated on 13. They come from this project's default privileges
--   for tables created by `postgres`, the same source as the TRUNCATE grant
--   removed in 2026-10-revoke-api-truncate.sql. The app never uses them, and
--   there is no known way to use them today: both roles are NOLOGIN, PostgREST
--   only runs data queries and RPC calls, the roles have no CREATE privilege on
--   any schema, and they cannot call any function in public. This removes them
--   as defense in depth:
--   - TRIGGER: a trigger added to a table runs with the privileges of whoever
--     modifies the table, including the service role in the daily Cron.
--   - REFERENCES: foreign key checks bypass RLS, and foreign key enforcement
--     can be made to call functions with the table owner's privileges.
--   - MAINTAIN (PostgreSQL 17): VACUUM, ANALYZE, CLUSTER, REINDEX,
--     REFRESH MATERIALIZED VIEW, and LOCK TABLE, which can block the app.
--     authenticated can still LOCK the tables it can UPDATE or DELETE; that
--     comes from those privileges, not from MAINTAIN.
--
-- WHAT:
--   - Revoke the three privileges from anon and authenticated on every table
--     in public. Column-level REFERENCES grants are revoked with them.
--   - Stop granting them on tables `postgres` creates later.
--
-- This does NOT change SELECT/INSERT/UPDATE/DELETE, RLS policies, data,
-- existing triggers or foreign keys, or the service role.
-- From now on, grant table access with explicit privileges
-- (select, insert, update, delete). GRANT ALL would bring these privileges,
-- and TRUNCATE, back on that table.
-- SAFE TO RE-RUN: REVOKE and ALTER DEFAULT PRIVILEGES ... REVOKE are idempotent.
--
-- CARA MENJALANKAN: Supabase Studio → SQL Editor → tempel seluruh file → Run.
-- Lalu jalankan query verifikasi di bawah; semua angka harus 0.

revoke references, trigger, maintain on all tables in schema public
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke references, trigger, maintain on tables from anon, authenticated;

-- Verify afterwards (optional): every count should be 0.
-- select
--   count(*) filter (where has_any_column_privilege('anon', c.oid, 'REFERENCES'))
--     as anon_references,
--   count(*) filter (where has_table_privilege('anon', c.oid, 'TRIGGER'))
--     as anon_trigger,
--   count(*) filter (where has_table_privilege('anon', c.oid, 'MAINTAIN'))
--     as anon_maintain,
--   count(*) filter (where has_any_column_privilege('authenticated', c.oid, 'REFERENCES'))
--     as authenticated_references,
--   count(*) filter (where has_table_privilege('authenticated', c.oid, 'TRIGGER'))
--     as authenticated_trigger,
--   count(*) filter (where has_table_privilege('authenticated', c.oid, 'MAINTAIN'))
--     as authenticated_maintain
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind in ('r', 'p');

-- Rollback (only if ever needed). This grants the privileges on every table,
-- slightly broader than before: email_connection_secrets (both roles) and
-- user_settings (authenticated) did not have them.
-- grant references, trigger, maintain on all tables in schema public
--   to anon, authenticated;
-- alter default privileges for role postgres in schema public
--   grant references, trigger, maintain on tables to anon, authenticated;
