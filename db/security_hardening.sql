-- ============================================================================
-- SECURITY HARDENING — rate limiting store. Run in the Supabase SQL editor.
--
-- Backs api/v2/_ratelimit.js. Fixed-window counters keyed on
-- `${scope}:${identifier}:${windowStart}`, so a row's lifetime is exactly one
-- window and expired rows are dead weight (swept opportunistically by the
-- helper, see rate_limits_sweep below).
--
-- NOTE: until this migration is applied, _ratelimit.js FAILS OPEN (it logs and
-- allows the request) so an unmigrated deploy can't take down /claim or
-- /verify. Apply it, then confirm with the verification query at the bottom.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     text PRIMARY KEY,
  hits       integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits (expires_at);

-- Service-role only. No policies are defined, so with RLS on, the anon key
-- (which ships in the browser bundle) can neither read nor write this table.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic increment-and-return. INSERT .. ON CONFLICT DO UPDATE is a single
-- statement, so concurrent hits on the same bucket can't lose a count the way
-- a read-modify-write from the API layer would.
CREATE OR REPLACE FUNCTION rate_limit_hit(p_bucket text, p_expires timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO rate_limits (bucket, hits, expires_at)
  VALUES (p_bucket, 1, p_expires)
  ON CONFLICT (bucket) DO UPDATE
    SET hits = rate_limits.hits + 1
  RETURNING hits INTO v_hits;
  RETURN v_hits;
END;
$$;

-- Deletes elapsed windows. The helper calls this on a small fraction of
-- requests; schedule it with pg_cron instead if you prefer a fixed cadence:
--   SELECT cron.schedule('rate-limits-sweep', '*/15 * * * *',
--                        $$SELECT rate_limits_sweep()$$);
CREATE OR REPLACE FUNCTION rate_limits_sweep()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION rate_limit_hit(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rate_limits_sweep() FROM PUBLIC, anon, authenticated;

-- Verify:
--   SELECT rate_limit_hit('test:1:0', now() + interval '1 minute');  -- 1, then 2, 3...
--   SELECT rate_limits_sweep();
--   DELETE FROM rate_limits WHERE bucket LIKE 'test:%';

-- ============================================================================
-- PRE-DEPLOY CHECK — artifacts.tag_id width.
--
-- Batch-minted tag IDs gained a random suffix (api/v2/admin/mint.js), so they
-- grew from e.g. 'GEN-HOOD007' (11 chars) to 'GEN-HOOD007-DS5J67PW7B' (22).
-- There is no CREATE TABLE for `artifacts` in this directory (it predates
-- db/), so confirm the column is text — or varchar wide enough — BEFORE
-- minting a batch, otherwise the insert errors or silently truncates:
--
--   SELECT data_type, character_maximum_length
--   FROM information_schema.columns
--   WHERE table_name = 'artifacts' AND column_name = 'tag_id';
--
-- Expect data_type='text' (character_maximum_length NULL). If it's a narrow
-- varchar:  ALTER TABLE artifacts ALTER COLUMN tag_id TYPE text;
-- ============================================================================
