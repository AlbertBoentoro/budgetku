-- Budgetku — add missing RLS policies for Gmail import tables
-- Date: 2026-10
--
-- WHY: email_connection_secrets had NO RLS policies at all, and email_imports
-- had only a SELECT policy. With RLS enabled and no write policy, every
-- INSERT/UPDATE/DELETE is denied — which is why connecting Gmail, syncing, and
-- disconnecting all failed with a silent persist error.
--
-- WHAT: add per-user policies ( auth.uid() = user_id ) mirroring the existing,
-- correct policies on public.email_connections. This TIGHTENS access (each user
-- can only touch their own rows); it does NOT disable RLS or widen access.
--
-- SAFE TO RE-RUN: every statement is guarded so running it twice is harmless.
-- Read-only? No — this changes database policies. Review before running.

-- Ensure RLS is enabled (no-op if already enabled).
alter table public.email_connection_secrets enable row level security;
alter table public.email_imports            enable row level security;

-- ---------------------------------------------------------------------------
-- email_connection_secrets: no policies existed. Add SELECT/INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view own email connection secrets"   on public.email_connection_secrets;
drop policy if exists "Users can create own email connection secrets" on public.email_connection_secrets;
drop policy if exists "Users can update own email connection secrets" on public.email_connection_secrets;
drop policy if exists "Users can delete own email connection secrets" on public.email_connection_secrets;

create policy "Users can view own email connection secrets"
  on public.email_connection_secrets
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own email connection secrets"
  on public.email_connection_secrets
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own email connection secrets"
  on public.email_connection_secrets
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own email connection secrets"
  on public.email_connection_secrets
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- email_imports: only SELECT existed. Add INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can create own email imports" on public.email_imports;
drop policy if exists "Users can update own email imports" on public.email_imports;
drop policy if exists "Users can delete own email imports" on public.email_imports;

create policy "Users can create own email imports"
  on public.email_imports
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own email imports"
  on public.email_imports
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own email imports"
  on public.email_imports
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Verify afterwards (optional): should now list policies for both tables.
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public'
--   and tablename in ('email_connection_secrets','email_imports')
-- order by tablename, cmd;
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- FOLLOW-UP (second run): table-level GRANTs were ALSO missing.
--
-- Symptom: error 42501 "permission denied for table email_connection_secrets"
-- even after RLS policies were added. RLS decides WHICH ROWS; GRANT decides
-- whether the role may touch the table AT ALL (a lower layer). The Gmail tables
-- were created without GRANTs to the `authenticated` role, so the Supabase
-- client (which runs as `authenticated` for a logged-in user) was denied before
-- RLS was even evaluated. Postgres' own hint spelled out the fix.
--
-- WHAT: grant the standard table privileges to `authenticated` on all three
-- Gmail tables. RLS still constrains every statement to the user's own rows,
-- so this does NOT widen cross-user access — it just lets the role reach the
-- table so the row-level policies can apply. Safe to re-run (GRANT is idempotent).
-- ===========================================================================

grant select, insert, update, delete on public.email_connections        to authenticated;
grant select, insert, update, delete on public.email_connection_secrets to authenticated;
grant select, insert, update, delete on public.email_imports            to authenticated;

-- Verify afterwards (optional):
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'authenticated'
--   and table_schema = 'public'
--   and table_name in ('email_connections','email_connection_secrets','email_imports')
-- order by table_name, privilege_type;
