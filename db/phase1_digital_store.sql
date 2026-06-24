-- ============================================================================
-- PHASE 1 — DIGITAL STORE FORGE  (themes + avatar skins, Fortnite-style)
-- Run this in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS guards).
--
-- Model: each theme/avatar is a shared cosmetic = one products row.
-- No NFTs, no per-user generation, no user_assets changes. Ownership stays
-- the existing one-row-per-(user, product) in user_assets.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Themes become data-driven (accent color + light/dark mode) instead of being
-- hardcoded in App.tsx. The generator writes these for new themes.
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS accent_color text;   -- e.g. '#FFB000'
ALTER TABLE products ADD COLUMN IF NOT EXISTS theme_mode   text;   -- 'light' | 'dark'

-- ----------------------------------------------------------------------------
-- Avatar skins: a fixed 9-color De Stijl palette stored on the product, shared
-- by everyone who owns it. Rendered by the DeStijlAvatar component (with its
-- constant blinking eyes + mouth). image_url already exists for full art later.
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS palette jsonb;       -- ["#FFB000","#000000", ... 9 hex]

-- ----------------------------------------------------------------------------
-- Shop organization + mid-season drops (holidays, Valentine's, etc).
-- All nullable -- leave blank for an always-available, ungrouped item.
--   collection  = grouping label, e.g. 'S01_CORE', 'S01_VALENTINES'
--   season      = season tag, e.g. 'S01'
--   edition     = special-edition facet, e.g. 'STANDARD' | 'VALENTINES' | 'HOLIDAY'
--   available_* = drop window (NULL = always available)
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection      text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS season          text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS edition         text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_from  timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_until timestamptz;

-- ----------------------------------------------------------------------------
-- Backfill the 3 existing themes so the data-driven accent works immediately
-- ----------------------------------------------------------------------------
UPDATE products SET accent_color = '#FFB000', theme_mode = 'light' WHERE name = 'SYSTEM_LIGHT';
UPDATE products SET accent_color = '#FFB000', theme_mode = 'dark'  WHERE name = 'SYSTEM_DARK';
UPDATE products SET accent_color = '#DC143C', theme_mode = 'dark'  WHERE name = 'CRIMSON_OVERRIDE';

-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
-- SELECT name, category, rarity, accent_color, theme_mode, palette,
--        collection, season, edition, available_from, available_until, price_wngs
-- FROM products ORDER BY category, name;
