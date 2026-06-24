import * as dotenv from 'dotenv';
// In Vercel serverless, __dirname isn't always reliable, so we check if we are not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Auto-pricing by rarity (WNGS) for the Digital Store Forge. Source of truth --
// mirror of src/lib/destijlPalette.ts RARITY_PRICES. Keep the two in sync.
const RARITY_PRICES = {
  COMMON: 500,
  RARE: 1500,
  EPIC: 3500,
  MONARCH: 7500,
  MYTHIC: 15000,
};

// Admins allowed to call this from the browser (e.g. CommandCenter) via a
// Privy session token, so the static ADMIN_PASSPHRASE never has to be
// shipped to client code. Same source CommandCenter's own allowlist reads.
const ADMIN_PRIVY_IDS = (process.env.VITE_ADMIN_PRIVY_ID || '')
  .split(',')
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean);

// `claimedAdminId` is whatever the client says its own Privy ID is (it
// already has this from usePrivy()). We don't trust the claim by itself --
// we only trust it once a query scoped to the caller's own forwarded
// session token actually returns that profile row, the same RLS-backed
// pattern used by api/v2/claim.js and api/v2/redeem-claim.js.
async function isAuthorizedAdmin(req, claimedAdminId) {
  const passphrase = req.headers['x-admin-passphrase'];
  if (passphrase && passphrase === process.env.ADMIN_PASSPHRASE) {
    return true;
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken || !claimedAdminId || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }
  if (!ADMIN_PRIVY_IDS.includes(String(claimedAdminId).toLowerCase())) {
    return false;
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: ownProfile, error } = await userClient
    .from('profiles')
    .select('id')
    .eq('id', claimedAdminId)
    .single();

  return !error && !!ownProfile;
}

// Digital Store Forge: create a theme or avatar-skin product row. Lives here
// (rather than its own serverless function) to stay under Vercel's function
// cap -- both are admin "forge" operations sharing the auth helper above.
async function createCosmetic(body, supabase, res) {
  const {
    kind, name, rarity, priceWngsOverride,
    themeMode, accentColor, palette,
    collection, season, edition, availableFrom, availableUntil,
  } = body;

  if (!name || !rarity) {
    return res.status(400).json({ error: 'name and rarity are required' });
  }
  if (!RARITY_PRICES[rarity]) {
    return res.status(400).json({ error: `Unknown rarity: ${rarity}` });
  }
  if (kind === 'theme' && (!accentColor || (themeMode !== 'light' && themeMode !== 'dark'))) {
    return res.status(400).json({ error: 'theme requires accentColor and themeMode (light|dark)' });
  }
  if (kind === 'avatar' && (!Array.isArray(palette) || palette.length !== 9)) {
    return res.status(400).json({ error: 'avatar requires a palette of exactly 9 colors' });
  }

  // Price is rarity-driven by default; an explicit override wins.
  const price_wngs =
    priceWngsOverride !== undefined && priceWngsOverride !== null && priceWngsOverride !== ''
      ? Number(priceWngsOverride)
      : RARITY_PRICES[rarity];

  if (!Number.isFinite(price_wngs) || price_wngs < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  const row = {
    name,
    category: kind === 'theme' ? 'THEME' : 'AVATAR',
    rarity,
    price_wngs,
    price_usd: 0,
    is_active: true,
    accent_color: kind === 'theme' ? accentColor : null,
    theme_mode: kind === 'theme' ? themeMode : null,
    palette: kind === 'avatar' ? palette : null,
    collection: collection || null,
    season: season || null,
    edition: edition || null,
    available_from: availableFrom || null,
    available_until: availableUntil || null,
  };

  const { data, error } = await supabase.from('products').insert(row).select().single();
  if (error) throw error;

  return res.status(200).json({ success: true, product: data });
}

// ASCENSION season lifecycle + reward-table editing (admin only). Folded here
// to stay under the function cap. Dispatched by kind: season_create /
// season_activate / season_end / season_reward.
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function seasonOp(body, supabase, res) {
  const { kind } = body;

  if (kind === 'season_create') {
    const { name, code, startsAt, endsAt, levelCount, xpPerLevel } = body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const starts = startsAt ? new Date(startsAt) : new Date();
    const ends = endsAt ? new Date(endsAt) : new Date(starts.getTime() + NINETY_DAYS_MS);
    // Live `seasons` uses a TEXT id (no default) + title/start_date/end_date.
    const { data, error } = await supabase
      .from('seasons')
      .insert({
        id: randomUUID(),
        title: name,
        code: code || null,
        start_date: starts.toISOString(),
        end_date: ends.toISOString(),
        is_active: false,
        level_count: levelCount ? Number(levelCount) : 30,
        xp_per_level: xpPerLevel ? Number(xpPerLevel) : 100,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ success: true, season: data });
  }

  if (kind === 'season_activate') {
    if (!body.seasonId) return res.status(400).json({ error: 'seasonId is required' });
    // Exactly one active season: deactivate all, then activate this one.
    const { error: deErr } = await supabase.from('seasons').update({ is_active: false }).neq('id', body.seasonId);
    if (deErr) throw deErr;
    const { data, error } = await supabase
      .from('seasons')
      .update({ is_active: true })
      .eq('id', body.seasonId)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ success: true, season: data });
  }

  if (kind === 'season_end') {
    if (!body.seasonId) return res.status(400).json({ error: 'seasonId is required' });
    const { data, error } = await supabase
      .from('seasons')
      .update({ is_active: false, end_date: new Date().toISOString() })
      .eq('id', body.seasonId)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ success: true, season: data });
  }

  if (kind === 'season_reward') {
    const { seasonId, level, track, rewardType, productId, wngsAmount, label } = body;
    if (!seasonId || level === undefined || !track || !rewardType) {
      return res.status(400).json({ error: 'seasonId, level, track and rewardType are required' });
    }
    if (track !== 'free' && track !== 'premium') {
      return res.status(400).json({ error: "track must be 'free' or 'premium'" });
    }
    if (!['avatar', 'theme', 'wngs', 'physical'].includes(rewardType)) {
      return res.status(400).json({ error: 'invalid rewardType' });
    }
    const { data, error } = await supabase
      .from('season_rewards')
      .insert({
        season_id: seasonId,
        level: Number(level),
        track,
        reward_type: rewardType,
        product_id: productId || null,
        wngs_amount: wngsAmount !== undefined && wngsAmount !== '' ? Number(wngsAmount) : null,
        label: label || null,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ success: true, reward: data });
  }

  return res.status(400).json({ error: `Unknown season op: ${kind}` });
}

