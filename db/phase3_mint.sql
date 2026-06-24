-- ============================================================================
-- PHASE 3 — On-chain avatars (devnet POC). Run in the Supabase SQL editor.
-- Adds per-instance mint tracking to user_assets (owned cosmetics).
-- ============================================================================
ALTER TABLE user_assets ADD COLUMN IF NOT EXISTS mint_address   text;  -- the NFT mint pubkey once minted
ALTER TABLE user_assets ADD COLUMN IF NOT EXISTS mint_status    text;  -- NULL=unminted | 'minting' | 'minted' | 'failed'
ALTER TABLE user_assets ADD COLUMN IF NOT EXISTS mint_signature text;  -- the mint transaction signature

-- Verify:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='user_assets' AND column_name LIKE 'mint%';
