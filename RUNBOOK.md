# MONARCH PASSPORT — OWNER'S RUNBOOK

This is the operations manual for running Monarch Passport day-to-day **without touching code or the database**. Everything routine happens in the Command Center at:

**`https://passport.papillonbrand.us/command-center`** (log in with the admin account first)

If a page shows `ACCESS DENIED // LEVEL 5 CLEARANCE REQUIRED`, you are not logged in with the admin Privy account.

---

## 1. Routine operations (the stuff you'll actually do)

### A. New apparel drop → NFC tags

1. Command Center → **Artifact & Link Forge** → the artifact mint form.
2. Fill in: `TAG_PREFIX` (e.g. `GEN2`), `START_NUM` (e.g. `1`), `COUNT` (how many pieces), `TIER` (rarity), product name, collection, season. Tick **SEASON ARTIFACT** if claiming one should unlock the battlepass premium track.
3. Click mint → you get a list of URLs like `https://passport.papillonbrand.us/v/GEN2001`. Copy them.
   - If the URLs come back on `monarch-passport.vercel.app` instead of your domain, set the `BASE_URL` environment variable to `https://passport.papillonbrand.us` in Vercel → Settings → Environment Variables and redeploy. (Both domains work — this is just branding on the tag URLs.)
4. Encode one URL per NFC tag (NTAG 424) in the physical garments. That's it — when a customer taps, the URL opens, they log in, claim, and the artifact appears in their Closet automatically. Repeat taps pay them small WNGS rewards on a 24-hour cooldown, with no work on your end.

### B2. New physical garment on the storefront (papillonbrand.us)

The storefront catalog is fully in-house now — **no Shopify, no subscription**. Command Center → **Digital Store Forge** → **FORGE PHYSICAL PRODUCT**:

1. Pick up to 6 photos (first one is the cover — photos are resized automatically).
2. Name, price in USD, category (HOODIE/TEE/CAP/SWEATS/ACCESSORY), description, optional collection/season.
3. Set stock per size (S/M/L/XL by default; add more with `+ SIZE`).
4. **FORGE PRODUCT** → it's live on papillonbrand.us/shop immediately. Buyers pick a size; checkout is Stripe; stock decrements per size automatically on purchase; the buyer's Passport Closet gets the item on their next login.
5. Restock or correct counts anytime via **RESTOCK** on the product's STORE_INVENTORY row (enter `S:10, M:5` style pairs). RETIRE hides it from the storefront.

One-time setup: run `db/physical_store.sql` in Supabase → SQL Editor.

### B. New avatar or theme in the digital store

1. Command Center → **Digital Store Forge**.
2. **FORGE AVATAR**: type a name, click `ROLL` until you like the palette (or click any of the 9 swatches to hand-pick colors), choose rarity (price is automatic per rarity; override if you want), optionally tag collection/season/edition → **FORGE AVATAR**.
3. **FORGE THEME**: name, light/dark, accent color, rarity → **FORGE THEME**.
4. The item is **live in the Shop immediately** — no deploy, no database work. Users buy it with WNGS and equip it in their Closet.
5. Forging a second item with a name that already exists is blocked (`DUPLICATE_NAME` error) — rename it or retire the old one first.

### C. Store inventory — retire, re-release, and drop planning

Command Center → **Digital Store Forge** → **STORE_INVENTORY** at the bottom. This is the permanent catalog of **every avatar and theme ever forged**, live or retired — nothing is ever lost:

- Filter tabs: **ALL / LIVE / RETIRED** (with counts).
- Each row shows rarity, price, **OWNERS** (how many users hold it — useful for judging scarcity before a re-release), season/collection/edition tags, and the forge date.
- **RETIRE** hides the item from the Shop instantly (people who already own it keep it).
- **RESTORE** re-releases a retired item exactly as it was — same palette, price, and rarity. That's the whole re-release flow: find it under RETIRED, click RESTORE.

### D. Give out WNGS (promos, refunds, make-goods)

1. Command Center → claim-link generator: enter an ID (becomes the link code), WNGS value, item type, and optionally **MAX_REDEMPTIONS** (cap how many people can use it).
2. Share the generated `https://passport.papillonbrand.us/claim/<code>` link (or make a QR of it). Each user can redeem a given link once.

### E. Post to (and clean up) the MONARCH_TIMES feed

Command Center → **MONARCH_TIMES Broadcast**: title, content, optional image (picked images are resized automatically). Posts appear on users' Home feed immediately.

Below the posting form, **FEED_LOG** lists the latest 25 posts — **DELETE** removes a post from every user's feed (with a confirm prompt), including its comments and uploaded image. No database work needed.

### F. Refund a WNGS bundle purchase (Stripe)

1. Stripe Dashboard → Payments → find the charge → **Refund**.
2. Refunding does **not** claw back the WNGS automatically. If needed, subtract it in Supabase → Table Editor → `profiles` → find the user → lower `wngs_balance`. (This is the one flow that may touch the DB, and only for refunds.)

### G. Seasons (battlepass) — rare, every ~90 days

Command Center → **ASCENSION Season Control**: create the new season, add its rewards per level/track, then **ACTIVATE** it (activation automatically deactivates the old one). Season 01 "GENESIS PROTOCOL" runs until 2026-09-24 — nothing to do until then.

