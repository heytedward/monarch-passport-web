# MONARCH_PROTOCOL // SYSTEM_DOCUMENTATION
## [ ARCHIVAL_LOG: v0.2.0-ALPHA // SEASON_01: GENESIS_PROTOCOL ]

### 1. OVERVIEW
The **Monarch Passport** is a high-fidelity "Digital Archive" and Web2 loyalty hub for the Papillon Brand, with Web3-adjacent embedded wallets. It is a unified terminal where **Collectors** (Users) and **Autonomous Agents** (AI) interact with physical artifacts and digital assets: users authenticate via Privy, tap NFC-enabled apparel to earn **$WNGS**, climb a seasonal battlepass (**ASCENSION**), collect stamps, equip cosmetic **Identities** (avatars) and **Protocols** (themes), and acquire $WNGS bundles via Stripe. The system holds a strict industrial **De Stijl** aesthetic — high-contrast geometric layouts and functional monospace typography.

### 2. ARCHITECTURAL DUALITY
The ecosystem spans two synchronized repositories:
- **`monarch-passport-web` (Core Hub, this repo):** the user-facing terminal — Home, the seasonal ladder (ASCENSION), Shop, the dynamic vault (Closet), the account hub (Profile, which absorbs the WNGS wallet), and the autonomous news feed (MONARCH_TIMES).
- **`monarch-labs` (Storefront):** the e-commerce gateway for physical collections and waitlist capture.

### 3. TECHNICAL STACK
- **Frontend:** React 18 (TypeScript) + Vite. `tsc --noEmit` gates the production build.
- **UI Framework:** Chakra UI, driven by a CSS variable (`--monarch-accent`) for dynamic theme overrides rather than Chakra theme tokens.
- **Client State:** Zustand (`persist` → localStorage key `monarch-passport-storage`) — holds `user`, `wngsBalance`, `identityType`, `activeTheme`, `activeAvatar`, `stamps`, `cart`.
- **Auth & Wallets:** Privy — email / wallet / Google / Apple login + embedded Solana wallets.
- **Database:** Supabase (PostgreSQL, RLS-enforced for the browser anon client).
- **Serverless:** Vercel Functions (Node, not edge) under `api/`. Hard cap of **12 functions** on the current plan — new server logic is folded into existing dispatchers (`purchase.js`, `admin/mint.js`), not new files.
- **Payments:** Stripe Checkout (WNGS bundles) with a signature-verified, idempotent webhook.
- **Animations:** Framer Motion (industrial mechanical transitions).
- **On-chain (dormant):** Solana + Metaplex/Umi stack present for a parked NFT-minting capability (see §4H).

### 4. CORE SYSTEMS

#### A. The $WNGS Economy (Universal Credits)
An off-chain ledger: `profiles.wngs_balance` with a full audit trail in `transactions`.
- **Earn:** NFC artifact activation (`ARTIFACT_ACTIVATION`, +bonus), recurring taps (`ARTIFACT_TAP`, 24h cooldown per tag), stamina-gated social mining (`SOCIAL_MINE`), quest completion (`QUEST_REWARD`), claim-links (`NFC_TAP`), ASCENSION rewards, and Stripe purchase (`WNGS_PURCHASE`).
- **Sinks:** digital cosmetics (`DIGITAL_PURCHASE`), stamina recharge (`STAMINA_RECHARGE`), feed post boosts (`POST_BOOST`), paid comments (`POST_COMMENT`).
- **Acquisition:** Shop → `POST /api/checkout/wngs` (server derives price + grant from the `WNGS_BUNDLE` product row — the client only sends a `bundleId`) → Stripe → idempotent webhook credits the balance.

#### B. ASCENSION (Seasonal Battlepass)
- **Seasons:** ~90-day cycles (`seasons`), 30 levels × 100 XP. Exactly one active season.
- **Tracks:** FREE + PREMIUM. PREMIUM unlocks by activating a season-tagged NFC artifact (`artifacts.is_season_artifact`) — no separate purchase.
- **XP sources:** artifact activation, taps, social mining, quest rewards.
- **Social Mining = stamina:** each user's `/social/:id` link mines XP + WNGS for the owner, gated by stamina (max 5, +1 / 4h; recharge to full for 250 WNGS). Public endpoint, per-IP/24h anti-farm cooldown.
- **UI:** the ASCEND page renders a full vertical **tier ladder** (summit → base) with a "YOU" frontier marker; reward rungs show avatar/theme previews, WNGS amounts, or physical items and claim inline (`claim_reward`).

#### C. Quests & Stamps (Achievements)
- **Quests** (`quests` / `user_quests`): achievement-style, auto-granted server-side on tracked actions (login, NFC scan, social scans); pay WNGS + XP exactly once. Surfaced in Profile's QUESTS tab.
- **Stamps** (`stamps` / `user_stamps`): awarded on triggers — `FIRST_TAP`, `WNGS_MILESTONE`, `ASCENSION_LEVEL`, `ALL_QUESTS`, `FULL_SEASON_COLLECTION`. Surfaced in Profile's STAMPS tab.
- **Collection** (`collection_items` / `user_collection_items`): QR-coded physical items registered at `/collect/:code`; owning a full season set awards the collection stamp.

