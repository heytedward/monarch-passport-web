-- Applied 2026-09-27 (Supabase migration artifact_daily_taps).
-- One row per owner, per tag, per calendar day. The primary key is what
-- makes the once-a-day tap reward race-free: api/v2/tap-reward.js inserts
-- here first and only pays out when the insert succeeds.
create table if not exists public.artifact_daily_taps (
  user_id    text not null,
  tag_id     text not null,
  tap_day    date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id, tap_day)
);

alter table public.artifact_daily_taps enable row level security;
-- No policies: only the service role (the API) reads or writes it.
revoke all on public.artifact_daily_taps from anon, authenticated;
