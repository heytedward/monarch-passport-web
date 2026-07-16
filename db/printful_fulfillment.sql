-- Printful fulfillment link.
--
-- Ties our catalog rows to their Printful sync variants so the Stripe webhook
-- can auto-create a Printful order (print + ship) when a POD item sells, and
-- tracks the created Printful order id for idempotency. Products WITHOUT a
-- printful_variant_id are treated as non-POD (artifacts / manual) and skipped
-- by the fulfillment step.
--
-- Run once in Supabase (SQL editor). Idempotent.

alter table public.product_sizes add column if not exists printful_variant_id bigint;
alter table public.products      add column if not exists printful_product_id bigint;
alter table public.store_orders  add column if not exists printful_order_id text;

create index if not exists product_sizes_pf_variant_idx
  on public.product_sizes (printful_variant_id);
