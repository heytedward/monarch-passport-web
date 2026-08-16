# SECURITY AUDIT — monarch-passport-web

Audit of the 20-point checklist against the codebase as of commit `04563ad`.

Every finding below is grounded in a specific file and line. Items marked
**FIXED** were addressed in `04563ad`; items marked **GAP** or **VERIFY** are
open. Nothing here was tested against the live Supabase instance — see item 4,
which is the one finding that *requires* a live check and is also the most
serious.

## Summary

| # | Item | Status |
|---|---|---|
| 1 | Hide API keys | PASS |
| 2 | Purge Git secrets | PASS |
| 3 | Use public DB key | PASS |
| 4 | Enable row-level security | **VERIFY — most serious open item** |
| 5 | Encrypt sensitive data | PASS (one note on mainnet keys) |
| 6 | Enforce server-side auth | FIXED (one bypass closed) |
| 7 | Lock record access | PASS at API layer — depends on #4 |
| 8 | Block field tampering | PASS (one residual) |
| 9 | Secure session cookies | N/A — Privy-managed |
| 10 | Hash passwords | N/A — no passwords exist |
| 11 | Rate limit login | PARTIAL — login is Privy's; app endpoints now limited |
| 12 | Add bot protection | PARTIAL |
| 13 | Parameterize queries | PASS |
| 14 | Validate all input | PARTIAL |
| 15 | Escape user content | PASS |
| 16 | Restrict file uploads | PARTIAL — SVG gap |
| 17 | Trim API responses | PARTIAL |
| 18 | Add security headers | FIXED |
| 19 | Force HTTPS | PASS |
| 20 | Scan dependencies | GAP |

**Priority order for what's left:** #4 (verify RLS) → #20 (`npm audit fix` for
the runtime router advisories) → #16 (SVG upload) → #14/#8 (`mintAvatar`
recipient) → #18 (CSP) → #12 (bot protection).

Separately and above all of these: NTAG 424 SUN message authentication. The
enumeration stopgap in `04563ad` raises the cost of guessing a tag ID but does
not authenticate a tap — the URL is still static and clonable off a chip.

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

## 8. Block field tampering — PASS, one residual

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

**Residual:** `mintAvatar` (`purchase.js:182`) takes `recipient` from the
request body and validates only that it parses as a public key. A user can mint
their own owned asset to *any* wallet. On the parked devnet path that's
harmless; before the mint button ships, `recipient` should be the caller's own
bound wallet address, not a client-supplied value.

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

**Remaining gap:** `api/v2/purchase.js` is the busiest endpoint (20+ dispatched
actions including every WNGS spend) and has no limiter. Worth adding a per-user
cap on the spend actions.

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

## 14. Validate all input — PARTIAL

Present and correct: email format (`waitlist.js:28-31`), server-side bundle
lookup rather than client price (`checkout/wngs.js`), comment length cap
(`purchase.js:682`), rarity allowlist (`admin/mint.js:104`), 8MB image cap
(`admin/mint.js:179`), and — new in `04563ad` — integer coercion and a 500-row
cap on artifact batches.

Gaps:

- `mintAvatar` `recipient` — see item 8.
- `imageUrl` in `createFeedPost` (`admin/mint.js:514`) and `image_url` in
  `transmit.js` are accepted as arbitrary strings and stored unvalidated. They
  render as `<img src>`, so this is an external-content load rather than script
  execution, but a URL allowlist would be cheap.
- No length caps on feed `title`/`raw_content` in `transmit.js` — an agent with
  the bearer token can write unbounded rows.

## 15. Escape user content — PASS

Zero occurrences of `dangerouslySetInnerHTML` or `innerHTML` in `src/`. React
escapes interpolated content by default, so stored user text (comments, feed
posts) renders inert. `transmit.js` reformats content (uppercases the title,
prefixes `[ ARCHIVAL_LOG ]`) but stores it as plain text.

The only residual is user-supplied image URLs (item 14) — an external resource
load, not script execution. `X-Content-Type-Options: nosniff` from `04563ad`
further reduces the chance of a served asset being reinterpreted as script.

## 16. Restrict file uploads — PARTIAL

Uploads are admin-only, arrive as base64 data URLs rather than multipart, are
regex-gated to an `image/*` MIME type, capped at 8MB, and written to a random
filename with `upsert: false` so an upload can't overwrite an existing object
(`admin/mint.js:173-184`, `508-531`).

