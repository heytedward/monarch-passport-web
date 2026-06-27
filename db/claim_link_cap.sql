-- Claim-link global usage cap.
-- Adds an optional per-link redemption limit. NULL = unlimited (existing
-- behaviour). When set, api/v2/redeem-claim.js rejects redemptions once the
-- total number of NFC_TAP transactions tagged with that claim_id reaches it.
-- The app code degrades gracefully if this hasn't been run yet (links are
-- simply treated as unlimited), so this can be applied any time.

ALTER TABLE claim_links
  ADD COLUMN IF NOT EXISTS max_redemptions integer;
