// Shared stamp-awarding helper. Underscore prefix => Vercel does NOT treat
// this as a serverless function. Imported by claim.js, tap-reward.js,
// _ascension.js, and _quests.js.
//
// ─── REQUIRED SUPABASE TABLES ────────────────────────────────────────────────
//
// create table stamps (
//   id           uuid primary key default gen_random_uuid(),
//   name         text not null,
//   description  text,
//   season_id    uuid references seasons(id),   -- null = cross-season
//   trigger_type text not null,
//     -- FIRST_TAP              first artifact claim
//     -- WNGS_MILESTONE         balance crosses trigger_value
//     -- ASCENSION_LEVEL        user reaches trigger_value level
//     -- ALL_QUESTS             all active season quests completed
//     -- FULL_SEASON_COLLECTION user owns all season artifacts
//   trigger_value int,     -- threshold for WNGS_MILESTONE / ASCENSION_LEVEL
//   is_hidden     boolean default false,  -- hide from UI until earned
//   image_url     text,
//   sort_order    int default 0,
//   created_at    timestamptz default now()
// );
//
// create table user_stamps (
//   id         uuid primary key default gen_random_uuid(),
//   user_id    text not null,
//   stamp_id   uuid not null references stamps(id),
//   earned_at  timestamptz default now(),
//   unique (user_id, stamp_id)
// );
//
// ─────────────────────────────────────────────────────────────────────────────

// Season codes drift in the data ("1" vs "01", case/whitespace). Match leniently:
// normalizeSeasonCode canonicalises a code (numeric codes drop leading zeros);
// seasonMatchValues expands a code into the stored variants to query with `.in`.
export function normalizeSeasonCode(code) {
  if (code == null) return '';
  const c = String(code).trim().toUpperCase();
  return /^\d+$/.test(c) ? String(parseInt(c, 10)) : c;
}

export function seasonMatchValues(code) {
  const c = String(code ?? '').trim();
  const norm = normalizeSeasonCode(c);
  const set = new Set([c, c.toUpperCase(), c.toLowerCase(), norm]);
  if (/^\d+$/.test(norm)) set.add(norm.padStart(2, '0'));
  return [...set].filter(Boolean);
}

/**
 * Check whether the user owns the complete season collection:
 * the single NFC artifact + all collection_items for the season.
 * Returns true if complete (and total > 0), false otherwise.
 *
 * @param {object} admin        Service-role Supabase client
 * @param {string} userId       Privy user ID
 * @param {string} seasonId     UUID of the season (from collection_items.season_id or seasons.id)
 */
export async function isFullCollectionComplete(admin, userId, seasonId) {
  if (!seasonId) return false;

  // Get the season row to resolve the season code used in artifacts.
  // NB: the live seasons table uses `title` (not `name`) and a TEXT id.
  const { data: season } = await admin
    .from('seasons')
    .select('id, code, title')
    .eq('id', seasonId)
    .maybeSingle();
  if (!season) return false;

  const seasonCode = season.code || season.title;

  // NFC artifact check.
  const seasonVals = seasonMatchValues(seasonCode);
  const [{ count: totalNfc }, { count: ownedNfc }] = await Promise.all([
    admin.from('artifacts').select('*', { count: 'exact', head: true })
      .eq('is_season_artifact', true).in('season', seasonVals),
    admin.from('artifacts').select('*', { count: 'exact', head: true })
      .eq('is_season_artifact', true).in('season', seasonVals).eq('owner_id', userId),
  ]);

  // Collection items check.
  const { data: seasonItems } = await admin
    .from('collection_items')
    .select('id')
    .eq('season_id', seasonId);
  const itemIds = (seasonItems || []).map((i) => i.id);

  let claimedItems = 0;
  if (itemIds.length > 0) {
    const { count } = await admin
      .from('user_collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('item_id', itemIds);
    claimedItems = count || 0;
  }

  const totalAll = (totalNfc || 0) + itemIds.length;
  const ownedAll = (ownedNfc || 0) + claimedItems;
  return totalAll > 0 && ownedAll >= totalAll;
}

/**
 * Check whether any stamps should be awarded for a given trigger and award
 * them. Safe to call best-effort inside a try/catch — never throws.
 *
 * @param {object} admin         Service-role Supabase client
 * @param {string} userId        Privy user ID
 * @param {string} triggerType   One of the trigger_type values above
 * @param {number|null} value    Current balance / level for threshold triggers
 * @returns {Promise<Array>}     Stamps newly awarded this call
 */
export async function checkAndAwardStamps(admin, userId, triggerType, value = null) {
  try {
    let query = admin
      .from('stamps')
      .select('id, name, trigger_type, trigger_value, season_id')
      .eq('trigger_type', triggerType);

    // For value-gated stamps only award those whose threshold has been crossed.
    if (
      value !== null &&
      (triggerType === 'WNGS_MILESTONE' || triggerType === 'ASCENSION_LEVEL')
    ) {
      query = query.lte('trigger_value', value);
    }

    const { data: stamps, error: stampErr } = await query;
    if (stampErr || !stamps || stamps.length === 0) return [];

    // Skip stamps the user already holds.
    const stampIds = stamps.map((s) => s.id);
    const { data: existing } = await admin
      .from('user_stamps')
      .select('stamp_id')
      .eq('user_id', userId)
      .in('stamp_id', stampIds);

    const alreadyOwned = new Set((existing || []).map((r) => r.stamp_id));
    const toAward = stamps.filter((s) => !alreadyOwned.has(s.id));
    if (toAward.length === 0) return [];

    const { error: insertErr } = await admin
      .from('user_stamps')
      .insert(toAward.map((s) => ({ user_id: userId, stamp_id: s.id })));

    if (insertErr) {
      console.error('STAMP_AWARD_ERROR:', insertErr);
      return [];
    }

    console.log(`STAMPS_AWARDED: user=${userId} trigger=${triggerType} count=${toAward.length}`);
    return toAward;
  } catch (err) {
    console.error('STAMP_AWARD_ERROR:', err);
    return [];
  }
}
