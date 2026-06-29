-- Seed the ALL_QUESTS achievement stamp.
-- The award trigger is ALREADY wired in api/v2/_quests.js: whenever a quest
-- completes it checks whether the user's COMPLETED quests == all active quests,
-- and if so calls checkAndAwardStamps(..., 'ALL_QUESTS'). That engine no-ops
-- when no stamp row carries the trigger -- this adds that row.
--
-- Cross-season (season_id NULL) so it shows/awards regardless of active season.
-- Idempotent + FK-safe: inserts only if an ALL_QUESTS stamp doesn't already
-- exist (never deletes, so it can't orphan earned user_stamps).

INSERT INTO stamps (name, description, season_id, trigger_type, trigger_value, is_hidden, sort_order)
SELECT 'PROTOCOL MASTER', 'Cleared every active quest in the system.', NULL, 'ALL_QUESTS', NULL, false, 10
WHERE NOT EXISTS (SELECT 1 FROM stamps WHERE trigger_type = 'ALL_QUESTS');
