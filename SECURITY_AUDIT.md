# SECURITY AUDIT — monarch-passport-web

Audit of the 20-point checklist against the codebase, covering fixes in
`04563ad` and `2968663`.

Every finding below is grounded in a specific file and line. Nothing here was
tested against the live Supabase instance — see item 4, which is the one finding
that *requires* a live check and is the only serious item still open.

## Summary

| # | Item | Status |
|---|---|---|
| 1 | Hide API keys | PASS |
| 2 | Purge Git secrets | PASS |
| 3 | Use public DB key | PASS |
| 4 | Enable row-level security | **VERIFY — the one serious open item** |
| 5 | Encrypt sensitive data | PASS (one note on mainnet keys) |
| 6 | Enforce server-side auth | FIXED — auth bypass closed |
| 7 | Lock record access | PASS at API layer — depends on #4 |
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
| 20 | Scan dependencies | FIXED for runtime; no CI |

**What's left, in order:**

1. **#4 — verify RLS against production.** The only item that can still be
   seriously wrong, and it can't be checked from the codebase.
2. **#18 — promote CSP from report-only to enforcing** after a violation pass.
3. **#20 — add CI.** Without it, the dependency and typecheck state drifts back.
4. **#12 — bot protection**, if abuse appears in the logs.
5. **#17 — salt or drop `ip_hash`**, and trim the two catalog reads.

Separately and above all of these: **NTAG 424 SUN message authentication.** The
enumeration stopgap in `04563ad` raises the cost of guessing a tag ID but does
not authenticate a tap — the URL is still static and clonable off a chip.

Three findings in this audit were live issues rather than hardening: the agent
auth bypass (#6), visitor IP hashes published to referral-link owners (#17), and
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

## 4. Enable row-level security — VERIFY (most serious open item)

**This is the finding to act on first.**

The only RLS in the repo is `db/phase2_ascension.sql:76-86` (repeated in
`phase2_fix.sql`), covering three tables — and the policies are permissive:

```sql
ALTER TABLE seasons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_season_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rewards       ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_season_progress_read ON user_season_progress FOR SELECT USING (true);
```

`USING (true)` means **anyone holding the anon key can read every user's season
progress** — and the anon key ships in the browser bundle by design. That's a
cross-user data read, not a hypothetical.

More importantly, **no migration in `db/` enables RLS on**: `profiles`,
`artifacts`, `user_assets`, `transactions`, `products`, `monarch_times`,
`post_comments`, `waitlist`, `purchase_grants`, `collection_items`,
`quests`/`user_quests`, `stamps`/`user_stamps`.

`src/lib/supabase.ts:8-10` asserts the opposite:

```
// RLS-protected tables (profiles, user_assets, transactions) require the
// caller's Privy token; the bare anon client is blocked and returns nothing.
```

Nothing in this repository implements that. Either it was applied by hand in the
Supabase dashboard (plausible — `CLAUDE.md` notes migrations are run manually
and that the live schema has drifted), or those tables are readable and possibly
writable by anyone who opens devtools and copies the anon key.

If RLS is off on `waitlist`, every signup email is publicly dumpable. If it's off
on `profiles`, so is every user's WNGS balance and Privy DID. If it's off for
writes, WNGS balances are directly editable and the entire server-auth layer in
item 6 is bypassable.

**Run this against production before anything else:**

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       count(p.polname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;
```

Every application table should show `rls_enabled = true`. Any table with RLS on
and `policy_count = 0` is service-role-only (correct for `rate_limits`). Then
re-check the three `USING (true)` policies above — `user_season_progress` should
be scoped to the requesting user, not world-readable.

Note that RLS being off is *not* visible from application behaviour: the API
layer uses the service-role key and works identically either way. It only shows
up when someone queries PostgREST directly with the anon key.

*Encouraging sign:* the Supabase SQL editor's saved-query list includes several
named "Enable Row-Level Security for …", "Enable RLS and Index …", and "Public
Read Policy for …", which suggests RLS **was** configured by hand outside `db/`.
That makes the "applied in the dashboard" hypothesis the likely one — but it
also means the repo is not the source of truth for it. Run the query above to
confirm coverage, then commit the resulting policies to `db/` as a migration so
the next environment isn't rebuilt without them.

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

## 7. Lock record access — PASS at the API layer

Every read and write is scoped to the verified caller: `equip.js:48` checks
`user_assets` ownership before equipping, `tap-reward.js:73` rejects when
`artifact.owner_id !== userId`, `purchase.js:192` rejects minting an asset the
caller doesn't own, and `verify.js:55-64` deliberately avoids leaking the
owner's Privy DID to anonymous callers — it returns a boolean `isOwner`
computed against an optional bearer token instead.

**This item is only as strong as item 4.** All of it runs in serverless handlers
using the service-role key. If RLS is off, a client can skip these handlers
entirely and query PostgREST directly with the anon key.

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

**Still open — there is no CI.** No `.github/` directory exists, so nothing runs
`tsc` or `npm audit` on push, and this will drift again. Recommended: a
Dependabot config plus a workflow running
`npm ci && npm run typecheck && npm audit --audit-level=high` on pull requests.

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

**After deploying**

- [ ] Watch function logs for `RATE_LIMIT_DEGRADED` — it means the limiter is
      failing open and no limits are being applied.
- [ ] Run a full login → scan → claim → checkout pass with devtools open and
      collect CSP violation reports (item 18), then promote the header from
      `Content-Security-Policy-Report-Only` to enforcing.

**Standing caveat**

Existing tags in the field keep their sequential IDs and keep working — the
random suffix applies only to newly minted batches. Those legacy tags remain
guessable, so the `claim` rate limits are their only protection until they age
out or SUN-authenticated chips replace them.
