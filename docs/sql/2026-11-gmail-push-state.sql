-- Apply to staging first. No existing data deleted or changed.
begin;
alter table public.email_connections
  add column if not exists push_history_id text,
  add column if not exists push_watch_expires_at timestamptz,
  add column if not exists push_last_success_at timestamptz;
-- Existing message dedup must be enforced, even during simultaneous pushes.
create unique index if not exists email_imports_user_id_gmail_message_id_key
  on public.email_imports (user_id, gmail_message_id);
commit;
