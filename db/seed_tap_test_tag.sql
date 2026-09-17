-- ===========================================================================
-- SEED — one test tag for the first-tap claim flow (/tap/:tagId).
--
-- Run manually against Supabase (SQL Editor), like everything else in db/.
-- Creates NOTHING: `artifacts` already exists (it predates this directory),
-- and this only inserts a single row into it. No schema, no RLS changes.
--
-- After running:  https://<passport-domain>/tap/test-001
--
-- Written as INSERT ... WHERE NOT EXISTS rather than ON CONFLICT because
-- there is no CREATE TABLE here to confirm a unique index on tag_id — this
-- form is safe either way and is re-runnable.
-- ===========================================================================

INSERT INTO artifacts (tag_id, name, tier, is_activated, owner_id, collection, season, is_season_artifact)
SELECT 'test-001', 'Monarch Test Piece', 'MYTHIC', false, NULL, 'GENESIS', '001', true
WHERE NOT EXISTS (SELECT 1 FROM artifacts WHERE tag_id = 'test-001');

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
