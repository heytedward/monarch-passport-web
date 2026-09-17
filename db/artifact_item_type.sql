-- ===========================================================================
-- MIGRATION — artifacts.item_type becomes a real, constrained field.
--
-- Run manually against Supabase (SQL Editor). Run AFTER db/season_fk.sql.
--
-- WHY
-- ---
-- item_type existed on artifacts but was dead: api/v2/admin/mint.js never set
-- it, nothing anywhere read it, and every row carried the column default
-- 'CLOTHING'. With no working field for it, the item type was being smuggled
-- into `name` instead -- the old TEST001 row was literally named 'KEYCHAIN'
-- while its item_type said 'CLOTHING'.
--
-- That matters now because the physical line is no longer just garments. A
-- keychain and a hoodie are different products that need telling apart, and
-- 100 tags are about to be minted.
--
-- WHAT THIS DOES
-- --------------
-- Constrains item_type to a known vocabulary, aligned with the values already
-- in products.category for physical goods (CAP / HOODIE / TEE), plus KEYCHAIN
-- and an OTHER escape hatch so an unforeseen product does not block a mint.
--
-- The column stays nullable: a tag whose type genuinely is not known yet is a
-- real state, and is more honest than defaulting it to a lie. But the default
-- changes from 'CLOTHING' to NULL, because a silent wrong default is what
-- caused this in the first place.
--
-- NOTE: the allowed set is mirrored in src/lib/itemTypes.ts (the admin
-- dropdown) and api/v2/admin/mint.js (server validation). This constraint is
-- the authority -- if those drift, the insert fails here rather than writing
-- a bad value.
-- ===========================================================================

-- Existing rows must satisfy the constraint before it can be added. Only the
-- tap test tag exists at this point, and it is a keychain.
UPDATE artifacts SET item_type = 'KEYCHAIN'
WHERE tag_id = 'test-001';

-- Anything still on the old default becomes NULL (unknown) rather than being
-- asserted as clothing.
UPDATE artifacts SET item_type = NULL
WHERE item_type = 'CLOTHING';

ALTER TABLE artifacts ALTER COLUMN item_type DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artifacts'::regclass
      AND conname  = 'artifacts_item_type_check'
  ) THEN
    ALTER TABLE artifacts
      ADD CONSTRAINT artifacts_item_type_check
      CHECK (item_type IS NULL OR item_type IN
        ('KEYCHAIN','HOODIE','TEE','CAP','JACKET','STICKER','OTHER'));
  END IF;
END $$;

-- "Every keychain in season X" is the query this exists to serve.
CREATE INDEX IF NOT EXISTS artifacts_item_type_idx ON artifacts (item_type);

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- SELECT tag_id, name, item_type, season FROM artifacts ORDER BY tag_id;
-- Expect the constraint to reject anything outside the set:
-- INSERT INTO artifacts (tag_id, name, tier, item_type)
-- VALUES ('probe','probe','COMMON','CLOTHING');   -- should fail 23514
