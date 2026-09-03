# SECURITY AUDIT — monarch-passport-web

Audit of the 20-point checklist, covering fixes in `04563ad`, `2968663` and
`HEAD`. Item 4 was verified directly against the production Supabase project on
2026-09-03; everything else is grounded in a specific file and line.

## Summary

| # | Item | Status |
|---|---|---|
| 1 | Hide API keys | PASS |
| 2 | Purge Git secrets | PASS |
| 3 | Use public DB key | PASS |
| 4 | Enable row-level security | FIXED — applied and verified in production |
| 5 | Encrypt sensitive data | PASS (one note on mainnet keys) |
| 6 | Enforce server-side auth | FIXED — auth bypass closed |
| 7 | Lock record access | FIXED — see #4 |
| 8 | Block field tampering | FIXED |
| 9 | Secure session cookies | N/A — Privy-managed |
| 10 | Hash passwords | N/A — no passwords exist |
| 11 | Rate limit login | FIXED for app endpoints; login is Privy's |
| 12 | Add bot protection | PARTIAL — rate limits, no CAPTCHA |
| 13 | Parameterize queries | PASS |
| 14 | Validate all input | FIXED |
| 15 | Escape user content | PASS |
| 16 | Restrict file uploads | FIXED — SVG gap closed |
| 17 | Trim API responses | FIXED — this was a live leak |
| 18 | Add security headers | FIXED — CSP in report-only |
| 19 | Force HTTPS | PASS |
| 20 | Scan dependencies | FIXED — runtime advisories + CI |

### Status

All 20 items are now closed or reduced to deliberate, documented trade-offs.
The four world-open RLS policies — including the `claim_links` write path that
let anyone mint WNGS with no account — were applied to production on
2026-09-03 and verified by impersonating the `anon` role (see item 4). The
Supabase security linter now reports **zero WARN-level findings**; the
remaining INFO notices are the intended service-role-only posture.

### Remaining

1. **#18 — promote CSP** from report-only to enforcing after a violation pass.
2. **#12 — bot protection**, if abuse appears in the logs.
3. **#17 — salt or drop `ip_hash`**, and trim the two catalog reads.
4. **Delete the six legacy tables** (`digital_assets`, `digital_garments`,
   `inventory`, `store_orders`, `user_digital_inventory`, `user_seasons`) — no
   code references any of them, and one carries a world-readable policy.
5. **Tighten the CI audit gate** from `critical` to `high` once the
   Metaplex/Irys/Solana tree is cleaned up or the on-chain path is resolved.

Separately and above all of these: **NTAG 424 SUN message authentication.** The
enumeration stopgap in `04563ad` raises the cost of guessing a tag ID but does
not authenticate a tap — the URL is still static and clonable off a chip.

