-- ============================================================================
-- PHASE 2 — ASCENSION (seasonal battlepass: free + premium tracks)
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS guards).
--
-- Reads are done by the anon client (permissive SELECT policies below).
-- ALL writes go through service-role endpoints (no write policies), so the
-- browser can never forge XP / progress / rewards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- seasons: 90-day fashion seasons. level_count + xp_per_level are per-season
-- so each season can be tuned. Exactly one row should have is_active = true.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,                 -- e.g. 'SPRING 2026'
  code         text,                          -- e.g. 'SS26'
  starts_at    timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,          -- defaults to starts_at + 90d (set by API)
  is_active    boolean NOT NULL DEFAULT false,
  level_count  integer NOT NULL DEFAULT 30,
  xp_per_level integer NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- user_season_progress: one XP track per user per season. user_id is the Privy
-- DID string (matches profiles.id / user_assets.user_id), so it's text.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_season_progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  season_id        uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  xp               integer NOT NULL DEFAULT 0,
  level            integer NOT NULL DEFAULT 0,
  is_premium       boolean NOT NULL DEFAULT false,   -- set when a season artifact is activated
  claimed_levels   jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- array of claimed reward ids
  physical_claimed boolean NOT NULL DEFAULT false,   -- max-level physical item redeemed
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id)
);

-- ----------------------------------------------------------------------------
-- season_rewards: the per-level reward table. One row per (season, level, track).
-- reward_type drives what gets granted:
--   'avatar' | 'theme' -> product_id (granted into user_assets)
--   'wngs'             -> wngs_amount (credited to balance)
--   'physical'         -> label only (fulfilled manually; sets physical_claimed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS season_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  level       integer NOT NULL,
  track       text NOT NULL CHECK (track IN ('free', 'premium')),
  reward_type text NOT NULL CHECK (reward_type IN ('avatar', 'theme', 'wngs', 'physical')),
  product_id  uuid,            -- references products.id for avatar/theme
  wngs_amount integer,         -- for wngs rewards
  label       text,            -- display name / physical item description
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season_rewards_season ON season_rewards(season_id);
CREATE INDEX IF NOT EXISTS idx_user_season_progress_user ON user_season_progress(user_id);

-- ----------------------------------------------------------------------------
-- Social-mining STAMINA on profiles (replaces the flat 3/day cap).
-- Time-based regen: effective = min(MAX, social_stamina + floor((now - updated)/INTERVAL)).
-- MAX=5, regen +1 / 4h, recharge-to-full costs 250 WNGS (enforced in the API).
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_stamina            integer NOT NULL DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_stamina_updated_at timestamptz NOT NULL DEFAULT now();

-- ----------------------------------------------------------------------------
-- RLS: permissive reads, no client writes.
-- ----------------------------------------------------------------------------
ALTER TABLE seasons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_season_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rewards       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seasons_read              ON seasons;
DROP POLICY IF EXISTS season_rewards_read       ON season_rewards;
DROP POLICY IF EXISTS user_season_progress_read ON user_season_progress;

CREATE POLICY seasons_read              ON seasons              FOR SELECT USING (true);
CREATE POLICY season_rewards_read       ON season_rewards       FOR SELECT USING (true);
CREATE POLICY user_season_progress_read ON user_season_progress FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
-- SELECT * FROM seasons;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name LIKE 'social_stamina%';
