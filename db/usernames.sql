-- Usernames picked by the member, shown on Profile and the feed instead of
-- anything derived from their sign-in email.
--
-- profiles.username already exists in the live schema but was never used; this
-- makes sure it exists, enforces the format, and makes it unique regardless of
-- case (stored lowercase by api/v2/purchase.js `set_username`).
--
-- Format: 3 to 20 characters, lowercase letters, numbers and hyphens, starting
-- and ending with a letter or number. No underscores (on-screen text rule).
-- Run once in Supabase (SQL editor). Idempotent.

alter table public.profiles add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9]([a-z0-9-]{1,18})[a-z0-9]$');
  end if;
end $$;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;
