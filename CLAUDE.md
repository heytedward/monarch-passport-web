# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Monarch Passport is the Web2 (with Web3-adjacent) loyalty hub for Papillon Brand. Users authenticate via Privy (embedded Solana wallets), tap NFC-enabled apparel to earn $WNGS points, climb a seasonal battlepass (ASCENSION), equip cosmetic "Identities" (avatars) / "Protocols" (themes), and buy $WNGS bundles via Stripe. The UI follows a strict industrial De Stijl aesthetic (sharp 2-4px borders, one typeface — Unbounded — for everything, black/gold `#FFB000`/crimson `#DC143C` palette) — see `SYSTEM_ARCHITECTURE.md` for the full design/system spec.

`monarch-passport-web` (this repo) is the core user-facing hub; a separate `monarch-labs` repo is the e-commerce storefront.

## Current launch scope

The app was deliberately cut down for the first sales season. Keep these off unless asked:

- **Stamps and quests are paused.** Each has a client switch (`STAMPS_ENABLED` / `QUESTS_ENABLED` in `src/lib/features.ts`) and a server switch (`api/v2/_stamps.js` / `api/v2/_quests.js`); flip both to re-enable. `get_stamps` / `get_quests` short-circuit to empty.
- **Deleted, to be rebuilt from scratch later:** social-link mining, stamina, the Recruit page, QR collect (`/collect`, `log-social-scan`). The referral program will be new work — don't resurrect the old code.
- **No physical rewards.** Season rewards are digital only; the final premium rewards are the exclusive GENESIS_COMPLETE theme, avatar and WNGS.
- **The key tag is the season pass**: claiming a season artifact unlocks the premium ASCENSION track.

## On-screen text rules

- **One font: Unbounded**, self-hosted in `public/fonts/` (`unbounded.css` defines `--brand-font`). Chakra's `heading`/`body`/`mono` all point to it in `src/theme.ts`; `index.html` and `public/tap.html` preload it. Don't add Google Fonts or a second family.
- **No `_` or `//` in anything the user sees.** Use spaces, and a middle dot (`·`) as a separator. Machine-style values (DB names like `GOLDEN_MONARCH`, server error codes like `TAP_COOLDOWN_ACTIVE`) go through `displayName()` from `src/lib/displayName.ts` before rendering — in JSX, toasts and thrown `Error` messages. Never rewrite the stored value itself: IDs such as `SYSTEM_DARK`, `CRIMSON_OVERRIDE`, `WNGS_BUNDLE` and API codes like `season_activate` are matched by value.
- Copy is plain-language "Streetwear+" — avoid jargon like "encrypted telemetry".

## Commands

- `npm run dev` — start Vite dev server (port 5173, or `$PORT`)
- `npm run typecheck` — `tsc --noEmit` (no lint/test scripts exist; this is the only static check)
- `npm run build` — `tsc --noEmit && vite build` (typecheck gates the build/deploy; keep `tsc` clean)
- `npm run preview` — preview the production build

## Architecture

**Frontend**: React 18 + TypeScript + Vite, Chakra UI for components/theming, React Router for routing, Zustand (`persist` middleware, localStorage key `monarch-passport-storage`) for client state, Framer Motion for animation. The whole app renders inside a centered ~430px phone-frame column (`AppContent` in `src/App.tsx`).

**Auth**: Privy (`PrivyProvider` in `src/App.tsx`) handles login (email/wallet/Google/Apple) and embedded Solana wallet creation. Routes are gated by a local `ProtectedRoute` wrapper in `App.tsx`, which also requires `identityType` (`'HUMAN' | 'AGENT'`) to be set in the Zustand store.

**Dev auth bypass**: gated surfaces (`ProtectedRoute`, `Navbar`, `Scanner`) independently check `import.meta.env.DEV && localStorage.getItem('monarch_dev_bypass') === 'true'` to skip Privy auth locally. When adding a new protected page or component, replicate this check rather than assuming `ProtectedRoute` alone covers it.