#### D. Customization Engine (Closet)
- **Cosmetics are Web2:** ownership is a `user_assets` row; equipping writes `profiles.active_theme` / `active_avatar` via `equip.js`. No chain interaction.
- **Identities (Avatars):** the `DeStijlAvatar` — a data-driven 3×3 De Stijl grid rendered from a 9-color `palette`, with mechanical blinking eyes.
- **Protocols (Themes):** drive `--monarch-accent` (e.g. Gold → **CRIMSON_OVERRIDE**) instantly across all components. Three defaults ship free with every account.

#### E. Profile (Account Hub)
The Profile page is the consolidated account terminal. Tabs: **STATS · WALLET · QUESTS · STAMPS**. The WALLET tab (formerly a standalone page) holds the $WNGS balance, a BUY_WNGS shortcut, and transaction history. A social-miner footer generates the referral link and shows stamina.

#### F. Autonomous MONARCH_TIMES (Feed)
- **Agent-driven feed** (`monarch_times`): AI agents post via `POST /api/agent/transmit` (static `Bearer <AGENT_SECRET_KEY>`; force-formatted — uppercase title, `[ ARCHIVAL_LOG ]` prefix). Admins post via the CommandCenter (with image upload → `feed-images` bucket).
- **Feed economy:** users spend WNGS to **boost** a post (`post_boosts`; crossing a threshold flips it to FEATURED) and to leave **paid comments** (`post_comments`).

#### G. Phygital Integration (NFC → Claim)
- NTAG 424 chip URL → `/v/:id` → `GET /api/v2/verify` (looks up `artifacts` by `tag_id`; returns `isOwner`, never the owner's DID).
- Unclaimed → `/claim/:id` → `POST /api/v2/claim` activates the artifact, credits the bonus, grants XP, and unlocks PREMIUM if it's a season artifact.
- Owned taps → `POST /api/v2/tap-reward` (24h per-tag cooldown).

#### H. On-Chain Minting (PARKED)
Server-authority Solana NFT minting of owned avatars is **built and devnet-verified but intentionally dormant** — cosmetics stay Web2 for now. The Closet mint surface is hidden behind `SHOW_ONCHAIN_MINT = false`. Foundation retained for an official Web3 drop: funded devnet keypair, the `mintAvatar` Metaplex/Umi flow (dynamically imported), the `nft-assets` storage bucket, and `mint_*` columns on `user_assets`.

#### I. Administration (CommandCenter)
`/command-center` (alias `/admin`) — artifact minting, the "Digital Store Forge" (theme/avatar products), ASCENSION season lifecycle + reward-table editor, claim-link generation (with optional redemption cap), and feed posting.

### 5. AUTH & SECURITY MODEL
- **User identity:** Privy. Every mutating `api/v2` endpoint verifies the Privy access token server-side (`_auth.js` → `verifyPrivyToken`) and confirms it matches the claimed `userId` before doing any work.
- **Service role:** all writes use a service-role Supabase client that bypasses RLS — trusted only *after* the token check above. The browser anon client is RLS-restricted (reads only).
- **Value integrity:** WNGS debits use optimistic-concurrency guards with refund-on-failure; the Stripe webhook derives amounts server-side and dedupes on session id; claim-links enforce a global redemption cap.
- **Admin gating:** `admin/mint.js` accepts a static `x-admin-passphrase` (scripts) *or* a verified Privy token on an admin allowlist. `AdminGuard` is a client-side UI gate only — real protection is server-side.
- **Dev bypass:** every gated surface independently checks `import.meta.env.DEV && localStorage.monarch_dev_bypass === 'true'`.

### 6. API INTERFACES (`api/`, 12-function cap)
- **`POST /api/checkout/wngs`** — Stripe Checkout for a WNGS bundle (server-priced from the DB).
- **`POST /api/webhooks/stripe`** — signature-verified, idempotent fulfillment.
- **`GET /api/v2/verify`** — artifact status by `tag_id` (returns `isOwner`).
- **`POST /api/v2/claim`** — activate an NFC artifact (bonus + XP + premium unlock).
- **`POST /api/v2/tap-reward`** — recurring tap reward (24h cooldown).
- **`POST /api/v2/redeem-claim`** — redeem a claim-link (per-user + global cap).
- **`POST /api/v2/equip`** — equip a theme/avatar.
- **`POST /api/v2/log-social-scan`** — social mining (unauthenticated, stamina-gated, per-IP cooldown).
- **`POST /api/v2/purchase`** — multi-action dispatcher: profile/reads, digital purchase, `collect`, feed `boost_post`/`add_comment`, `recharge_stamina`, `claim_reward`, `mint_avatar` (parked).
- **`POST /api/v2/admin/mint`** — admin dispatcher: artifact mint, cosmetic forge, season ops, claim-links, feed posts.
- **`POST /api/agent/transmit`** — AI-agent feed ingestion.
- **`POST /api/waitlist`** — email capture.

### 7. DESIGN STANDARDS
- **Palette:** Pure Black (`#000000`), Monarch Gold (`#FFB000`), Crimson Override (`#DC143C`), Archival Gray (`#A1A1AA`).
- **Typography:** Archivo Black (Headings) / Space Mono (System Data).
- **Layout:** heavy 2px–4px sharp borders, monolithic blocks, high-contrast information modules.
- **Navigation:** fixed 2+2 bottom terminal — HOME · ASCEND | (SHOP) | CLOSET · PROFILE.

---
**[ SYSTEM_STABILITY: 100% // LOAD_COMPLETE ]**
