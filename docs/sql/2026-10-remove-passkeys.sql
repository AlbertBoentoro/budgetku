-- Budgetku: remove the passkey / biometric lock feature (optional cleanup).
--
-- The app no longer reads or writes any of these objects, so running this file
-- is NOT required for the app to work. It only removes unused tables, functions
-- and the user_settings.passkey_enabled column. Run it in the Supabase SQL
-- Editor once the new app version is deployed. It is safe to run more than once.
-- Dropping the tables permanently deletes all registered passkeys.

drop function if exists public.register_passkey(uuid, text, text, bigint, text[], text);
drop function if exists public.disable_passkeys(uuid);
drop function if exists public.consume_passkey_challenge(uuid, text, text);

drop table if exists public.passkey_challenges;
drop table if exists public.passkey_credentials;

alter table public.user_settings
  drop column if exists passkey_enabled;
