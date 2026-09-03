-- ============================================================================
-- RLS HARDENING — remove world-open policies. Run in the Supabase SQL editor.
--
-- Verified against production on 2026-09-03: RLS is ENABLED on all 30 public
-- tables (good), but five policies were written as `USING (true)` /
-- `WITH CHECK (true)` for the `public` role, which makes them readable — and in
-- two cases WRITABLE — by anyone holding the anon key. The anon key ships in
-- the browser bundle by design, so "public role" here means "the internet".
--
-- Tables that keep RLS enabled with ZERO policies are correct and untouched:
-- they're reached only through service-role code in api/, which bypasses RLS.
-- Zero policies = deny-all to anon. That is the intended posture for
-- artifacts, post_comments, purchase_grants, stamps, user_stamps, store_orders,
-- inventory, collection_items, user_collection_items, user_seasons and
-- rate_limits.
--
-- Safe to run: nothing in src/ reads claim_links, wngs_discounts or
-- artifact_scans with the anon client (verified by grep); every access is
-- server-side via the service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. claim_links — the most serious. QR redemption codes.
--
-- Was: public SELECT true (x2), public UPDATE true (x2), public INSERT true.
-- Columns include short_code, wngs_award, is_claimed, max_redemptions.
--
-- With the anon key alone anyone could: read every short_code and redeem the
-- lot; UPDATE is_claimed back to false to replay a redemption; or INSERT their
-- own rows with an arbitrary wngs_award and redeem those — minting WNGS from
-- nothing, with no account and no physical item.
--
-- All redemption goes through api/v2/redeem-claim.js on the service role, so
-- dropping these costs the app nothing.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public select"          ON claim_links;
DROP POLICY IF EXISTS "Anyone can read claim links"  ON claim_links;
DROP POLICY IF EXISTS "Allow public update"          ON claim_links;
DROP POLICY IF EXISTS "Anyone can update claim links" ON claim_links;
DROP POLICY IF EXISTS "Allow public insert"          ON claim_links;

-- ---------------------------------------------------------------------------
-- 2. wngs_discounts — storefront discount codes (code, discount_usd, status).
--
-- Was: public SELECT true. Anyone could read every active code and spend it at
-- the storefront; discount_usd runs up to MAX_DISCOUNT_USD ($500).
-- Read/created/cancelled server-side in api/v2/purchase.js.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "wngs_discounts anon read" ON wngs_discounts;

-- ---------------------------------------------------------------------------
-- 3. artifact_scans — scan log. Was: public INSERT true, so anyone could forge
-- scan rows. Written server-side by api/v2/log-social-scan.js.
-- The owner-scoped SELECT policy is correct and is left in place.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert a scan" ON artifact_scans;

-- ---------------------------------------------------------------------------
-- 4. user_season_progress — cross-user read of every player's ASCENSION level.
--
-- This one needed a code change first, shipped alongside this migration: the
-- policy was `USING (true)` because Ascension.tsx and Profile.tsx read the
-- table with the anon client, and Supabase cannot identify a Privy user
-- (auth.jwt() is null), so a user-scoped policy would have denied them. Both
-- reads now go through the new `get_season_progress` action in
-- api/v2/purchase.js on the service role.
--
-- DEPLOY ORDER: ship the app code first, then run this. Running it against the
-- old frontend leaves the ASCENSION ladder and the ARTIFACT_LEVEL stat blank.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_season_progress_read" ON user_season_progress;

-- ---------------------------------------------------------------------------
-- 5. Pin search_path on the two functions flagged by the Supabase linter
-- (0011_function_search_path_mutable). A SECURITY DEFINER function with a
-- mutable search_path can be hijacked by a caller-controlled schema.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_updated_at_column()   SET search_path = public;
ALTER FUNCTION public.process_social_scan_reward() SET search_path = public;

-- ============================================================================
-- Verify — after running, this should return EXACTLY ONE row:
--   waitlist | Anyone can join waitlist | INSERT
--
-- That one is intentional: public signup needs an open INSERT, and waitlist has
-- no SELECT policy, so addresses can be added but never read back. Anything
-- else appearing here is a world-open policy that wants review.
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND 'public' = ANY (roles)
--     AND (qual = 'true' OR with_check = 'true')
--     AND tablename NOT IN ('products','product_sizes','digital_assets',
--                           'seasons','season_rewards');
--
-- The excluded tables are intentional public catalogs (shop listings, the
-- season ladder definition) containing no user data.
--
-- Before this migration the same query returned 9 rows.
--
-- Then re-run the linter: it should report only rls_enabled_no_policy INFO
-- notices, which are the correct posture for service-role-only tables.
-- ============================================================================
