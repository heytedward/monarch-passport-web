-- Public callsign lookup for link previews.
--
-- `profiles` is RLS-locked to its owner, so neither an anonymous visitor nor
-- the OG middleware can read a username directly. This exposes exactly one
-- field, addressed by exactly one id.
--
-- A FUNCTION rather than a view, deliberately: a view granted to `anon` would
-- let anyone holding the (public) anon key SELECT the whole table and
-- enumerate every member's id and handle. This shape requires you to already
-- know the Privy DID — which you only have if someone shared their link with
-- you — so there is nothing to list.
--
-- SECURITY DEFINER is what lets it see through RLS; search_path is pinned so a
-- caller-controlled schema can't hijack the lookup (Supabase linter 0011).
--
-- Run once in Supabase (SQL editor). Idempotent.

create or replace function public.public_callsign(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select username from public.profiles where id = p_id
$$;

revoke all on function public.public_callsign(text) from public;
grant execute on function public.public_callsign(text) to anon, authenticated;

-- Verify:
--   select public.public_callsign('did:privy:...');   -- the handle, or null
--   select public.public_callsign('nope');            -- null, no error
