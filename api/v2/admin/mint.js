import * as dotenv from 'dotenv';
// In Vercel serverless, __dirname isn't always reliable, so we check if we are not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { verifyPrivyToken } from '../_auth.js';

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
// Fallback mirrors CommandCenter's client-side default so the server and client
// agree on who's an admin even when VITE_ADMIN_PRIVY_ID isn't present at
// function runtime. This is an allowlist, not a secret (security comes from the
// verified Privy token below). Set VITE_ADMIN_PRIVY_ID in Vercel to override.
const ADMIN_PRIVY_IDS = (process.env.VITE_ADMIN_PRIVY_ID || 'did:privy:cmphogmw500340ckz646kklaw,did:privy:cmjufzcf403jjl70dpyp1mood')
  .split(',')
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean)
  // Bare Privy IDs ("cmpho...") also match as their did:privy: form, so the
  // env var works with or without the prefix (mirrors CommandCenter's parse).
  .flatMap((id) => (id.startsWith('did:privy:') ? [id] : [id, `did:privy:${id}`]));

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
  if (!accessToken || !claimedAdminId) {
    return false;
  }
  if (!ADMIN_PRIVY_IDS.includes(String(claimedAdminId).toLowerCase())) {
    return false;
  }

  // Verify the Privy token and that it belongs to the claimed admin.
  const verifiedUserId = await verifyPrivyToken(accessToken);
  return !!verifiedUserId && verifiedUserId === claimedAdminId;
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

  const category = kind === 'theme' ? 'THEME' : 'AVATAR';

  // Duplicate guard: a re-submitted (or forgotten earlier) forge would silently
  // create a second identical store listing. Case-insensitive match; % _ \ are
  // escaped because ilike treats them as pattern wildcards.
  const likePattern = name.replace(/([%_\\])/g, '\\$1');
  const { data: existing, error: dupError } = await supabase
    .from('products')
    .select('id')
    .eq('category', category)
    .ilike('name', likePattern)
    .maybeSingle();
  if (dupError) throw dupError;
  if (existing) {
    return res.status(409).json({
      error: `DUPLICATE_NAME // A ${category} NAMED "${name.toUpperCase()}" ALREADY EXISTS`,
      existingId: existing.id,
    });
  }

  const row = {
    name,
    category,
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

// Retire/restore a store product (admin only). Toggles products.is_active so
// pulling an item from the Shop never requires a manual DB edit. Folded here
// to stay under the function cap. Dispatched by kind: 'product_status'.
async function setProductStatus(body, supabase, res) {
  const { productId, isActive } = body;
  if (!productId || typeof productId !== 'string' || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'productId (string) and isActive (boolean) are required' });
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });

  return res.status(200).json({ success: true, product: data });
}

// Store inventory (admin only): every forged cosmetic ever, live or retired,
// with how many users own each -- the data needed to decide a re-release.
// Folded here to stay under the function cap. Dispatched by kind:
// 'product_inventory'.
async function productInventory(supabase, res) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category, rarity, price_wngs, is_active, palette, accent_color, theme_mode, collection, season, edition, created_at')
    .in('category', ['AVATAR', 'THEME'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Owner counts come from user_assets, which RLS hides from the browser. Two
  // plain queries + a JS merge avoids depending on a FK/embed relationship
  // being registered in the live schema.
  const { data: assets, error: assetsError } = await supabase
    .from('user_assets')
    .select('product_id');
  if (assetsError) throw assetsError;

  const owners = {};
  for (const a of assets || []) {
    if (a.product_id) owners[a.product_id] = (owners[a.product_id] || 0) + 1;
  }

  return res.status(200).json({
    success: true,
    products: (products || []).map((p) => ({ ...p, owners: owners[p.id] || 0 })),
  });
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

// Claim-link creation (admin only). Folded here from its own serverless
// function to stay under Vercel's function cap -- shares the same admin auth.
// Dispatched by kind: 'claim_link'.
async function createClaimLink(body, supabase, res) {
  const { shortCode, wngsAward, itemName, itemType, maxRedemptions } = body;

  if (
    !shortCode ||
    typeof shortCode !== 'string' ||
    !itemName ||
    !itemType ||
    !Number.isInteger(wngsAward) ||
    wngsAward <= 0
  ) {
    return res.status(400).json({ error: 'Missing or invalid parameters' });
  }

  // Optional global usage cap. Omitted/blank => unlimited (existing behaviour).
  let cap = null;
  if (maxRedemptions !== undefined && maxRedemptions !== null && maxRedemptions !== '') {
    cap = Number(maxRedemptions);
    if (!Number.isInteger(cap) || cap <= 0) {
      return res.status(400).json({ error: 'maxRedemptions must be a positive integer' });
    }
  }

  const safeShortCode = shortCode.trim().toLowerCase();

  // Only set max_redemptions when provided, so this insert still works on
  // databases where that column hasn't been added yet.
  const row = {
    short_code: safeShortCode,
    wngs_award: wngsAward,
    item_name: itemName,
    item_type: itemType,
  };
  if (cap != null) row.max_redemptions = cap;

  const { error } = await supabase
    .from('claim_links')
    .insert(row);

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'CLAIM_LINK_ALREADY_EXISTS' });
    }
    throw error;
  }

  return res.status(200).json({ success: true });
}

// Publish a post to the MONARCH_TIMES feed (admin only). Folded here to stay
// under the function cap. Dispatched by kind: 'feed_post'.
//
// Image can be provided two ways: `imageUrl` (an already-hosted URL) or
// `imageData` (a base64 data URL from the admin's file picker), which we upload
// to the public feed-images bucket and turn into a URL. The picker downscales
// client-side, so payloads stay small.
async function createFeedPost(body, supabase, res) {
  const { title, content, imageUrl, imageData, author } = body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  let finalImageUrl = imageUrl || null;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(imageData);
    if (!match) return res.status(400).json({ error: 'Invalid imageData' });
    const contentType = match[1];
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large (max 8MB)' });
    }
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('feed-images')
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) throw upErr;
    finalImageUrl = supabase.storage.from('feed-images').getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await supabase
    .from('monarch_times')
    .insert({
      title,
      content,
      image_url: finalImageUrl,
      author: author || 'PAPILLON',
      status: 'PUBLISHED',
    })
    .select()
    .single();
  if (error) throw error;
  return res.status(200).json({ success: true, post: data });
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
    if (body.kind === 'product_status') {
      return await setProductStatus(body, supabase, res);
    }
    if (body.kind === 'product_inventory') {
      return await productInventory(supabase, res);
    }
    if (typeof body.kind === 'string' && body.kind.startsWith('season_')) {
      return await seasonOp(body, supabase, res);
    }
    if (body.kind === 'claim_link') {
      return await createClaimLink(body, supabase, res);
    }
    if (body.kind === 'feed_post') {
      return await createFeedPost(body, supabase, res);
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
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
