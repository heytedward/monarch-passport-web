# Agent Commerce Spec — x402 / MPP (bank now, build when real)

## Context

Open Agentic Commerce (x402, Machine Payments Protocol) lets AI agents pay for resources in stablecoins (USDC) over HTTP: a request → `402` with a price → a signed payment → retry → the product. The thesis is that agents become primary buyers of *services*. This spec captures how that maps onto Papillon so we can move fast when it's worth it — **nothing is built now.**

**Honest fit (read this first):**
- **Physical apparel is a poor fit** — agents don't wear hoodies. The only path is *shopping agents buying on a human's behalf* ("agent, order me that beanie"), which is real but early. So agent-retail = future-proofing, not near-term revenue.
- **The genuine fit is agents as economic participants in the Monarch protocol** — an agent pays USDC to buy WNGS, mint a cosmetic, or boost the feed. Papillon is unusually well-positioned for this (see assets below), and it's differentiated in a way a normal store can't be.

**Decision:** spec now, build when an agent is actually knocking. Same posture as [[affiliate-program]] and [[multibrand-shopify]] — plant the cheap seam, don't pour concrete speculatively.

## Assets we already have (the head start)

- **A Privy embedded Solana wallet per user** — this *is* the wallet-signature identity x402/MPP need ("identity without accounts"). The hardest part is already solved.
- **`identityType: HUMAN | AGENT`** in `src/store/useStore.ts` — the app already splits users into humans and agents.
- **`api/agent/transmit`** — a non-Privy, static `Bearer <AGENT_SECRET_KEY>` endpoint agents already use to post into `monarch_times`. Precedent for an agent-authed surface.
- **On-chain rails parked** — the Solana/Metaplex mint keypair ([[phase3-onchain-avatars]]) + WNGS heading toward an SPL token ([[wngs-spl-token]]).
- **Economy actions already exist** as server actions in `api/v2/purchase.js` (buy WNGS, `mint_avatar`, `boost_post`, `create_discount`) and the checkout in `monarch-labs/api/create-checkout-session.ts` — these are the things an agent would pay for; they just need an x402/MPP payment layer in front.

## Design

**Rail:** USDC via **x402** (HTTP 402 challenge) and **MPP**, settling to a **Papillon treasury Solana wallet**. USDC is the *payment* rail; **WNGS stays the internal economy unit** — an agent pays USDC and *receives* WNGS / a cosmetic / a boost. This reinforces the hybrid model: USDC in, WNGS as the loyalty layer, both on the Solana wallets we already issue.

**Identity:** map the caller's wallet signature → a `profiles` row (create on first sight, like `ensure_profile`). AGENT identityType is native here. No accounts, just wallets.

**Wrapper:** use **`@agentcash/router`** to make endpoints correct-by-construction (emits the standard 402 shape, schemas, settlement, discovery docs). ⚠ Its one-click examples are **Next.js App Router**; our storefront is **Vite + Vercel serverless (`api/*.ts`)**, so use the router's **Node/Hono** path, not the Next drop-in.

### What agents can pay for (in priority order)
1. **Discovery only (near-free):** `GET /openapi.json` (OpenAPI 3.1 + pricing extensions) and `GET /llms.txt` describing the catalog + actions, so agents find/understand Papillon and it indexes on x402scan / mppscan. No payment logic.
2. **Economy actions (the real fit):** x402/MPP-payable endpoints, in USDC, for **buy WNGS**, **mint a cosmetic** (`mint_avatar`/theme), and **boost a feed post** — thin x402 wrappers over the existing `purchase.js` actions. This is "agents as participants."
3. **Agent-retail (future):** an x402 checkout path for physical products alongside Stripe (shopping agents buying for a human), which must still collect a shipping address and hand off to the Printful fulfillment we built.

### Where it lives
- Discovery + agent-retail → **monarch-labs** (storefront, its own Vercel function budget).
- Economy actions → the passport owns them, but it's at the **12-function cap**, so either fold x402 handling into the existing `purchase.js` dispatch or host a thin **agent gateway on monarch-labs** that verifies payment then calls the passport with the service role. (Decide at build time.)

## Phasing

- **Phase 0 — flag-plant (cheap, do first if anything):** publish `openapi.json` + `llms.txt` for the catalog; register on x402scan/mppscan. Zero economic commitment; makes us agent-discoverable the day it matters.
- **Phase 1 — agents as participants:** x402/MPP + USDC for **buy WNGS** and **mint cosmetic**, settling to treasury, wallet identity. The differentiated MVP.
- **Phase 2 — agent-retail:** x402 checkout for physical goods (shopping agents) with shipping capture → existing Printful auto-fulfillment.
- **Phase 3 — richer:** metered/per-unit pricing, agent-only drops, an agent leaderboard in MONARCH_TIMES, deeper agent-feed integration.

## Open decisions (finalize at build time)
- Which action ships first (buy-WNGS vs cosmetic-mint) and its **pricing model** (fixed vs metered per request).
- **Treasury wallet** for USDC settlement (reuse the parked keypair or a fresh multisig) + accounting/tax posture.
- Whether **WNGS itself becomes agent-purchasable** — couples to the SPL token launch ([[wngs-spl-token]]).
- **x402 and MPP both**, or start with one (every standard skipped = buyers who can't pay).
- Anti-abuse: per-wallet rate limits / cooldowns (reuse the ip_hash/cooldown pattern from `log-social-scan.js`, adapted to wallet identity).

## Verification (when built)
An agent (or a test script signing a USDC payment) hits a paid endpoint → receives `402` with the price → signs → retries → gets the product. Confirm: the **treasury wallet received USDC**, the caller's `profiles` row was credited (WNGS / cosmetic minted / post boosted), a `transactions` ledger row was written, and the endpoint appears indexed on x402scan/mppscan.

## Note
When this moves to implementation, save a `project`-type memory of the built state and update this file. The differentiated bet is Phase 1 (agents as economic participants), not agent-retail — build that when a real agent shows up, and plant Phase 0 whenever it's cheap.
