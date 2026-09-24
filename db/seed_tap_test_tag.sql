-- ===========================================================================
-- SEED — one test tag for the first-tap claim flow (/tap/:tagId).
--
-- Run manually against Supabase (SQL Editor), like everything else in db/.
-- Creates NOTHING: `artifacts` already exists (it predates this directory),
-- and this only inserts a single row into it. No schema, no RLS changes.
--
-- After running:  https://<passport-domain>/tap/test-001
--
-- artifacts.tag_id carries a UNIQUE constraint (artifacts_tag_id_key,
-- verified against the live database), which is also what lets verify.js
-- read a tag with .single(). ON CONFLICT makes this re-runnable.
--
-- Columns left to their defaults: item_type ('CLOTHING'), base_multiplier
-- (1.00), referrals (0), shopify_variant_id (NULL). None are read by the
-- tap flow. item_type is now constrained by db/artifact_item_type.sql, so
-- run that migration first or this insert is rejected.
--
-- STATUS: already applied to the live project (Monarch-Passport.,
-- dfpfkmrpnwioxzbwndzx) — kept here so the tag can be recreated.
-- ===========================================================================

-- season_id / season are derived from the ACTIVE season rather than typed,
-- so this seed cannot reintroduce the drift db/season_fk.sql just removed.
-- Run db/season_fk.sql and db/artifact_item_type.sql first.
INSERT INTO artifacts (tag_id, name, tier, is_activated, owner_id,
                       collection, item_type, season_id, season, is_season_artifact)
SELECT 'test-001', 'Monarch Test Piece', 'MYTHIC', false, NULL,
       'GENESIS', 'KEYCHAIN', s.id, s.code, true
FROM seasons s
WHERE s.is_active = true
ON CONFLICT (tag_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RESET — put the test tag back to unclaimed so the cinematic can be replayed.
-- The claim is a one-way door in the app (is_activated never goes back), so
-- this is the only way to test the unclaimed path more than once.
-- ---------------------------------------------------------------------------
-- UPDATE artifacts SET is_activated = false, owner_id = NULL WHERE tag_id = 'test-001';

-- ---------------------------------------------------------------------------
-- VERIFY — should return exactly one row, is_activated = false.
-- ---------------------------------------------------------------------------
-- SELECT tag_id, name, tier, season, is_activated, owner_id
-- FROM artifacts WHERE tag_id = 'test-001';
