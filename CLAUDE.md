# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Monarch Passport is the Web2 (with Web3-adjacent) loyalty hub for Papillon Brand. Users authenticate via Privy (embedded Solana wallets), tap NFC-enabled apparel to earn $WNGS points, climb a seasonal battlepass (ASCENSION), collect stamps, equip cosmetic "Identities" (avatars) / "Protocols" (themes), and buy $WNGS bundles via Stripe. The UI follows a strict industrial De Stijl aesthetic (sharp 2-4px borders, Archivo Black headings, Space Mono body text, black/gold `#FFB000`/crimson `#DC143C` palette) — see `SYSTEM_ARCHITECTURE.md` for the full design/system spec.

`monarch-passport-web` (this repo) is the core user-facing hub; a separate `monarch-labs` repo is the e-commerce storefront.

## Commands

- `npm run dev` — start Vite dev server (port 5173, or `$PORT`)
- `npm run typecheck` — `tsc --noEmit` (no lint/test scripts exist; this is the only static check)
- `npm run build` — `tsc --noEmit && vite build` (typecheck gates the build/deploy; keep `tsc` clean)
- `npm run preview` — preview the production build

## Architecture

**Frontend**: React 18 + TypeScript + Vite, Chakra UI for components/theming, React Router for routing, Zustand (`persist` middleware, localStorage key `monarch-passport-storage`) for client state, Framer Motion for animation. The whole app renders inside a centered ~430px phone-frame column (`AppContent` in `src/App.tsx`).

**Auth**: Privy (`PrivyProvider` in `src/App.tsx`) handles login (email/wallet/Google/Apple) and embedded Solana wallet creation. Routes are gated by a local `ProtectedRoute` wrapper in `App.tsx`, which also requires `identityType` (`'HUMAN' | 'AGENT'`) to be set in the Zustand store.

**Dev auth bypass**: gated surfaces (`ProtectedRoute`, `Navbar`, `Scanner`, `Collect`) independently check `import.meta.env.DEV && localStorage.getItem('monarch_dev_bypass') === 'true'` to skip Privy auth locally. When adding a new protected page or component, replicate this check rather than assuming `ProtectedRoute` alone covers it.

