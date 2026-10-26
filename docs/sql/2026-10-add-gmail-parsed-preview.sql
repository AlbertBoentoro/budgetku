-- Store parser results for Gmail import drafts so the list can show transaction
-- details without fetching each message when the page loads.
-- Safe to re-run. This does not create transactions or change row policies.
-- Run in the Supabase SQL Editor before deploying code that reads this column.

alter table public.email_imports
  add column if not exists parsed_preview jsonb;

comment on column public.email_imports.parsed_preview is
  'Display-only parser preview for a Gmail draft; never a saved transaction.';
