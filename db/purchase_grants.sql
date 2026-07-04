-- Storefront purchase -> Passport Closet auto-grant queue.
--
-- monarch-labs' Stripe webhook (api/reduce-inventory.ts) inserts one row per
-- purchased line item, keyed by the buyer's Stripe checkout email. The
-- Passport grants them on login (api/v2/purchase.js ensure_profile) by
-- matching the Privy account's email(s), minting one already-activated
-- artifact per unit so the item appears in the Closet vault.
--
-- Run once in Supabase SQL Editor.

create table if not exists purchase_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,                     -- lowercased Stripe customer email
  product_handle text not null,
  product_name text,
  quantity int not null default 1,
  stripe_session_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'GRANTED')),
  granted_to text,                         -- Privy DID once claimed
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (stripe_session_id, product_handle)
);

-- Service-role only: RLS on with no anon/user policies. The webhook and the
-- passport API both use the service key; browsers never touch this table.
alter table purchase_grants enable row level security;

create index if not exists purchase_grants_pending_email_idx
  on purchase_grants (email) where status = 'PENDING';