**Gap:** the regex `^data:(image\/[a-zA-Z+]+);base64,(.+)$` admits
`image/svg+xml`, and the file is stored with that content type in a **public**
bucket. An SVG served from the Supabase storage domain can execute script — a
stored XSS, though on the storage origin rather than the app origin, and
reachable only by an authenticated admin. Fix is a one-line allowlist:

```js
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
if (!ALLOWED.includes(contentType)) throw new Error('Unsupported image type');
```

Also note `contentType` is taken verbatim from the user-supplied data URL and
passed to Supabase Storage, and `ext` is derived from it — the allowlist closes
both.

## 17. Trim API responses — PARTIAL

`verify.js:68-78` is the model to copy: it selects `*` internally but returns an
explicit field subset and deliberately withholds the owner's Privy DID.
`get_notifications` (`purchase.js:437`) likewise selects only the four columns
it needs.

Gaps — these return `select('*')` straight to the client:

- `get_transactions` (`purchase.js:426`)
- `get_artifacts` (`purchase.js:416`)

Both are scoped to the authenticated caller, so nothing leaks *today*. The risk
is structural: any column added to `transactions` or `artifacts` later (an
internal note, a cost basis, a fraud flag) is published automatically with no
code change. Replace with explicit column lists.

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

**Remaining: no Content-Security-Policy.** Getting one right requires live
testing against Privy's iframes and OAuth popups plus Stripe's redirect, so it
was not shipped blind. Start with `Content-Security-Policy-Report-Only`,
watch for violations across a full login → scan → checkout run, then enforce.

## 19. Force HTTPS — PASS

Vercel terminates TLS and redirects HTTP to HTTPS on all deployments. `04563ad`
adds HSTS with a two-year max-age, `includeSubDomains`, and `preload`, so
browsers won't attempt plaintext after first contact.

*Note:* `preload` is a one-way door — submitting the domain to the HSTS preload
list is difficult to reverse and applies to all subdomains. Keep the directive
only if every current and future subdomain will serve HTTPS.

## 20. Scan dependencies — GAP

`npm audit` reports **106 vulnerabilities (1 critical, 26 high, 56 moderate, 23
low)** and there is no CI at all — no `.github/` directory, so nothing scans
dependencies or runs `tsc` on push.

Severity is misleading without context. Split by actual exposure:

**Runtime, ships to users — fix now:**

- `react-router-dom` ≤ 6.30.2 (high) — four advisories, including *unexpected
  external redirect via untrusted paths*, *open redirect via backslash in
  `<Link>`/`useNavigate`* (CVE-2025-68470 bypass), and *protocol-relative URL
  reinterpretation via paths starting `//`*. This is a live SPA with
  user-reachable routes (`/v/:id`, `/collect/:code`), so open redirect is a real
  phishing vector.

**Build-time only — lower urgency:**

- `tar` (critical) and `postcss` (high) are reached through the toolchain, not
  the deployed bundle. Real, but they don't expose your users.

`npm audit fix` resolves `react-router-dom` and `postcss` without breaking
changes and is worth running immediately. `vite@8` and `@vercel/node@4` are
major upgrades — schedule those deliberately rather than as part of a security
pass.

**Recommended:** enable Dependabot (`.github/dependabot.yml`) and add a minimal
CI workflow running `npm ci && npm run typecheck && npm audit --audit-level=high`
on pull requests. `npm run typecheck` currently passes clean.

---

## Appendix — applying `04563ad`

1. Run `db/security_hardening.sql` in the Supabase SQL editor. **Rate limits are
   not enforced until this is applied** (the limiter fails open by design).
2. Before minting a new artifact batch, confirm `artifacts.tag_id` is `text` and
   not a narrow `varchar` — minted IDs grew from ~11 to ~22 characters. The
   verification query is at the bottom of the migration file.
3. Confirm `AGENT_SECRET_KEY` is set in Vercel. `api/agent/transmit.js` now
   rejects all requests when it is missing, where it previously accepted
   `Authorization: Bearer undefined`.
4. Existing tags in the field keep their sequential IDs and keep working —
   the new suffix applies only to newly minted batches. Those legacy tags remain
   guessable, so the `claim` rate limits are their only protection until they
   age out.
