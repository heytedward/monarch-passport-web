-- ============================================================================
-- RLS BASELINE — the desired end state, captured from production.
--
-- WHY THIS FILE EXISTS: every RLS policy in this project was created by hand in
-- the Supabase dashboard and existed nowhere in the repo, which is why auditing
-- it needed live database access. A fresh environment built from db/ alone
-- would have come up with NO row-level security at all.
--
-- Generated from `pg_policies` on 2026-09-03 (project dfpfkmrpnwioxzbwndzx),
-- with the eight world-open policies that db/rls_hardening.sql removes already
-- excluded. So this is the intended state, not a snapshot of the flaws.
--
-- IDEMPOTENT: safe to re-run. Every policy is dropped before being created.
--
-- ORDER:
--   Existing database:  db/rls_hardening.sql  ->  this file
--   Fresh database:     db/security_hardening.sql  ->  this file
--                       (security_hardening.sql creates and secures rate_limits,
--                        which this file therefore does not touch)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every application table.
--
-- This is the load-bearing half. A table listed here with no policy below is
-- deliberate: it is reached only by service-role code in api/, which bypasses
-- RLS entirely, so "RLS on + zero policies" means deny-all to the anon key
-- that ships in the browser bundle. Supabase's linter reports these as INFO
-- `rls_enabled_no_policy` — that notice is expected here, not a defect.
-- ---------------------------------------------------------------------------
ALTER TABLE artifact_scans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts              ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE claim_links            ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE collection_items       ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE monarch_times          ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_boosts            ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE post_comments          ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE product_sizes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_grants        ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE quests                 ENABLE ROW LEVEL SECURITY;
-- rate_limits is created AND secured by db/security_hardening.sql, which owns
-- that table. Enabling it here would fail on a fresh database where that
-- migration has not run yet.
ALTER TABLE season_rewards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamps                 ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collection_items  ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE user_quests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_season_progress   ENABLE ROW LEVEL SECURITY;  -- service-role only (see note)
ALTER TABLE user_stamps            ENABLE ROW LEVEL SECURITY;  -- service-role only
ALTER TABLE waitlist               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wngs_discounts         ENABLE ROW LEVEL SECURITY;  -- service-role only

-- Legacy tables — no code in src/ or api/ references any of these. They are
-- kept enabled so they can't leak, but they are candidates for deletion. An
-- unused table with a public-read policy is attack surface for no benefit;
-- digital_assets in particular carries a world-readable catalog policy below.
ALTER TABLE digital_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_garments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_digital_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_seasons           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Per-user policies.
--
-- All scope on `auth.jwt() ->> 'sub'` — the Privy DID. Note these only grant
-- access when a JWT Supabase can verify is present. Supabase does not validate
-- Privy tokens, so in practice the browser is anonymous and these deny; real
-- per-user reads go through api/ on the service role. They are kept as
-- defence-in-depth for any future path that does carry a verifiable JWT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO public USING (id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public USING (id = (auth.jwt() ->> 'sub'));

-- Production also carries a second, byte-identical SELECT policy on
-- transactions ("Users view own transactions"). Deduplicated here; drop the
-- redundant one in place with:
--   DROP POLICY IF EXISTS "Users view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT TO public WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users view own assets" ON user_assets;
CREATE POLICY "Users view own assets" ON public.user_assets
  FOR SELECT TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users update own assets" ON user_assets;
CREATE POLICY "Users update own assets" ON public.user_assets
  FOR UPDATE TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users view own quest progress" ON user_quests;
CREATE POLICY "Users view own quest progress" ON public.user_quests
  FOR SELECT TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users insert own quest progress" ON user_quests;
CREATE POLICY "Users insert own quest progress" ON public.user_quests
  FOR INSERT TO public WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users update own quest progress" ON user_quests;
CREATE POLICY "Users update own quest progress" ON public.user_quests
  FOR UPDATE TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can view own scan history" ON artifact_scans;
CREATE POLICY "Users can view own scan history" ON public.artifact_scans
  FOR SELECT TO public USING (owner_id = (auth.jwt() ->> 'sub'));

-- ---------------------------------------------------------------------------
-- 3. Public catalog reads. Intentionally world-readable: shop listings and the
-- season ladder definition. No user data in any of these.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public catalog view" ON products;
CREATE POLICY "Public catalog view" ON public.products
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS product_sizes_public_read ON product_sizes;
CREATE POLICY product_sizes_public_read ON public.product_sizes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS seasons_read ON seasons;
CREATE POLICY seasons_read ON public.seasons
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS season_rewards_read ON season_rewards;
CREATE POLICY season_rewards_read ON public.season_rewards
  FOR SELECT TO public USING (true);

-- Filtered public reads — not `true`, so unpublished/inactive rows stay hidden.
DROP POLICY IF EXISTS "Anyone can read active quests" ON quests;
CREATE POLICY "Anyone can read active quests" ON public.quests
  FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "Users can view published news" ON monarch_times;
CREATE POLICY "Users can view published news" ON public.monarch_times
  FOR SELECT TO public USING (status = 'PUBLISHED');

-- ---------------------------------------------------------------------------
-- 4. Waitlist: write-only by design. INSERT is open so anyone can sign up;
-- there is deliberately NO SELECT policy, so addresses can never be read back
-- with the anon key. Do not add one.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can join waitlist" ON waitlist;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT TO public WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. Legacy table policies, reproduced for fidelity.
--
-- NOTE: digital_garments scopes on `auth.uid()`, which is Supabase Auth's user
-- id. This app authenticates with Privy, so auth.uid() is always NULL and the
-- policy denies everything. Harmless (it fails closed) but inconsistent with
-- every other policy here — evidence these tables predate the Privy migration.
-- Delete the tables rather than fixing the policies if they are truly dead.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public catalog view" ON digital_assets;
CREATE POLICY "Public catalog view" ON public.digital_assets
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service_role full access" ON digital_garments;
CREATE POLICY "Allow service_role full access" ON public.digital_garments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to select their own garments" ON digital_garments;
CREATE POLICY "Allow users to select their own garments" ON public.digital_garments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own digital inventory" ON user_digital_inventory;
CREATE POLICY "Users view own digital inventory" ON public.user_digital_inventory
  FOR SELECT TO public USING (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users update own digital inventory" ON user_digital_inventory;
CREATE POLICY "Users update own digital inventory" ON public.user_digital_inventory
  FOR UPDATE TO public USING (user_id = (auth.jwt() ->> 'sub'));

-- ============================================================================
-- Verify — no table left without RLS (expect zero rows):
--
--   SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
--
-- And no unexpected world-open policy (expect only waitlist INSERT):
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND 'public' = ANY (roles)
--     AND (qual='true' OR with_check='true')
--     AND tablename NOT IN ('products','product_sizes','digital_assets',
--                           'seasons','season_rewards');
-- ============================================================================
