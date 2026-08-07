-- Sellable "sets" -- e.g. a Starter Set (tee + hoodie) plus a bonus WNGS
-- grant, sold as one SKU alongside the existing WNGS bundles and cosmetics.
--
-- Model: a set is a normal `products` row (category = 'SET') so it slots
-- into the existing Shop catalog, handle-based checkout, and purchase_grants
-- flow unchanged -- no new checkout path needed on this side. price_usd is
-- the set's (usually discounted) price; bundle_wngs_bonus is the extra WNGS
-- granted on top of the standard 10-WNGS-per-$1 purchase reward that
-- grantPendingPurchases() already computes from price_usd.
--
-- Run once in Supabase SQL Editor.

alter table products add column if not exists bundle_wngs_bonus int not null default 0;

-- Components of a set: which existing products rows are included and in
-- what quantity. component_product_id can point at a physical garment
-- (TEE/HOODIE/CAP/...) or a cosmetic (AVATAR/THEME) -- whatever the set
-- contains. Deleting a component product is blocked (restrict) so a set
-- can't silently go stale; retire the set first.
create table if not exists product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references products(id) on delete cascade,
  component_product_id uuid not null references products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (bundle_product_id, component_product_id)
);

alter table product_bundle_items enable row level security;
drop policy if exists "product_bundle_items_public_read" on product_bundle_items;
create policy "product_bundle_items_public_read" on product_bundle_items for select using (true);

create index if not exists product_bundle_items_bundle_idx on product_bundle_items (bundle_product_id);

-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
-- SELECT p.name AS set_name, p.price_usd, p.bundle_wngs_bonus,
--        c.name AS component_name, bi.quantity
-- FROM product_bundle_items bi
-- JOIN products p ON p.id = bi.bundle_product_id
-- JOIN products c ON c.id = bi.component_product_id
-- ORDER BY p.name, c.name;
