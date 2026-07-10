-- In-house physical product catalog (replaces Shopify).
--
-- Physical garments live in the shared `products` table alongside cosmetics
-- (category = HOODIE / TEE / CAP / SWEATS / ACCESSORY -- anything outside the
-- digital categories renders as physical). This adds the fields Shopify used
-- to provide (description, image gallery) plus per-size stock tracking and an
-- order log for the storefront's Stripe webhook.
--
-- Run once in Supabase SQL Editor.

-- 1. Product content fields
alter table products add column if not exists description text;
alter table products add column if not exists images jsonb not null default '[]'::jsonb;
-- URL slug; the join key across storefront checkout, stock decrement, and
-- passport closet grants. Set by the forge (slug of the name).
alter table products add column if not exists handle text;
create unique index if not exists products_handle_idx on products (handle) where handle is not null;

-- 2. Per-size stock. One row per (product, size); stock decrements on the
-- storefront Stripe webhook. Anon can read (the shop shows availability);
-- only the service role writes.
create table if not exists product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, size)
);

alter table product_sizes enable row level security;
drop policy if exists "product_sizes_public_read" on product_sizes;
create policy "product_sizes_public_read" on product_sizes for select using (true);

create index if not exists product_sizes_product_idx on product_sizes (product_id);

-- 3. Order log (one row per Stripe checkout session; written by the webhook).
-- Service-role only: RLS on with no policies.
create table if not exists store_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  email text,
  items jsonb not null default '[]'::jsonb,   -- [{ handle, name, size, quantity, unit_usd }]
  total_usd numeric,
  created_at timestamptz not null default now()
);

alter table store_orders enable row level security;
