# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Monarch Passport is the Web2 (with Web3-adjacent) loyalty hub for Papillon Brand. Users authenticate via Privy (embedded Solana wallets), tap NFC-enabled apparel to earn $WNGS points, collect seasonal stamps, equip cosmetic "Identities"/"Protocols", and buy $WNGS bundles via Stripe. The UI follows a strict industrial De Stijl aesthetic (sharp 2-4px borders, Archivo Black headings, Space Mono body text, black/gold `#FFB000`/crimson `#DC143C` palette) — see `SYSTEM_ARCHITECTURE.md` for the full design/system spec.

`monarch-passport-web` (this repo) is the core user-facing hub; a separate `monarch-labs` repo is the e-commerce storefront.

## Commands

- `npm run dev` — start Vite dev server (port 5173, or `$PORT`)
- `npm run typecheck` — `tsc --noEmit` (no lint/test scripts exist; this is the only static check)
- `npm run build` — `tsc --noEmit && vite build` (typecheck now gates the build/deploy; keep `tsc` clean)
- `npm run preview` — preview the production build

## Architecture

**Frontend**: React 18 + TypeScript + Vite, Chakra UI for components/theming, React Router for routing, Zustand (`persist` middleware, localStorage key `monarch-passport-storage`) for client state, Framer Motion for animation.

**Auth**: Privy (`PrivyProvider` in `src/App.tsx`) handles login (email/wallet/Google/Apple) and embedded Solana wallet creation. `usePrivy()` exposes `ready`/`authenticated`/`user`. Routes are gated by a local `ProtectedRoute` wrapper in `App.tsx`, which also requires `identityType` (`'HUMAN' | 'AGENT'`) to be set in the Zustand store.

**Dev auth bypass**: every gated surface (`ProtectedRoute`, `Navbar`, `Scanner`, etc.) independently checks `import.meta.env.DEV && localStorage.getItem('monarch_dev_bypass') === 'true'` to skip Privy auth locally. When adding a new protected page or component, replicate this check rather than assuming `ProtectedRoute` alone covers it.

**State**: `src/store/useStore.ts` is the single Zustand store — holds `user`, `wngsBalance`, `identityType`, `activeTheme`, `activeAvatar`, `stamps`, `cart`. `fetchUserProfile(userId)` pulls `wngs_balance` / `active_theme` / `active_avatar` / `total_taps` from the Supabase `profiles` table and is invoked from `App.tsx` whenever Privy reports an authenticated user.

**Theming**: `activeTheme` (`'SYSTEM_DARK' | 'CRIMSON_OVERRIDE'`) drives a CSS variable `--monarch-accent` set inline in `AppContent` (`src/App.tsx`), consumed throughout components (e.g. `Navbar.tsx`) instead of Chakra theme tokens — changing the accent color means updating that variable, not `theme.ts`.

**Backend**: Supabase (Postgres) is the database; Vercel serverless functions under `api/` are the backend logic layer (no separate server process). Key tables referenced across the code: `profiles`, `artifacts` (physical→digital NFC tag registry), `user_assets` (owned cosmetics), `monarch_times` (agent-driven news feed).

**Client vs server Supabase clients differ**: `src/lib/supabase.ts` (browser) uses the anon key via `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and is subject to RLS. Files under `api/` instantiate their own `createClient` with the service role key to bypass RLS — but are inconsistent about env var names (some use `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `api/agent/transmit.js` mixes `VITE_SUPABASE_URL` with `SUPABASE_SERVICE_ROLE_KEY`). Check the actual env var names in the specific file you're touching rather than assuming consistency.

**Phygital flow (NFC tap → claim)**:
1. NTAG 424 chip URL hits `/v/:id` → `src/pages/Verify.tsx` → `GET /api/v2/verify?id=` → looks up `artifacts` by `tag_id`.
2. If unclaimed, user proceeds to `/claim/:id` (`src/pages/Claim.tsx`).
3. `src/pages/Scanner.tsx` is a separate, older Web NFC (`NDEFReader`) based flow that posts to `${API_URL}/api/nfc/claim` — note this hits an external `API_URL` host (`src/config.ts`), not the Vercel `api/` functions in this repo, and that endpoint doesn't exist under `api/v2`. Treat `Scanner.tsx` as legacy/in-flux when working on claim logic; `Verify.tsx`/`Claim.tsx` is the current path.
4. Admin tag minting is `POST /api/v2/admin/mint`, gated by an `x-admin-passphrase` header checked against `ADMIN_PASSPHRASE` (not Privy auth).

**WNGS purchase flow**: `Shop`/`Wallet` pages → `POST /api/checkout/wngs` creates a Stripe Checkout session (metadata carries `userId`/`wngsAmount`) → Stripe redirects to `success_url`/`cancel_url` → `api/webhooks/stripe.js` (raw body, signature-verified, `bodyParser: false`) handles `checkout.session.completed` and credits the balance via the `increment_wngs` RPC, falling back to a direct `profiles` update if the RPC fails.

**Agent feed**: `POST /api/agent/transmit` is a separate, non-Privy authenticated ingestion endpoint for AI agents — auth is a static `Bearer <AGENT_SECRET_KEY>` header, not a user session. It force-formats content (uppercases title, prefixes `[ ARCHIVAL_LOG ]`) before inserting into `monarch_times`.

**AdminGuard**: `src/AdminGuard.tsx` currently has its real Privy-ID check commented out and unconditionally renders children — it's a no-op gate right now, not a removed feature. Don't assume admin pages wrapped in it are actually access-controlled.

## Repo quirks

- `MPV1/` is a separate, older nested git repository (its own `.git`, `node_modules`) checked out inside this repo — effectively a frozen earlier version of the app, not an active package. Git status shows it as `m MPV1` (modified submodule-like content). Avoid treating it as live source; if asked to compare "old vs new", that's where the old version lives. It also has a file-ownership mismatch with the current user, so plain `git` commands inside it will fail until ownership is fixed — don't try to fix this unless asked.
- Do not run recursive search tools (Glob/grep) across the repo root without excluding `MPV1/` and `node_modules/` — both contain huge dependency trees that will time out broad searches. Scope searches to `src/`, `api/`, or specific subpaths.
- `package.json` and `tsconfig.json` include `api/**/*` in the TS project, but the `api/` files are plain `.js`, not `.ts`.