**Session bootstrap**: on every authenticated session, `AppContent` calls `POST /api/v2/purchase` with `action: 'ensure_profile'`, which creates the `profiles` row if missing and returns balance/theme/avatar to populate the store. This goes through the server because Supabase can't validate Privy tokens, so the browser anon client's RLS reads of `profiles` are blocked (the store's `fetchUserProfile` exists but is not the bootstrap path).

**Server auth pattern**: `api/v2/_auth.js` verifies Privy access tokens server-side (`@privy-io/server-auth`); DB work then uses the service-role client. Endpoints must check the verified DID equals the client-claimed `userId` — never trust the claimed id alone.

**Vercel function cap (12)**: the Hobby plan caps a deployment at 12 serverless functions and this repo sits at exactly 12. Do not add new handler files under `api/`. Fold new user-facing actions into `api/v2/purchase.js` (dispatches on `action`: `ensure_profile`, `get_owned`, `get_quests`, `collect`, `boost_post`, `claim_reward`, `mint_avatar`, …) and new admin operations into `api/v2/admin/mint.js` (dispatches on `kind`: `theme`, `avatar`, `season_*`, `claim_link`, `feed_post`, plus NFC tag minting). Underscore-prefixed files in `api/v2/` (`_auth.js`, `_quests.js`, `_stamps.js`, `_ascension.js`, `_avatarSvg.js`) are shared helpers, not deployed functions.

**State**: `src/store/useStore.ts` is the single Zustand store — holds `user`, `wngsBalance`, `identityType`, `activeTheme`, `activeAvatar`, `activeAvatarColors`, `activeThemeAccent`, `stamps`, `cart`.

**Theming**: a CSS variable `--monarch-accent`, set inline in `AppContent` (`src/App.tsx`), drives the accent color throughout components instead of Chakra theme tokens. It resolves from `activeThemeAccent`: the built-in themes have fixed accents (`SYSTEM_LIGHT`/`SYSTEM_DARK` → gold, `CRIMSON_OVERRIDE` → crimson); custom themes store theirs in `products.accent_color`, in which case `activeTheme` holds the product UUID.

**Backend**: Supabase (Postgres) is the database; Vercel serverless functions under `api/` are the backend logic layer (plain `.js`, no separate server process). Key tables: `profiles`, `artifacts` (physical→digital NFC tag registry), `products` (cosmetics + WNGS bundles), `user_assets` (owned cosmetics), `transactions` (WNGS audit ledger), `seasons` + season progress (ASCENSION), `quests`/`user_quests`, `stamps`/`user_stamps`, `monarch_times` (feed). `db/*.sql` holds schema migrations that are run manually against Supabase — nothing applies them automatically; check there for expected schema, but note the live schema has drifted from code assumptions before — verify against real data when it matters.

**Client vs server Supabase clients**: `src/lib/supabase.ts` (browser) uses the anon key via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and is subject to RLS. Files under `api/` create their own clients with the service role key to bypass RLS, reading env vars through fallback chains (`process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL`, same pattern for keys) so either naming works in Vercel.

**Phygital flow (NFC tap → claim)**:
1. NTAG 424 chip URL hits `/v/:id` → `src/pages/Verify.tsx` → `GET /api/v2/verify?id=` → looks up `artifacts` by `tag_id`.
2. If unclaimed, user proceeds to `/claim/:id` (`Claim.tsx` → `POST /api/v2/claim`); already-owned tags earn recurring rewards via `POST /api/v2/tap-reward` (24h cooldown per tag).
3. `src/pages/Scanner.tsx` (`/scan`) is a Web NFC (`NDEFReader`) reader that extracts the tag id and navigates to `/v/:id` — same downstream flow.
4. Claim-link QR codes redeem through `/collect/:code` → `api/v2/redeem-claim.js`.

**WNGS purchase flow**: Shop (or Profile's WALLET tab — there is no separate Wallet page/route) → `POST /api/checkout/wngs` with only a `bundleId`; price (`price_usd`) and WNGS grant (`price_wngs`) are read server-side from the `WNGS_BUNDLE` product row, never from the client → Stripe Checkout (metadata carries `userId`/`wngsAmount`; success redirects to `/profile?checkout=success`) → `api/webhooks/stripe.js` (raw body, signature-verified, `bodyParser: false`) credits the balance via the `increment_wngs` RPC (direct `profiles` update as fallback), with idempotency enforced by a `transactions` row keyed on the Stripe session id.

**Admin**: the admin panel is `/command-center` (alias `/admin`), wrapped in `src/AdminGuard.tsx`, which allows only the Privy DID in `VITE_ADMIN_PRIVY_ID`. Server-side, `api/v2/admin/mint.js` authorizes either an `x-admin-passphrase` header (`ADMIN_PASSPHRASE`) or a verified Privy token whose DID is on the same allowlist (which has a hardcoded fallback DID) — keep the client and server allowlists in sync or the panel gets "Unauthorized" from the API.

**Agent feed**: `POST /api/agent/transmit` is a separate, non-Privy authenticated ingestion endpoint for AI agents — auth is a static `Bearer <AGENT_SECRET_KEY>` header, not a user session. It force-formats content (uppercases title, prefixes `[ ARCHIVAL_LOG ]`) before inserting into `monarch_times`.

**On-chain minting (parked)**: a devnet Solana/Metaplex NFT-mint path exists (`mint_avatar` action in `purchase.js`, surfaced behind `SHOW_ONCHAIN_MINT=false`). Cosmetics are intentionally Web2-only for now; don't extend or surface the on-chain path unless asked.

## Repo quirks

- `MPV1/` is a separate, older nested git repository (its own `.git`, `node_modules`) checked out inside this repo — effectively a frozen earlier version of the app, not an active package. Git status shows it as `m MPV1` (modified submodule-like content). Avoid treating it as live source; if asked to compare "old vs new", that's where the old version lives. It also has a file-ownership mismatch with the current user, so plain `git` commands inside it will fail until ownership is fixed — don't try to fix this unless asked.
- Do not run recursive search tools (Glob/grep) across the repo root without excluding `MPV1/` and `node_modules/` — both contain huge dependency trees that will time out broad searches. Scope searches to `src/`, `api/`, or specific subpaths (even root-scoped Glob patterns like `src/**/*.ts` can time out; prefer passing the subdirectory as the search path).
- `package.json` and `tsconfig.json` include `api/**/*` in the TS project, but the `api/` files are plain `.js`, not `.ts`.
- `RARITY_PRICES` (WNGS auto-pricing by rarity) is duplicated in `api/v2/admin/mint.js` and `src/lib/destijlPalette.ts` — keep the two in sync.
