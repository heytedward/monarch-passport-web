-- ============================================================================
-- PHASE 2 FIX — reconcile ASCENSION to the LIVE schema.
-- The first phase2 migration assumed a fresh `seasons` table, but one already
-- existed (id text, title, start_date, end_date). Run this in Supabase.
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- seasons: keep the existing id(text)/title/start_date/end_date, ADD the
-- battlepass config columns the code needs.
-- ----------------------------------------------------------------------------
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT false;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS code         text;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS level_count  integer NOT NULL DEFAULT 30;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS xp_per_level integer NOT NULL DEFAULT 100;

-- ----------------------------------------------------------------------------
-- season_rewards: failed to create the first time (uuid FK vs text seasons.id).
-- Recreate with a TEXT season_id to match seasons.id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS season_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   text NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  level       integer NOT NULL,
  track       text NOT NULL CHECK (track IN ('free', 'premium')),
  reward_type text NOT NULL CHECK (reward_type IN ('avatar', 'theme', 'wngs', 'physical')),
  product_id  uuid,
  wngs_amount integer,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_season_rewards_season ON season_rewards(season_id);

-- ----------------------------------------------------------------------------
-- Stamina: use the EXISTING profile columns; drop the redundant pair the first
-- migration added. max_stamina is per-user (raise it later for VIPs).
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ALTER COLUMN current_stamina    SET DEFAULT 5;
ALTER TABLE profiles ALTER COLUMN max_stamina        SET DEFAULT 5;
ALTER TABLE profiles ALTER COLUMN last_stamina_regen SET DEFAULT now();

UPDATE profiles SET current_stamina    = COALESCE(current_stamina, 5);
UPDATE profiles SET max_stamina        = COALESCE(max_stamina, 5);
UPDATE profiles SET last_stamina_regen = COALESCE(last_stamina_regen, now());

ALTER TABLE profiles DROP COLUMN IF EXISTS social_stamina;
ALTER TABLE profiles DROP COLUMN IF EXISTS social_stamina_updated_at;

-- ----------------------------------------------------------------------------
-- RLS: permissive reads (anon client), no client writes.
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
-- SELECT column_name FROM information_schema.columns WHERE table_name='seasons';
-- SELECT to_regclass('public.season_rewards');