export default async function handler(req, res) {
  // 1. Guard against wrong methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};

    // 2. Auth Check (static passphrase for scripts/automation, or a Privy
    // session token belonging to an admin in VITE_ADMIN_PRIVY_ID)
    if (!(await isAuthorizedAdmin(req, body.adminId))) {
      return res.status(401).json({ error: 'Unauthorized // Invalid Credentials' });
    }

    // 3. Shared service-role client (bypasses RLS)
    if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase Environment Variables');
    }
    const supabase = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 4. Dispatch: cosmetic product creation, ASCENSION season ops, or mint
    if (body.kind === 'theme' || body.kind === 'avatar') {
      return await createCosmetic(body, supabase, res);
    }
    if (typeof body.kind === 'string' && body.kind.startsWith('season_')) {
      return await seasonOp(body, supabase, res);
    }

    // ---- Artifact batch mint ----
    let { prefix, startNum, count, tier, product, collection, season, isSeasonArtifact } = body;

    if (!prefix || startNum === undefined || !count || !tier) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Default product if missing
    if (!product) product = 'Hoodie';

    const records = [];
    const generatedUrls = [];
    const baseUrl = process.env.BASE_URL || 'https://monarch-passport.vercel.app';

    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      const tagId = `${prefix}${num.toString().padStart(3, '0')}`;

      records.push({
        tag_id: tagId,
        tier: tier,
        is_activated: false,
        name: product,
        collection: collection || null,
        season: season || null,
        is_season_artifact: !!isSeasonArtifact
      });

      generatedUrls.push(`${baseUrl}/v/${tagId}`);
    }

    const { error } = await supabase
      .from('artifacts')
      .insert(records);

    if (error) throw error;

    // SUCCESS: Return the generated URLs
    return res.status(200).json({ success: true, urls: generatedUrls });

  } catch (error) {
    // CATCH ALL: Never let the function hang
    console.error("MINT_API_ERROR:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
