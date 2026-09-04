-- Public usernames.
--
-- Every profile gets an auto-assigned serial handle (`Monarch#0001`) at first
-- login; a user may later claim a custom one via Settings. Format and
-- reserved-word rules are enforced server-side by the `check_username` /
-- `set_username` actions in api/v2/purchase.js; the constraint below is a
-- backstop. Uniqueness is case-insensitive (COLLECTOR and collector can't both
-- exist) while the chosen casing is preserved for display.
--
-- Run once in Supabase (SQL editor). Idempotent, safe to re-run.

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- Two accepted shapes:
--   user-chosen : 3-20 chars, alphanumeric + underscore
--   auto-serial : Monarch#<digits>
--
-- '#' is deliberately absent from the user-chosen shape. USERNAME_RE in
-- purchase.js rejects it too, so the manual claim path CANNOT mint a
-- `Monarch#...` handle — nobody can grab Monarch#1 by typing it. That property
-- is the whole reason the serial format uses a character the other one forbids.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (
    username is null
    or username ~ '^[a-zA-Z0-9_]{3,20}$'
    or username ~ '^Monarch#[0-9]{1,11}$'
  );

-- Serial source for auto-assigned handles. A sequence rather than max()+1 so
-- concurrent first-logins can't collide. Gaps are expected and harmless: a
-- login that loses the assignment race burns a number.
create sequence if not exists monarch_serial_seq start 1;

-- supabase-js can't call nextval() directly, so expose it as an RPC.
create or replace function next_monarch_serial()
returns bigint
language sql
security definer
set search_path = public
as $$ select nextval('monarch_serial_seq') $$;

revoke all on function next_monarch_serial() from public, anon, authenticated;

-- Verify:
--   select next_monarch_serial();                    -- 1, then 2, 3...
--   select setval('monarch_serial_seq', 1, false);   -- reset before go-live
--   select username from profiles order by username;