**Session bootstrap**: on every authenticated session, `AppContent` calls `POST /api/v2/purchase` with `action: 'ensure_profile'`, which creates the `profiles` row if missing and returns balance/theme/avatar to populate the store. This goes through the server because Supabase can't validate Privy tokens, so the browser anon client's RLS reads of `profiles` are blocked (the store's `fetchUserProfile` exists but is not the bootstrap path).

**Server auth pattern**: `api/v2/_auth.js` verifies Privy access tokens server-side (`@privy-io/server-auth`); DB work then uses the service-role client. Endpoints must check the verified DID equals the client-claimed `userId` — never trust the claimed id alone.

**Vercel function cap (12)**: the Hobby plan caps a deployment at 12 serverless functions and this repo sits at 11. Do not add new handler files under `api/`. Fold new user-facing actions into `api/v2/purchase.js` (dispatches on `action`: `ensure_profile`, `get_owned`, `get_season_progress`, `get_season_artifacts`, `boost_post`, `claim_reward`, `get_transactions`, …) and new admin operations into `api/v2/admin/mint.js` (dispatches on `kind`: `theme`, `avatar`, `season_*`, `claim_link`, `feed_post`, plus NFC tag minting). Machine-to-machine endpoints (CSP reports, the scheduled security alert, agent transmit) share `api/v2/ops.js`, which dispatches on `op`; `vercel.json` rewrites their public URLs (`/api/csp-report`, `/api/v2/security-alert`, `/api/agent/transmit`) to it, so add a new one as an `op` + rewrite. Underscore-prefixed files in `api/v2/` (`_auth.js`, `_quests.js`, `_stamps.js`, `_ascension.js`, `_avatarSvg.js`, `_audit.js`, `_ratelimit.js`, `_cspReport.js`, `_securityAlert.js`, `_agentTransmit.js`) are shared helpers, not deployed functions.

**State**: `src/store/useStore.ts` is the single Zustand store — holds `user`, `wngsBalance`, `identityType`, `activeTheme`, `activeAvatar`, `activeAvatarColors`, `activeThemeAccent`, `stamps` (legacy placeholder; the stamps system is paused), `cart`.

**Theming**: a CSS variable `--monarch-accent`, set inline in `AppContent` (`src/App.tsx`), drives the accent color throughout components instead of Chakra theme tokens. It resolves from `activeThemeAccent`: the built-in themes have fixed accents (`SYSTEM_LIGHT`/`SYSTEM_DARK` → gold, `CRIMSON_OVERRIDE` → crimson); custom themes store theirs in `products.accent_color`, in which case `activeTheme` holds the product UUID.

**Backend**: Supabase (Postgres) is the database; Vercel serverless functions under `api/` are the backend logic layer (plain `.js`, no separate server process). Key tables: `profiles`, `artifacts` (physical→digital NFC tag registry), `products` (cosmetics + WNGS bundles), `user_assets` (owned cosmetics), `transactions` (WNGS audit ledger), `seasons` + season progress (ASCENSION), `artifact_daily_taps` (one row per user, tag and calendar day — PK `(user_id, tag_id, tap_day)`), `quests`/`user_quests` and `stamps`/`user_stamps` (paused), `monarch_times` (feed). `db/*.sql` holds schema migrations that are run manually against Supabase — nothing applies them automatically; check there for expected schema, but note the live schema has drifted from code assumptions before — verify against real data when it matters.

**Client vs server Supabase clients**: `src/lib/supabase.ts` (browser) uses the anon key via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and is subject to RLS. Files under `api/` create their own clients with the service role key to bypass RLS, reading env vars through fallback chains (`process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL`, same pattern for keys) so either naming works in Vercel.

**Phygital flow (NFC tap → claim)**:
1. NTAG 424 chip URL hits `/v/:id` → `src/pages/Verify.tsx` → `GET /api/v2/verify?id=` → looks up `artifacts` by `tag_id`.
2. If unclaimed, user proceeds to `/claim/:id` (`Claim.tsx` → `POST /api/v2/claim`); already-owned tags earn recurring rewards via `POST /api/v2/tap-reward`. Claiming grants `XP_ACTIVATION` (100) and, for a season artifact, unlocks premium.
   - **Daily tap rule**: one rewarded tap per tag per calendar day in `America/New_York` (`TAP_DAY_TIMEZONE`), not a rolling 24h. The handler inserts into `artifact_daily_taps` *first*; a unique-violation (`23505`) means already tapped today and returns 429 `TAP_COOLDOWN_ACTIVE` with `retryAfterMs` until local midnight. This makes double taps race-free. A rewarded tap grants 5 WNGS and `XP_TAP` (60) season XP (`api/v2/_ascension.js`).
   - To re-record the demo, reset a tag with `update artifacts set is_activated = false, owner_id = null where tag_id = '<id>'` and delete its `artifact_daily_taps` rows.
3. `src/pages/Scanner.tsx` (`/scan`) is a Web NFC (`NDEFReader`) reader that extracts the tag id and navigates to `/v/:id` — same downstream flow.
4. Claim links redeem through `/claim/:code` → `src/pages/Claim.tsx` → `api/v2/redeem-claim.js`.

**WNGS purchase flow**: Shop (or Profile's WALLET tab — there is no separate Wallet page/route) → `POST /api/checkout/wngs` with only a `bundleId`; price (`price_usd`) and WNGS grant (`price_wngs`) are read server-side from the `WNGS_BUNDLE` product row, never from the client → Stripe Checkout (metadata carries `userId`/`wngsAmount`; success redirects to `/profile?checkout=success`) → `api/webhooks/stripe.js` (raw body, signature-verified, `bodyParser: false`) credits the balance via the `increment_wngs` RPC (direct `profiles` update as fallback), with idempotency enforced by a `transactions` row keyed on the Stripe session id.

**Seasons**: 90 days each. Season 001 runs Nov 15, 2026 → Feb 13, 2027 (`seasons` table; managed from the Command Center via the `season_*` admin kinds).

**Admin**: the admin panel is `/command-center` (alias `/admin`), which gates itself in `src/pages/CommandCenter.tsx`: only the Privy DIDs/wallets in `VITE_ADMIN_PRIVY_ID` (comma-separated, with a hardcoded fallback) see the panel. Server-side, `api/v2/admin/mint.js` authorizes either an `x-admin-passphrase` header (`ADMIN_PASSPHRASE`) or a verified Privy token whose DID is on the same allowlist (which has a hardcoded fallback DID) — keep the client and server allowlists in sync or the panel gets "Unauthorized" from the API.

**Agent feed**: `POST /api/agent/transmit` is a separate, non-Privy authenticated ingestion endpoint for AI agents — auth is a static `Bearer <AGENT_SECRET_KEY>` header, not a user session. It force-formats content (uppercases title, prefixes `[ ARCHIVAL_LOG ]`) before inserting into `monarch_times`.

**On-chain minting (parked)**: a devnet Solana/Metaplex NFT-mint path exists (`mint_avatar` action in `purchase.js`, surfaced behind `SHOW_ONCHAIN_MINT=false`). Cosmetics are intentionally Web2-only for now; don't extend or surface the on-chain path unless asked.

## Repo quirks

- Do not run recursive search tools (Glob/grep) across the repo root without excluding `node_modules/` — it contains a huge dependency tree that will time out broad searches. Scope searches to `src/`, `api/`, or specific subpaths (even root-scoped Glob patterns like `src/**/*.ts` can time out; prefer passing the subdirectory as the search path).
- `package.json` and `tsconfig.json` include `api/**/*` in the TS project, but the `api/` files are plain `.js`, not `.ts`.
- `RARITY_PRICES` (WNGS auto-pricing by rarity) is duplicated in `api/v2/admin/mint.js` and `src/lib/destijlPalette.ts` — keep the two in sync.
