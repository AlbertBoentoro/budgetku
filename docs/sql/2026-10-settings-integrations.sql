-- Budgetku account settings: private backups, daily reminders, and passkeys.
-- Run once in the Supabase SQL Editor before enabling the related app controls.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'id-ID' check (locale = 'id-ID'),
  currency text not null default 'IDR' check (currency = 'IDR'),
  first_day_of_week text not null default 'monday'
    check (first_day_of_week in ('monday', 'sunday')),
  daily_reminder_enabled boolean not null default false,
  daily_reminder_time time not null default '20:00',
  cloud_backup_enabled boolean not null default false,
  passkey_enabled boolean not null default false,
  last_backup_at timestamptz,
  last_reminder_sent_on date,
  updated_at timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists first_day_of_week text not null default 'monday'
    check (first_day_of_week in ('monday', 'sunday'));

alter table public.user_settings enable row level security;
revoke all on public.user_settings from authenticated;
grant select on public.user_settings to authenticated;
grant insert (
  user_id, locale, currency, first_day_of_week, daily_reminder_enabled,
  daily_reminder_time, cloud_backup_enabled, updated_at
) on public.user_settings to authenticated;
grant update (
  locale, currency, first_day_of_week, daily_reminder_enabled,
  daily_reminder_time, cloud_backup_enabled, updated_at
) on public.user_settings to authenticated;

drop policy if exists "Users can view own settings" on public.user_settings;
drop policy if exists "Users can create own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Users can delete own settings" on public.user_settings;

create policy "Users can view own settings"
  on public.user_settings for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can create own settings"
  on public.user_settings for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.user_settings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subscription)
);

alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can create own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;

create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can create own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.passkey_credentials (
  credential_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text not null default 'Perangkat ini',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.passkey_credentials enable row level security;
revoke all on public.passkey_credentials from authenticated;
grant select on public.passkey_credentials to authenticated;
create index if not exists passkey_credentials_user_id_idx
  on public.passkey_credentials (user_id);

drop policy if exists "Users can view own passkeys" on public.passkey_credentials;
drop policy if exists "Users can create own passkeys" on public.passkey_credentials;
drop policy if exists "Users can update own passkeys" on public.passkey_credentials;
drop policy if exists "Users can delete own passkeys" on public.passkey_credentials;

create policy "Users can view own passkeys"
  on public.passkey_credentials for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge text not null,
  purpose text not null check (purpose in ('registration', 'authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.passkey_challenges enable row level security;
grant select, insert, delete on public.passkey_challenges to authenticated;
create index if not exists passkey_challenges_user_expiry_idx
  on public.passkey_challenges (user_id, expires_at);

drop policy if exists "Users can view own passkey challenges" on public.passkey_challenges;
drop policy if exists "Users can create own passkey challenges" on public.passkey_challenges;
drop policy if exists "Users can delete own passkey challenges" on public.passkey_challenges;

create policy "Users can view own passkey challenges"
  on public.passkey_challenges for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can create own passkey challenges"
  on public.passkey_challenges for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can delete own passkey challenges"
  on public.passkey_challenges for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.consume_passkey_challenge(
  p_challenge_id uuid,
  p_challenge text,
  p_purpose text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with consumed as (
    delete from public.passkey_challenges
    where id = p_challenge_id
      and user_id = auth.uid()
      and challenge = p_challenge
      and purpose = p_purpose
      and expires_at > now()
    returning id
  )
  select exists (select 1 from consumed);
$$;

revoke all on function public.consume_passkey_challenge(uuid, text, text)
  from public, anon;

grant execute on function public.consume_passkey_challenge(uuid, text, text)
  to authenticated;

create or replace function public.disable_passkeys(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_user_id is null then
    raise exception 'Service role required';
  end if;

  delete from public.passkey_credentials
  where user_id = p_user_id;

  update public.user_settings
  set passkey_enabled = false,
      updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.disable_passkeys(uuid)
  from public, anon, authenticated;
grant execute on function public.disable_passkeys(uuid) to service_role;

create or replace function public.register_passkey(
  p_user_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports text[],
  p_device_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_user_id is null then
    raise exception 'Service role required';
  end if;

  insert into public.passkey_credentials (
    credential_id, user_id, public_key, counter, transports, device_name
  )
  values (
    p_credential_id, p_user_id, p_public_key, p_counter, p_transports, p_device_name
  );

  insert into public.user_settings (user_id, passkey_enabled)
  values (p_user_id, true)
  on conflict (user_id)
  do update set passkey_enabled = true, updated_at = now();

  return true;
end;
$$;

revoke all on function public.register_passkey(uuid, text, text, bigint, text[], text)
  from public, anon, authenticated;
grant execute on function public.register_passkey(uuid, text, text, bigint, text[], text)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('budgetku-backups', 'budgetku-backups', false, 10485760, array['application/json'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view own Budgetku backups" on storage.objects;
drop policy if exists "Users can create own Budgetku backups" on storage.objects;
drop policy if exists "Users can update own Budgetku backups" on storage.objects;
drop policy if exists "Users can delete own Budgetku backups" on storage.objects;

create policy "Users can view own Budgetku backups"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'budgetku-backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can create own Budgetku backups"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'budgetku-backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can update own Budgetku backups"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'budgetku-backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'budgetku-backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can delete own Budgetku backups"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'budgetku-backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
