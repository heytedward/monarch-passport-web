-- Seed physical collection items (QR-coded) for GENESIS PROTOCOL (season 01),
-- so the /collect/:code flow has something to register. Each item's item_code
-- is what the QR encodes; api/v2/purchase.js (action 'collect') matches on
-- UPPER(TRIM(code)), so codes are stored uppercase here.
--
-- Owning all of these + the season NFC artifact awards the GENESIS COMPLETE
-- (FULL_SEASON_COLLECTION) stamp via isFullCollectionComplete().
--
-- Idempotent + FK-safe: each row inserts only if its item_code doesn't already
-- exist (never deletes, so it can't orphan user_collection_items claims).

INSERT INTO collection_items (season_id, name, description, sort_order, item_code)
SELECT 'f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 'GENESIS PATCH', 'Embroidered Season 01 field patch.', 1, 'GEN-PATCH'
WHERE NOT EXISTS (SELECT 1 FROM collection_items WHERE item_code = 'GEN-PATCH');

INSERT INTO collection_items (season_id, name, description, sort_order, item_code)
SELECT 'f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 'GENESIS DECAL', 'Die-cut Monarch decal.', 2, 'GEN-DECAL'
WHERE NOT EXISTS (SELECT 1 FROM collection_items WHERE item_code = 'GEN-DECAL');

INSERT INTO collection_items (season_id, name, description, sort_order, item_code)
SELECT 'f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 'OPERATOR CARD', 'Numbered Season 01 operator card.', 3, 'GEN-CARD'
WHERE NOT EXISTS (SELECT 1 FROM collection_items WHERE item_code = 'GEN-CARD');

INSERT INTO collection_items (season_id, name, description, sort_order, item_code)
SELECT 'f1f5425e-39da-4fab-ab0c-077f76ca4c2a', 'ARCHIVE TAG', 'Woven archive tag.', 4, 'GEN-TAG'
WHERE NOT EXISTS (SELECT 1 FROM collection_items WHERE item_code = 'GEN-TAG');
