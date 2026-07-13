-- WNGS → storefront discount codes.
--
-- A user spends WNGS in the passport (where they're authenticated) to mint a
-- fixed-dollar discount code. They paste it at papillonbrand.us checkout; the
-- storefront validates it server-side, caps it at 30% of the order, applies a
-- one-off Stripe coupon, and the webhook marks it redeemed. Unused codes can be
-- cancelled in the passport for a full WNGS refund.
--
-- Rate: 100 WNGS = $1 off (mirrors the 10-WNGS-per-$1 earn rate → a 10% loop).
-- Run once in Supabase (SQL editor). Idempotent.

create table if not exists public.wngs_discounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id text not null,                 -- Privy DID that minted (and owns) the code
  wngs_spent integer not null,           -- WNGS debited to create it
  discount_usd numeric(10,2) not null,   -- dollar value of the code
  status text not null default 'active', -- 'active' | 'redeemed' | 'cancelled'
  stripe_session_id text,                -- set when redeemed at checkout
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists wngs_discounts_user_idx on public.wngs_discounts (user_id);
create index if not exists wngs_discounts_status_idx on public.wngs_discounts (status);

-- RLS: reads allowed to anon (the storefront validates codes with the anon key
-- when no service key is present); all writes go through the service role,
-- which bypasses RLS. No anon insert/update/delete policy = no tampering.
alter table public.wngs_discounts enable row level security;

drop policy if exists "wngs_discounts anon read" on public.wngs_discounts;
create policy "wngs_discounts anon read"
  on public.wngs_discounts for select
  using (true);
