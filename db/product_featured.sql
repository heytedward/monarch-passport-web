-- Lets the passport Shop spotlight a product for a limited window.
-- src/pages/Shop.tsx already reads featured_until (badge, FEATURED filter,
-- sort-to-top); this column is the missing write side.
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_until timestamptz;