### H. Storefront purchases → customer Closets (automatic)

When someone buys on **papillonbrand.us**, the Stripe webhook records each purchased item against the **email they used at checkout** (table: `purchase_grants`). The next time a Passport account with that same email logs in, the item is minted into their Closet vault automatically, they're credited the purchase's **WNGS reward (10 WNGS per $1** — the rate shown in the storefront cart), and they see an "ORDER_SYNCED" notice. No action needed from you per order.

- **One-time setup**: run `db/purchase_grants.sql` in Supabase → SQL Editor (creates the queue table). Until this is run, the webhook logs an error and skips the grant — orders still work.
- **Caveat**: customers who log into the Passport **only with a wallet** (no email/Google/Apple linked) can't be matched — their items wait as `PENDING` rows in Supabase → `purchase_grants`. Same if they used a different email at checkout than on their Passport account. To resolve one manually: edit the row's `email` to match the customer's Passport email, and it grants on their next login.
- **Monitoring**: `select * from purchase_grants where status = 'PENDING'` shows unclaimed purchases (normal for customers who haven't opened the Passport yet).

---

## 2. Full system verification checklist (run after big changes, or whenever you want peace of mind)

Do this on the live site in a normal browser — **no NFC tag needed** (a tag is just a URL). Takes ~10 minutes. Use `TEST` prefixes so cleanup is easy.

**Setup**: log into the live site with the admin account.

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Command Center → mint 1 artifact: prefix `TEST`, start `1`, count `1`, tier COMMON | Get URL `…/v/TEST001` |
| 2 | Open `/v/TEST001` | Artifact page shows **UNCLAIMED** |
| 3 | Click claim | Success + WNGS bonus credited (balance goes up) |
| 4 | Open **Closet** | `TEST001` appears in the artifact vault with its dossier |
| 5 | Open **ASCEND** | XP ticked up from the activation |
| 6 | Re-open `/v/TEST001` and tap again | Cooldown message (24h gate working) |
| 7 | Command Center → create claim link `test-topup`, 5000 WNGS, max redemptions 1 | Link generated |
| 8 | Open `/claim/test-topup` | +5000 WNGS credited |
| 9 | Digital Store Forge → forge avatar `TEST_AVATAR_01` (COMMON) | "AVATAR_DEPLOYED" + it appears in **STORE_INVENTORY** (OWNERS:0) |
| 10 | Forge avatar named `TEST_AVATAR_01` again | Blocked with `DUPLICATE_NAME` error |
| 11 | Open **Shop** | `TEST_AVATAR_01` is listed at 500 WNGS |
| 12 | Buy it | Balance drops 500; item shows as owned (STORE_INVENTORY now shows OWNERS:1 after a refresh) |
| 13 | **Closet** → equip it | Your avatar everywhere (navbar, profile) renders with the forged palette |
| 14 | Forge theme `TEST_THEME_01`, buy, equip | App accent color changes app-wide |
| 15 | STORE_INVENTORY → **RETIRE** `TEST_AVATAR_01` | It disappears from the Shop; shows under the RETIRED filter |
| 16 | **RESTORE** it | It reappears in the Shop |
| 17 | Profile → QUESTS / STAMPS tabs | First-tap quest/stamp progress recorded from step 3 |

**Cleanup**: retire `TEST_AVATAR_01` and `TEST_THEME_01` via STORE_INVENTORY. To fully delete test rows, run this in Supabase → SQL Editor:

```sql
delete from transactions where metadata->>'tag_id' like 'TEST%';
delete from artifacts   where tag_id like 'TEST%';
delete from claim_links where short_code = 'test-topup';
-- Only delete test products nobody else bought:
delete from user_assets where product_id in (select id from products where name like 'TEST\_%' escape '\');
delete from products    where name like 'TEST\_%' escape '\';
```

**Stripe check (optional, involves a real charge)**: Shop → buy the cheapest WNGS bundle with a real card → confirm the balance credits within ~a minute (webhook) → refund the charge in the Stripe dashboard. The webhook is idempotent, so a Stripe retry can't double-credit.

---

## 3. If something looks broken

- **Server errors / claims failing**: Vercel Dashboard → project → **Logs** (each `api/…` call logs its error there).
- **Data questions** ("did user X get credited?"): Supabase → Table Editor → `transactions` (every WNGS movement is a row here — this is the audit trail), `profiles` (balances), `artifacts` (tag ownership).
- **Stripe**: webhook delivery status is under Stripe Dashboard → Developers → Webhooks.

## 4. Known gaps (harmless today, listed so they're not mysteries)

- `collection_items` table is unseeded — the `/collect/<code>` QR-collection feature has no items yet. Ignore unless you launch that feature.
- The `ALL_QUESTS` stamp trigger isn't wired — completing every quest doesn't auto-award its stamp.
- Confirm `db/claim_link_cap.sql` was applied (Supabase → SQL Editor): `select max_redemptions from claim_links limit 1;` — if the column doesn't exist, run that file's SQL once. Without it, claim-link caps aren't enforced.
- Rarity prices are defined in two places in the code (`api/v2/admin/mint.js` and `src/lib/destijlPalette.ts`) — if a developer ever changes prices, both must change.
- The 12-serverless-function limit on the Vercel Hobby plan is maxed out — new backend endpoints must be folded into existing files (developer concern only).
