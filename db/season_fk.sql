-- ===========================================================================
-- MIGRATION — artifacts.season becomes a real foreign key.
--
-- Run manually against Supabase (SQL Editor), like everything else in db/.
--
-- WHY
-- ---
-- artifacts.season was free text, typed by an operator into the batch-mint
-- box in the admin panel. It drifted immediately: the same season appeared
-- as '001', '1' and '01' across rows, most rows were NULL, and nothing tied
-- any of it to the seasons table. api/v2/_stamps.js carries seasonMatchValues()
-- purely to brute-force those spellings, and api/v2/claim.js fuzzy-matches an
-- artifact's season against seasons.code OR seasons.title to decide whether a
-- claim unlocks the premium ASCENSION track. That guesswork is load-bearing
-- today, which means season membership is genuinely ambiguous.
--
-- WHAT THIS DOES
-- --------------
-- Adds artifacts.season_id, a real FK to seasons(id). The existing text
-- column stays, but changes meaning: it is no longer operator input, it is a
-- canonical mirror of seasons.code written by the minter. Existing readers
-- (verify.js, claim.js, Tap.tsx) keep working unchanged, and what they read
-- is now trustworthy rather than whatever was typed.
--
-- SAFE TO RUN AS-IS: no backfill clause is needed because artifacts was
-- emptied of test rows immediately before this migration. If you run it
-- against a table that DOES hold rows, the ALTER ... ADD CONSTRAINT still
-- succeeds (NULL season_id satisfies the FK), but those rows will carry a
-- NULL season_id until backfilled -- see the backfill block at the bottom.
--
-- ON DELETE RESTRICT is deliberate: a season with minted pieces pointing at
-- it must not be deletable out from under them. Removing a season is then an
-- explicit decision about its artifacts first.
-- ===========================================================================

ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS season_id text;

-- Guarded so the migration is re-runnable (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artifacts'::regclass
      AND conname  = 'artifacts_season_id_fkey'
  ) THEN
    ALTER TABLE artifacts
      ADD CONSTRAINT artifacts_season_id_fkey
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- "Every artifact in season X" is the query this whole migration exists to
-- serve, so it gets an index.
CREATE INDEX IF NOT EXISTS artifacts_season_id_idx ON artifacts (season_id);

-- ---------------------------------------------------------------------------
-- BACKFILL — only needed if you run this against a table that already holds
-- rows. Matches the loose text against seasons.code and seasons.title using
-- the same normalisation as _stamps.js (numeric codes drop leading zeros).
-- ---------------------------------------------------------------------------
-- UPDATE artifacts a SET season_id = s.id
-- FROM seasons s
-- WHERE a.season_id IS NULL
--   AND a.season IS NOT NULL
--   AND (
--     regexp_replace(upper(trim(a.season)), '^0+(?=\d)', '')
--       = regexp_replace(upper(trim(COALESCE(s.code, ''))), '^0+(?=\d)', '')
--     OR upper(trim(a.season)) = upper(trim(s.title))
--   );
--
-- Rows the backfill could not resolve -- inspect before minting more:
-- SELECT tag_id, season FROM artifacts WHERE season IS NOT NULL AND season_id IS NULL;

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- SELECT a.tag_id, a.season, a.season_id, s.code, s.title
-- FROM artifacts a LEFT JOIN seasons s ON s.id = a.season_id;
