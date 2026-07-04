# MONARCH PASSPORT — OWNER'S RUNBOOK

This is the operations manual for running Monarch Passport day-to-day **without touching code or the database**. Everything routine happens in the Command Center at:

**`https://monarch-passport.vercel.app/command-center`** (log in with the admin account first)

If a page shows `ACCESS DENIED // LEVEL 5 CLEARANCE REQUIRED`, you are not logged in with the admin Privy account.

---

## 1. Routine operations (the stuff you'll actually do)

### A. New apparel drop → NFC tags

1. Command Center → **Artifact & Link Forge** → the artifact mint form.
2. Fill in: `TAG_PREFIX` (e.g. `GEN2`), `START_NUM` (e.g. `1`), `COUNT` (how many pieces), `TIER` (rarity), product name, collection, season. Tick **SEASON ARTIFACT** if claiming one should unlock the battlepass premium track.
3. Click mint → you get a list of URLs like `https://monarch-passport.vercel.app/v/GEN2001`. Copy them.
4. Encode one URL per NFC tag (NTAG 424) in the physical garments. That's it — when a customer taps, the URL opens, they log in, claim, and the artifact appears in their Closet automatically. Repeat taps pay them small WNGS rewards on a 24-hour cooldown, with no work on your end.

### B. New avatar or theme in the digital store

1. Command Center → **Digital Store Forge**.
2. **FORGE AVATAR**: type a name, click `ROLL` until you like the palette (or click any of the 9 swatches to hand-pick colors), choose rarity (price is automatic per rarity; override if you want), optionally tag collection/season/edition → **FORGE AVATAR**.
3. **FORGE THEME**: name, light/dark, accent color, rarity → **FORGE THEME**.
4. The item is **live in the Shop immediately** — no deploy, no database work. Users buy it with WNGS and equip it in their Closet.
5. Forging a second item with a name that already exists is blocked (`DUPLICATE_NAME` error) — rename it or retire the old one first.

### C. Pull an item from the store (or bring it back)

Command Center → **Digital Store Forge** → **FORGED_PRODUCTS** list at the bottom:
- **RETIRE** hides the item from the Shop instantly (people who already own it keep it).
- **RESTORE** puts it back.

### D. Give out WNGS (promos, refunds, make-goods)

1. Command Center → claim-link generator: enter an ID (becomes the link code), WNGS value, item type, and optionally **MAX_REDEMPTIONS** (cap how many people can use it).
2. Share the generated `https://monarch-passport.vercel.app/claim/<code>` link (or make a QR of it). Each user can redeem a given link once.

### E. Post to the MONARCH_TIMES feed

Command Center → **MONARCH_TIMES Broadcast**: title, content, optional image (picked images are resized automatically). Posts appear on users' Home feed immediately.

### F. Refund a WNGS bundle purchase (Stripe)

1. Stripe Dashboard → Payments → find the charge → **Refund**.
2. Refunding does **not** claw back the WNGS automatically. If needed, subtract it in Supabase → Table Editor → `profiles` → find the user → lower `wngs_balance`. (This is the one flow that may touch the DB, and only for refunds.)

### G. Seasons (battlepass) — rare, every ~90 days

Command Center → **ASCENSION Season Control**: create the new season, add its rewards per level/track, then **ACTIVATE** it (activation automatically deactivates the old one). Season 01 "GENESIS PROTOCOL" runs until 2026-09-24 — nothing to do until then.

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
| 9 | Digital Store Forge → forge avatar `TEST_AVATAR_01` (COMMON) | "AVATAR_DEPLOYED" + it appears in **FORGED_PRODUCTS** |
| 10 | Forge avatar named `TEST_AVATAR_01` again | Blocked with `DUPLICATE_NAME` error |
| 11 | Open **Shop** | `TEST_AVATAR_01` is listed at 500 WNGS |
| 12 | Buy it | Balance drops 500; item shows as owned |
| 13 | **Closet** → equip it | Your avatar everywhere (navbar, profile) renders with the forged palette |
| 14 | Forge theme `TEST_THEME_01`, buy, equip | App accent color changes app-wide |
| 15 | FORGED_PRODUCTS → **RETIRE** `TEST_AVATAR_01` | It disappears from the Shop |
| 16 | **RESTORE** it | It reappears in the Shop |
| 17 | Profile → QUESTS / STAMPS tabs | First-tap quest/stamp progress recorded from step 3 |

**Cleanup**: retire `TEST_AVATAR_01` and `TEST_THEME_01` via FORGED_PRODUCTS. To fully delete test rows, run this in Supabase → SQL Editor:

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