Five findings here were live issues rather than hardening: world-open
`claim_links` writes and `wngs_discounts` reads (#4), the agent auth bypass
(#6), visitor IP hashes published to referral-link owners (#17), and
mint-to-any-wallet (#8).

---

## 1. Hide API keys — PASS

No hardcoded credentials in `src/` or `api/`. Every secret reads from
`process.env` (server) or `import.meta.env` (client). A scan for `sk_live`,
`sk_test`, `whsec_`, JWT prefixes and PEM headers returns only env-var
references.

The five `VITE_`-prefixed vars compiled into the browser bundle are all
legitimately public:

```
VITE_ADMIN_PRIVY_ID  VITE_API_URL  VITE_PRIVY_APP_ID
VITE_SUPABASE_ANON_KEY  VITE_SUPABASE_URL
```

`SUPABASE_SERVICE_ROLE_KEY` is never `VITE_`-prefixed and never referenced from
`src/` — correct. `src/config.ts` hardcodes a Privy app ID fallback, and
`api/v2/admin/mint.js` hardcodes fallback admin DIDs; both are public
identifiers, not secrets, and the latter is documented as such (security comes
from the verified Privy token, not the allowlist).

## 2. Purge Git secrets — PASS

`git log --all --diff-filter=A` shows no `.env`, key, or credential file was
ever added. `.gitignore` covers `.env`, `.env.local`, and `*.env.local`. No
secret-bearing file is tracked today.

*Caveat:* this covers this repository's history only. `MPV1/` is a separate
nested git repo; it contributes 0 tracked files here, so it can't leak through
this repo, but its own history was not inspected.

## 3. Use public DB key — PASS

`src/lib/supabase.ts` builds the browser client from `VITE_SUPABASE_ANON_KEY`
only. Every service-role client is constructed inside `api/` (verified across
all 12 function files). No `service_role` reference exists anywhere under
`src/`.

## 4. Enable row-level security — FIXED (4 gaps found in production, all closed)

Checked live against project `dfpfkmrpnwioxzbwndzx` on 2026-09-03.

**The good news: RLS is enabled on all 30 public tables.** The "applied by hand
in the dashboard" hypothesis was correct — the repo simply never captured it.
The per-user policies are also written correctly, scoping on
`auth.jwt() ->> 'sub'` (the Privy DID): `profiles`, `transactions`,
`user_assets`, `user_quests`, `user_digital_inventory` and `artifact_scans` all
restrict reads to the owner. And `waitlist` has an INSERT policy but **no SELECT
policy**, so signup addresses can be added and never read back — the worst case
in the original draft of this audit did not materialise.

Tables carrying RLS with **zero** policies are also correct, not a gap: they're
reached only by service-role code in `api/`, which bypasses RLS, so zero
policies means deny-all to the anon key. That's the right posture for
`artifacts`, `post_comments`, `purchase_grants`, `stamps`, `user_stamps`,
`store_orders`, `inventory`, `collection_items`, `user_collection_items`,
`user_seasons` and `rate_limits`. Supabase's linter flags these as INFO
`rls_enabled_no_policy`; they can be ignored.

**Four policies were written as `USING (true)` / `WITH CHECK (true)` for the
`public` role, though — which means the anon key, which ships in the browser
bundle.** `db/rls_hardening.sql` removed all four; it was applied to production
on 2026-09-03 and the result verified (see *Applied and verified* below).

### 4a. `claim_links` — the most serious finding in this audit

Five world-open policies: public SELECT (×2), public UPDATE (×2), public INSERT.
The table holds QR redemption codes — `short_code`, `wngs_award`, `is_claimed`,
`max_redemptions`.

With nothing but the anon key, an attacker could:

- **read every `short_code`** and redeem the lot;
- **`UPDATE is_claimed` back to `false`** and replay a redemption indefinitely;
- **`INSERT` their own rows** with an arbitrary `wngs_award` and redeem those —
  minting WNGS from nothing, with no account, no physical item, and no NFC tag.

That last one is worse than the tag enumeration this engagement started with:
enumeration at least required tags to exist. This is a direct, unauthenticated
write path into the currency supply.

### 4b. `wngs_discounts` — public read of live discount codes

`USING (true)` SELECT on a table holding `code`, `discount_usd`, `status`.
Anyone with the anon key could read every active discount code and spend it at
the storefront. `discount_usd` is capped at `MAX_DISCOUNT_USD` ($500) per code.

### 4c. `user_season_progress` — cross-user read

`USING (true)` SELECT, exactly as predicted from `db/phase2_ascension.sql:76-86`.
Every player's ASCENSION level readable by anyone.

This one needed a **code change before the policy could be tightened**, and that
is the interesting part: the policy was permissive *because* `Ascension.tsx` and
`Profile.tsx` read the table with the anon client, and Supabase cannot identify
a Privy user (it won't validate a Privy JWT, so `auth.jwt()` is null). A
correctly-scoped policy would have denied those reads and blanked the ladder.
Both reads now go through a new `get_season_progress` action in
`api/v2/purchase.js` on the service role, so the policy can be dropped.

### 4d. `artifact_scans` — forgeable log rows

Public `INSERT ... WITH CHECK (true)`, so anyone could write scan rows. Written
server-side by `log-social-scan.js`; the owner-scoped SELECT policy is correct
and is kept.

Also worth noting: `artifact_scans` has a `scanner_ip` column (raw, not hashed).
It appears unused by current code paths — confirm before it starts collecting.

### Applied and verified

`db/rls_hardening.sql` was applied to production on 2026-09-03, after
confirming the app code was live — Vercel deployment
`dpl_BPxDURUJ1R75RuVY3aypUxeTu7Ag` (commit `daf1d2d`, the PR #1 merge) reached
READY first, so the `get_season_progress` path existed before its policy was
dropped.

Verified by impersonating the `anon` role — the role the browser bundle's key
maps to — inside rolled-back transactions:

| Probe as `anon` | Before | After |
|---|---|---|
| `SELECT` `claim_links` | 2 rows | **0 rows** |
| `SELECT` `wngs_discounts` | 2 rows | **0 rows** |
| `SELECT` `user_season_progress` | all rows | **0 rows** |
| `INSERT` into `claim_links` (`wngs_award: 999999`) | would succeed | **`42501` RLS violation** |
| `SELECT` `products` / `seasons` (intended public) | works | **still works** (24 / 1 rows) |
| `SELECT` `waitlist` / `profiles` / `transactions` | 0 rows | **0 rows** (already correct) |

The INSERT probe ran inside a transaction that always rolls back; a follow-up
count confirmed `claim_links` still holds its original 2 rows with no stray
test data.

Policy count went 30 → 22, matching `db/rls_policies.sql` exactly.

### Two linter warnings also fixed

`update_updated_at_column` and `process_social_scan_reward` had mutable
`search_path`. A `SECURITY DEFINER` function with a mutable search_path can be
hijacked via a caller-controlled schema; the migration pins both to `public`.

### The standing problem

The repo is still not the source of truth for RLS. All of the above was
configured in the dashboard and existed nowhere in `db/`, which is why this took
a live check to find. `db/rls_hardening.sql` is a start; the correctly-scoped
policies that already exist should also be captured as a migration so a rebuilt
environment doesn't come up wide open.

## 5. Encrypt sensitive data — PASS, one note

PII held: email addresses (`waitlist`, `purchase_grants`), Privy DIDs, and
wallet addresses if the on-chain path is ever enabled. No passwords are stored
(item 10) and no card data touches the app — Stripe Checkout is hosted, and
`api/webhooks/stripe.js` only ever sees a session id.

Supabase encrypts at rest by default. IP addresses are never stored raw: both
`api/v2/log-social-scan.js:32` and the new `api/v2/_ratelimit.js:31` SHA-256 them
before use. Nothing here needs application-level encryption today.

**Note for mainnet:** `MINT_AUTHORITY_SECRET` (`api/v2/purchase.js:224`) is a raw
Solana keypair held in a Vercel environment variable. That's acceptable for a
parked devnet POC and *not* acceptable for a mainnet mint authority — anyone
with dashboard access or a leaked env dump controls minting permanently. Move it
to a KMS/HSM or a signing service before the on-chain work ships.

## 6. Enforce server-side auth — FIXED

The pattern is applied consistently. Every user-facing endpoint verifies the
Privy access token server-side and confirms the verified DID equals the
client-claimed id — `claim.js:49`, `tap-reward.js:46`, `equip.js:38`,
`purchase.js`, `redeem-claim.js`, and `admin/mint.js:isAuthorizedAdmin`. The
client-claimed id is never trusted alone.

**Bypass found and fixed** — `api/agent/transmit.js` previously read:

```js
if (!authHeader || authHeader !== `Bearer ${agentSecret}`) {
```

When `AGENT_SECRET_KEY` is unset, the template literal renders the string
`"Bearer undefined"`, so anyone sending that exact header authenticates and can
publish to the `monarch_times` feed. A missing secret must be a hard failure,
never a usable credential. Now requires the secret to be configured and compares
in constant time via SHA-256 + `timingSafeEqual`.

Two endpoints are unauthenticated **by design** and remain so:
`api/v2/log-social-scan.js` (logs a visit to a public referral link; the visitor
isn't expected to be logged in, and payout is gated by an IP cooldown plus the
owner's stamina) and `api/waitlist.js` (public signup, now rate-limited).

## 7. Lock record access — FIXED

Every read and write is scoped to the verified caller: `equip.js:48` checks
`user_assets` ownership before equipping, `tap-reward.js:73` rejects when
`artifact.owner_id !== userId`, `purchase.js:192` rejects minting an asset the
caller doesn't own, and `verify.js:55-64` deliberately avoids leaking the
owner's Privy DID to anonymous callers — it returns a boolean `isOwner`
computed against an optional bearer token instead.

The original draft noted this item was "only as strong as item 4", since all of
it runs on the service role and could be bypassed by querying PostgREST
directly. That check has now been done: RLS is enabled everywhere, the per-user
policies are correctly scoped to the Privy DID, and the four world-open policies
that *did* allow a bypass are removed by `db/rls_hardening.sql`. Once that
migration runs, the API layer and the database agree.

## 8. Block field tampering — FIXED

Notably well handled:

- `api/checkout/wngs.js:44-64` accepts only a `bundleId` and reads `price_usd`
  and `price_wngs` from the `products` row. Price is never client-supplied, and
  the Stripe metadata carrying `wngsAmount` is set server-side and immutable to
  the client afterwards.
- `api/webhooks/stripe.js` verifies the Stripe signature against the raw body
  and enforces idempotency with a `transactions` row keyed on the session id.
- WNGS debits use optimistic locking — `purchase.js:481-484` conditions the
  update on `.eq('wngs_balance', bal)` and returns `409 BALANCE_CHANGED` rather
  than clobbering a concurrent write, with an explicit refund path if the
  dependent insert fails (`purchase.js:686`).

**Fixed in `04563ad`:** `admin/mint.js` took `startNum`/`count` straight from
JSON. A string `startNum` made `startNum + i` concatenate rather than add
(`"1" + 0 === "10"`), and `count` was unbounded — one request could insert
arbitrarily many rows. Both are now integer-coerced, and a batch is capped at
500.

**Fixed in `2968663`:** `mintAvatar` took `recipient` from the request body and
validated only that it parsed as a public key, so a user could mint an asset
they own into *anyone's* wallet — irreversibly, since the NFT lands there and
there's no authority to claw it back. It now resolves the caller's linked
wallets through a new `getPrivyUserWallets()` in `_auth.js` (the embedded Privy
wallet plus any linked externals) and rejects a recipient that isn't among them.

Two deliberate choices there: the comparison is case-sensitive because Solana
pubkeys are base58, and the lookup **fails closed** — unlike the best-effort
`getPrivyUserEmails()` beside it, it throws rather than returning `[]`, so a
Privy API outage returns `503 RECIPIENT_VERIFICATION_UNAVAILABLE` instead of
silently treating an unverifiable address as acceptable.

This was a prerequisite for the user-paid mint button, since that flow makes the
recipient economically meaningful.

## 9. Secure session cookies — N/A

The application sets no cookies of its own — a grep for `Set-Cookie`/`cookie`
across `src/` and `api/` returns nothing. Session handling belongs entirely to
Privy, which manages its own token storage. Client-side `localStorage` use is
limited to non-sensitive UI state: the Zustand persist key, Chakra's color mode,
a notifications-seen timestamp, and the DEV-only auth bypass flag (which is
gated on `import.meta.env.DEV` at every call site).

`04563ad` adds `Cross-Origin-Opener-Policy: same-origin-allow-popups` —
`same-origin` would break Privy's Google/Apple OAuth popups.

## 10. Hash passwords — N/A

There are no passwords. Privy owns all authentication (email OTP, Google, Apple,
external wallet) and the app never receives or stores a credential. Nothing to
hash — this is correct by design, not an omission.

The one static credential in the system is `ADMIN_PASSPHRASE`
(`admin/mint.js:72`), compared directly against a header. It is an operator
break-glass secret rather than a user password, but the comparison is not
constant-time and would benefit from the same `timingSafeEqual` treatment
applied to `transmit.js`.

## 11. Rate limit login — PARTIAL

There is no login endpoint in this codebase to rate limit — authentication is
hosted by Privy, so their throttling applies, not ours. Worth confirming what
Privy enforces on OTP requests in their dashboard, since email-OTP flooding
would be their surface, not this app's.

What *this* codebase needed was limits on the endpoints that mutate value.
`04563ad` adds a shared fixed-window limiter (`api/v2/_ratelimit.js`) backed by
a `rate_limits` table and an atomic `rate_limit_hit` RPC, applied as:

| Endpoint | Limit | Keyed on |
|---|---|---|
| `verify` | 30 / min | IP hash |
| `claim` | 5 / hr **and** 10 / day | IP hash, verified DID |
| `tap-reward` | 60 / hr | verified DID |
| `waitlist` | 5 / hr | IP hash |

On `claim`, the hit is counted *before* the tag lookup, so probes for
non-existent tag IDs — what enumeration mostly produces — consume budget too.

The limiter **fails open** and logs `RATE_LIMIT_DEGRADED` if
`db/security_hardening.sql` hasn't been applied, so an unmigrated deploy can't
take `/claim` and `/verify` down. That also means **the limits are not actually
enforced until the migration is run.** Apply it, then confirm no
`RATE_LIMIT_DEGRADED` lines appear in the function logs.

**Closed in `2968663`:** `api/v2/purchase.js` now caps its mutating actions at
60/hr per user (`collect`, `create_discount`, `cancel_discount`, `boost_post`,
`add_comment`, `recharge_stamina`, `claim_reward`, `mint_avatar`) under a single
shared budget, so spend can't be spread across actions to dodge a per-action
limit. Reads and `ensure_profile` are deliberately unlimited — the latter runs
on every session bootstrap.

The migration was applied on 16 Aug 2026 and verified in the SQL editor
(`rate_limit_hit` incrementing, `rate_limits_sweep` returning a count), so all
limits below are live rather than degraded.

## 12. Add bot protection — PARTIAL

`waitlist` and the tag endpoints now have IP-keyed rate limits, and
`log-social-scan.js:81-95` already enforced a 24h per-IP cooldown to stop
self-farming of referral links. There is no CAPTCHA or proof-of-work anywhere,
so a distributed attacker with many IPs is unaffected.

Given the app's size, rate limiting is a reasonable stopping point for now. If
waitlist spam or claim abuse shows up in logs, Cloudflare Turnstile on
`waitlist` and `claim` is the cheapest next step.

## 13. Parameterize queries — PASS

All database access goes through the `supabase-js` query builder, which
parameterizes. There is no raw SQL, no string-concatenated `WHERE`, and no
dynamic table or column names anywhere in `api/`.

One filter string is built by interpolation — `purchase.js:558`:

```js
q.or(`season_id.eq.${season.id},season_id.is.null`)
```

`season.id` is a UUID read from the database by `getActiveSeason()`, not user
input, so it isn't injectable. Worth a comment so it isn't copied into a
user-input context later.

The two SQL functions added in `db/security_hardening.sql` take typed parameters
and set an explicit `search_path`.

## 14. Validate all input — FIXED

Present and correct before this pass: email format (`waitlist.js:28-31`),
server-side bundle lookup rather than client price (`checkout/wngs.js`), comment
length cap, rarity allowlist, 8MB image cap, and — from `04563ad` — integer
coercion and a 500-row cap on artifact batches.

Closed in `2968663`:

- `mintAvatar` `recipient` — now verified against the caller's linked wallets
  (item 8).
- `image_url` in `transmit.js` must be an absolute `http(s)` URL, rejecting
  `javascript:`, `data:` and `file:` before they reach the feed.
- `transmit.js` now caps `title` (200), `raw_content` (20 000) and
  `agent_identity` (100), so a holder of the agent key can't write unbounded
  rows. It also type-checks them: a non-string `title` previously passed the
  `!title` guard and then threw on `.toUpperCase()`, returning a 500 where a 400
  was correct.

Remaining (low): `imageUrl` in `createFeedPost` is still accepted as an
arbitrary string when passed directly rather than as `imageData`. It is
admin-only and renders as `<img src>`, so it loads external content rather than
executing script — worth the same `isHttpUrl` treatment when convenient.

## 15. Escape user content — PASS

Zero occurrences of `dangerouslySetInnerHTML` or `innerHTML` in `src/`. React
escapes interpolated content by default, so stored user text (comments, feed
posts) renders inert. `transmit.js` reformats content (uppercases the title,
prefixes `[ ARCHIVAL_LOG ]`) but stores it as plain text.

The only residual is user-supplied image URLs (item 14) — an external resource
load, not script execution. `X-Content-Type-Options: nosniff` from `04563ad`
further reduces the chance of a served asset being reinterpreted as script.

## 16. Restrict file uploads — FIXED

Uploads are admin-only, arrive as base64 data URLs rather than multipart, are
capped at 8MB, and written to a random filename with `upsert: false` so an
upload can't overwrite an existing object.

**The gap was SVG.** The regex `^data:(image\/[a-zA-Z+]+);base64,(.+)$` admitted
`image/svg+xml`, and the file was stored with that content type in a **public**
bucket. An SVG served from the Supabase storage domain can execute script — a
stored XSS on the storage origin, reachable by an authenticated admin.
`contentType` was also taken verbatim from the data URL and passed straight to
Supabase Storage, with the file extension derived from it.

`2968663` replaces both copies of the inline parse with a shared
`parseImageDataUrl()` in `admin/mint.js` that resolves content type *and*
extension from a fixed allowlist (`image/png`, `image/jpeg`, `image/webp`,
`image/gif`) rather than from user input. The MIME string is lowercased before
lookup, so `IMAGE/SVG+XML` doesn't slip past. Verified against png, jpeg,
`image/svg+xml`, `IMAGE/SVG+XML`, `text/html` and malformed input.

## 17. Trim API responses — FIXED (this was a real leak, not just structural)

`verify.js:68-78` is the model: it selects `*` internally but returns an
explicit field subset and deliberately withholds the owner's Privy DID.
`get_notifications` and `get_artifacts` likewise select only the columns they
need. *(An earlier draft of this audit listed `get_artifacts` as a `select('*')`
gap — that was wrong; it has always used an explicit column list.)*

`get_transactions` was the real one, and the exposure is concrete rather than
hypothetical. It returned `select('*')` from `transactions`, and
`log-social-scan.js:133` writes visitor IP hashes into that table:

```js
metadata: { stamina_remaining: newStored, ip_hash: ipHash },
```

So a referral-link owner fetching their own transaction history received a
SHA-256 `ip_hash` for **every visitor who scanned their link**. Those hashes are
unsalted over a 32-bit IPv4 space, which is exhaustible in seconds — effectively
publishing visitor IP addresses to the link owner.

`2968663` narrows the query to `id, amount, transaction_type, created_at` — the
four fields `Profile.tsx` actually renders — which drops `metadata` and
`user_id` from the response entirely.

Two catalog reads still use `select('*')` into the client: `get_quests` and
`get_stamps`. Both return non-user catalog rows, so the risk is the structural
one (a future internal column publishing itself), not a live leak. `get_stamps`
spreads rows into its result shape (`{ ...s, earned }`), so trimming it changes
the client contract — worth doing deliberately rather than as part of this pass.

**Broader point:** consider salting `ip_hash`, or dropping it once the
`rate_limits` table covers the anti-farm role it was serving in
`log-social-scan.js`.

## 18. Add security headers — FIXED

`vercel.json` previously contained only a SPA rewrite and **no headers at all**.
`04563ad` adds:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |
| `Cache-Control` / `X-Robots-Tag` (on `/api/*`) | `no-store` / `noindex` |

The `Permissions-Policy` denials were checked against actual usage — the app
uses neither camera nor geolocation (`Scanner.tsx` is Web NFC, not
camera-based), and Stripe Checkout is a redirect rather than an embedded
payment request. Web NFC is deliberately not restricted.

**CSP added in report-only mode (`2968663`).** A policy this app can't be
tested against locally shouldn't be enforced blind — Privy uses iframes and
OAuth popups, and Stripe is a redirect — so it ships as
`Content-Security-Policy-Report-Only`, which reports violations without blocking
anything. The allowlist covers Privy, Supabase (incl. websockets), Solana RPC,
Stripe, and Google Fonts, with `frame-ancestors 'none'` and `object-src 'none'`.

**To finish:** run a full login → scan → claim → checkout pass with devtools
open, collect the CSP violation reports, widen the policy for anything
legitimate, then rename the header to `Content-Security-Policy` to enforce. Note
`script-src` currently includes `'unsafe-inline'`; tightening that needs a nonce
or hash strategy for Vite's injected inline scripts.

## 19. Force HTTPS — PASS

Vercel terminates TLS and redirects HTTP to HTTPS on all deployments. `04563ad`
adds HSTS with a two-year max-age, `includeSubDomains`, and `preload`, so
browsers won't attempt plaintext after first contact.

*Note:* `preload` is a one-way door — submitting the domain to the HSTS preload
list is difficult to reverse and applies to all subdomains. Keep the directive
only if every current and future subdomain will serve HTTPS.

## 20. Scan dependencies — RUNTIME ADVISORIES FIXED; no CI

`npm audit` reported **106 vulnerabilities (1 critical, 26 high, 56 moderate, 23
low)**. Severity alone is misleading — what matters is whether the package ships
to users:

**Runtime, ships to users.** `react-router-dom` ≤ 6.30.2 carried four
advisories, including *unexpected external redirect via untrusted paths*, *open
redirect via backslash in `<Link>`/`useNavigate`* (CVE-2025-68470 bypass), and
*protocol-relative URL reinterpretation via paths starting `//`*. This is a live
SPA with user-reachable routes (`/v/:id`, `/collect/:code`), so open redirect
was a real phishing vector.

**Build-time only.** The lone *critical* was `tar`, reached through the
toolchain and never deployed — lower urgency than its label suggests. Same for
`postcss`.

`npm audit fix` in `2968663` resolved both classes without touching
`package.json` (lockfile only): **react-router-dom 6.30.2 → 6.30.4**, **postcss
→ 8.5.26**. Totals went from 106 → 91, critical 1 → 0, high 26 → 15. `npm run
build` and `npm run typecheck` both pass on the upgraded tree.

The 15 remaining highs are `vite` and `@vercel/node` transitives requiring major
upgrades (`vite@8`, `@vercel/node@4`). Both are build/deploy-time. Schedule them
deliberately — a major Vite bump wants its own testing pass, not a security
sweep.

**CI added.** `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`,
`npm run build`, and `npm audit` on every pull request and on pushes to `main`.
`.github/dependabot.yml` opens weekly npm updates (minor/patch grouped into one
PR, majors individually) and monthly Actions updates.

The blocking audit gate is set to **critical**, not high, deliberately: the tree
carries 14 high advisories even with `--omit=dev`, almost all transitive through
the Metaplex/Irys/Solana packages behind the parked on-chain path. Gating at
`high` would fail on the first run, and a permanently red CI is one everyone
learns to ignore. A second, non-blocking step reports highs so they stay
visible. Tighten the gate to `high` once that dependency tree is cleaned up — or
once the on-chain path is either shipped or removed.

All three CI steps were run locally against this branch and pass.

---

## Appendix — deploy checklist

**Done**

- [x] `db/security_hardening.sql` applied (16 Aug 2026) and verified in the SQL
      editor: `rate_limit_hit` increments, `rate_limits_sweep` returns a count,
      test buckets cleaned up. Rate limits are live, not degraded.

**Before the next deploy**

- [ ] Confirm `AGENT_SECRET_KEY` is set in Vercel. `api/agent/transmit.js` now
      rejects **all** requests when it is missing, where it previously accepted
      `Authorization: Bearer undefined`. If the var is absent, the agent feed
      goes down — which is the correct failure, but it will be a visible one.
- [ ] Confirm `PRIVY_APP_SECRET` is available to `api/v2/purchase.js`.
      `mintAvatar` now calls Privy to resolve the caller's wallets and returns
      `503` if that lookup fails. Only affects the parked on-chain path.
- [ ] Before minting a new artifact batch, confirm `artifacts.tag_id` is `text`
      and not a narrow `varchar` — minted IDs grew from ~11 to ~22 characters.
      Verification query is at the bottom of the migration file.

**Done on deploy (2026-09-03)**

- [x] `db/rls_hardening.sql` applied, after confirming Vercel deployment
      `dpl_BPxDURUJ1R75RuVY3aypUxeTu7Ag` (commit `daf1d2d`) reached READY so the
      `get_season_progress` path was live before its policy was dropped.
- [x] Verification query returns exactly one row (`waitlist` INSERT), and the
      Supabase linter reports zero WARN-level findings.

**Standing caveat**

Existing tags in the field keep their sequential IDs and keep working — the
random suffix applies only to newly minted batches. Those legacy tags remain
guessable, so the `claim` rate limits are their only protection until they age
out or SUN-authenticated chips replace them.
