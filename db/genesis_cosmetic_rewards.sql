-- Wire avatar/theme cosmetics into GENESIS PROTOCOL (season 01) mid-tiers.
-- Fills the previously-empty rungs between the existing WNGS/physical rewards
-- with the 8 premium cosmetics (rarity escalates with tier; free/premium split
-- 4/4). The 3 default common themes (SYSTEM_LIGHT/DARK, CRIMSON_OVERRIDE) are
-- intentionally excluded -- they ship free with every account.
--
-- Idempotent: clears existing cosmetic (avatar/theme) rewards for this season
-- first, then re-inserts. WNGS + physical rewards are untouched. Run in the
-- Supabase SQL editor.

DELETE FROM season_rewards
WHERE season_id = 'f1f5425e-39da-4fab-ab0c-077f76ca4c2a'
  AND reward_type IN ('avatar', 'theme');

INSERT INTO season_rewards (season_id, level, track, reward_type, product_id, label) VALUES
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a',  2, 'free',    'avatar', '644222c5-71b9-456c-be5a-43832d01d7b5', 'VOID_OPERATOR'),    -- common
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a',  4, 'premium', 'avatar', '48f1a83c-ae77-482f-b4c1-594d993525e0', 'AZURE_GHOST'),      -- rare
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a',  7, 'free',    'theme',  '01d2092d-d908-4cd1-ad96-d82977a0ff76', 'AZURE_PROTOCOL'),   -- rare
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 12, 'free',    'avatar', '54ae19d2-8bc6-4fb5-b920-7ce7b2868e99', 'CRIMSON_AGENT'),    -- epic
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 14, 'premium', 'theme',  '120d23ac-da22-4c94-964d-2ea5e2d3a6ea', 'VENOM_OVERRIDE'),   -- epic
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 18, 'premium', 'avatar', '81a2a0f8-b134-4b34-9cba-e04435d73a6f', 'GOLDEN_MONARCH'),   -- monarch
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 22, 'free',    'theme',  'be8b382c-76b6-4bca-8b98-84948b7a0da4', 'SOLAR_FLARE'),      -- monarch
  ('f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 28, 'premium', 'avatar', '66cbfcbf-1e8f-4174-915f-6115b820a575', 'PRISM_PROTOCOL');   -- mythic
