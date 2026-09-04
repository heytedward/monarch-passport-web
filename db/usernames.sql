-- User-chosen public usernames.
--
-- profiles.username is optional (nullable) until a user claims one via
-- Settings. Format (3-20 chars, alphanumeric + underscore) and reserved-word
-- rules are enforced server-side by the `check_username`/`set_username`
-- actions in api/v2/purchase.js; the constraints below are a backstop.
-- Uniqueness is case-insensitive (COLLECTOR and collector can't both exist)
-- while the chosen casing is preserved for display.
-- Run once in Supabase (SQL editor). Idempotent.

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');
  end if;
end $$;
