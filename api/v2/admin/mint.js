import * as dotenv from 'dotenv';
// In Vercel serverless, __dirname isn't always reliable, so we check if we are not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';
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

// Upper bound on one artifact batch. Unbounded `count` let a single request
// insert arbitrarily many rows (and time the function out mid-insert).
const MAX_BATCH_MINT = 500;

// Unambiguous alphabet, no 0/O/1/I (mirrors genDiscountCode in purchase.js) —
// these end up printed on packaging and read back by humans.
const TAG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAG_SECRET_LEN = 10;

// Random suffix appended to every minted tag_id.
//
// Tag IDs used to be purely sequential (`GEN-HOOD001`, `GEN-HOOD002`, ...) and
// `api/v2/claim.js` hands ownership of any unclaimed tag to whoever asks for
// it, so the whole batch could be walked and claimed from a browser. The
// sequence is kept for admin legibility; the suffix is what makes a tag ID
// unguessable — 32^10 (~2^50) per sequence slot.
//
// This is a stopgap, NOT authentication: it stops guessing, not cloning, since
// the URL is still static and copyable off the chip. The real fix is NTAG 424
// SUN message authentication, which makes each tap cryptographically unique.
// 256 % 32 == 0, so the modulo below is unbiased.
function tagSecret() {
  const bytes = randomBytes(TAG_SECRET_LEN);
  let out = '';
  for (let i = 0; i < TAG_SECRET_LEN; i++) out += TAG_ALPHABET[bytes[i] % TAG_ALPHABET.length];
  return out;
}

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

// Physical garment categories. Anything outside the digital categories
// renders as a physical item in both storefront and passport shops.
const PHYSICAL_CATEGORIES = ['HOODIE', 'TEE', 'CAP', 'SWEATS', 'ACCESSORY', 'CLOTHING'];

// Raster formats only. The previous `image/[a-zA-Z+]+` pattern also admitted
// image/svg+xml, and these buckets are PUBLIC — an SVG is a script-execution
// vector, so uploading one gives you stored XSS on the storage origin. Content
// type and file extension both derive from this list, never from user input.
const ALLOWED_IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Parse a base64 image data URL into { contentType, ext, buffer }, rejecting
// anything outside the allowlist or over the size cap. Throws with a
// caller-safe message.
function parseImageDataUrl(dataUrl) {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Invalid image data');
  const contentType = match[1].toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) {
    throw new Error(`Unsupported image type: ${contentType} (allowed: ${Object.keys(ALLOWED_IMAGE_TYPES).join(', ')})`);
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image too large (max 8MB)');
  return { contentType, ext, buffer };
}

// Decode a base64 data URL and upload it to a public bucket; returns the
// public URL. Mirrors the feed-image upload path.
async function uploadDataUrlImage(supabase, bucket, dataUrl) {
  const { contentType, ext, buffer } = parseImageDataUrl(dataUrl);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Product Forge: create a physical garment product (the in-house replacement
// for Shopify). Writes a products row (description + image gallery) plus
// per-size stock rows. Dispatched by kind: 'physical_product'.
async function createPhysicalProduct(body, supabase, res) {
  const { name, priceUsd, category, description, sizes, imagesData, collection, season, edition } = body;

  // Rarity drives the storefront card border. Defaults to COMMON.
  const rarity = RARITY_PRICES[String(body.rarity || '').toUpperCase()]
    ? String(body.rarity).toUpperCase()
    : 'COMMON';

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const price = Number(priceUsd);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'priceUsd must be a positive number' });
  }
  const cat = String(category || 'CLOTHING').toUpperCase();
  if (!PHYSICAL_CATEGORIES.includes(cat)) {
    return res.status(400).json({ error: `category must be one of ${PHYSICAL_CATEGORIES.join(', ')}` });
  }
  const sizeRows = (Array.isArray(sizes) ? sizes : [])
    .map((s) => ({ size: String(s.size || '').trim().toUpperCase(), stock: Number(s.stock) }))
    .filter((s) => s.size && Number.isInteger(s.stock) && s.stock >= 0);
  if (!sizeRows.length) {
    return res.status(400).json({ error: 'at least one size with a stock count is required' });
  }

  // Duplicate guard (same rule as the cosmetic forge, scoped to physical).
  const likePattern = String(name).replace(/([%_\\])/g, '\\$1');
  const { data: existing, error: dupError } = await supabase
    .from('products')
    .select('id')
    .in('category', PHYSICAL_CATEGORIES)
    .ilike('name', likePattern)
    .maybeSingle();
  if (dupError) throw dupError;
  if (existing) {
    return res.status(409).json({
      error: `DUPLICATE_NAME // A PHYSICAL PRODUCT NAMED "${String(name).toUpperCase()}" ALREADY EXISTS`,
      existingId: existing.id,
    });
  }

  // Upload gallery images (client downscales before sending).
  const images = [];
  for (const dataUrl of (Array.isArray(imagesData) ? imagesData : []).slice(0, 6)) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      images.push(await uploadDataUrlImage(supabase, 'product-images', dataUrl));
    }
  }

  // URL slug -- the join key the storefront checkout, stock decrement, and
  // passport closet grant all key on.
  const handle = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name: String(name).trim(),
      handle,
      category: cat,
      rarity,
      price_usd: price,
      price_wngs: 0,
      is_active: true,
      description: description ? String(description).trim() : null,
      images,
      collection: collection || null,
      season: season || null,
      edition: edition || null,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: sizeErr } = await supabase
    .from('product_sizes')
    .insert(sizeRows.map((s) => ({ product_id: product.id, ...s })));
  if (sizeErr) throw sizeErr;

  return res.status(200).json({ success: true, product, sizes: sizeRows });
}

// Adjust per-size stock for a physical product (restock / correction).
// Dispatched by kind: 'product_stock'.
async function updateProductStock(body, supabase, res) {
  const { productId, sizes } = body;
  if (!productId || typeof productId !== 'string' || !Array.isArray(sizes)) {
    return res.status(400).json({ error: 'productId and sizes[] are required' });
  }
  const rows = sizes
    .map((s) => ({ product_id: productId, size: String(s.size || '').trim().toUpperCase(), stock: Number(s.stock) }))
    .filter((s) => s.size && Number.isInteger(s.stock) && s.stock >= 0);
  if (!rows.length) return res.status(400).json({ error: 'no valid size rows' });

  const { error } = await supabase
    .from('product_sizes')
    .upsert(rows, { onConflict: 'product_id,size' });
  if (error) throw error;

  return res.status(200).json({ success: true });
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
    .select('id, name, category, rarity, price_wngs, price_usd, is_active, palette, accent_color, theme_mode, collection, season, edition, images, created_at')
    .in('category', ['AVATAR', 'THEME', ...PHYSICAL_CATEGORIES])
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

  // Per-size stock for physical products. Tolerate the table not existing yet
  // (db/physical_store.sql not applied) so the cosmetics inventory still works.
  const sizesByProduct = {};
  const { data: sizeRows, error: sizesError } = await supabase
    .from('product_sizes')
    .select('product_id, size, stock');
  if (!sizesError) {
    for (const s of sizeRows || []) {
      (sizesByProduct[s.product_id] = sizesByProduct[s.product_id] || []).push({ size: s.size, stock: s.stock });
    }
  }

  return res.status(200).json({
    success: true,
    products: (products || []).map((p) => ({
      ...p,
      owners: owners[p.id] || 0,
      sizes: sizesByProduct[p.id] || null,
    })),
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
    let parsed;
    try {
      parsed = parseImageDataUrl(imageData);
    } catch (e) {
      const tooLarge = /too large/i.test(e.message);
      return res.status(tooLarge ? 413 : 400).json({ error: e.message });
    }
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.ext}`;
    const { error: upErr } = await supabase.storage
      .from('feed-images')
      .upload(path, parsed.buffer, { contentType: parsed.contentType, upsert: false });
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

// Delete a MONARCH_TIMES post (admin only): removes its comments, best-effort
// removes its uploaded feed image, then the post row. Folded here to stay
// under the function cap. Dispatched by kind: 'feed_post_delete'.
async function deleteFeedPost(body, supabase, res) {
  const { postId } = body;
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'postId is required' });
  }

  const { data: post, error: findErr } = await supabase
    .from('monarch_times')
    .select('id, image_url')
    .eq('id', postId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!post) return res.status(404).json({ error: 'POST_NOT_FOUND' });

  // Comments first -- the live schema has no FK cascade from post_comments.
  const { error: cErr } = await supabase.from('post_comments').delete().eq('post_id', postId);
  if (cErr && cErr.code !== '42P01') throw cErr; // tolerate table not existing

  // Best-effort: clean up the uploaded image if it lives in our bucket.
  if (post.image_url && post.image_url.includes('/feed-images/')) {
    const path = post.image_url.split('/feed-images/')[1];
    if (path) {
      try { await supabase.storage.from('feed-images').remove([decodeURIComponent(path)]); } catch { /* non-fatal */ }
    }
  }

  const { error: dErr } = await supabase.from('monarch_times').delete().eq('id', postId);
  if (dErr) throw dErr;

  return res.status(200).json({ success: true });
}

// Moderation backstop: the automated blocklist in api/v2/purchase.js
// (check_username/set_username) is best-effort and will miss things -- this
// lets an admin force-clear a reported username so the user falls back to
// their derived handle. Does not block them from claiming a new one.
async function clearUsername(body, supabase, res) {
  const { userId: targetUserId } = body;
  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const { data: profile, error: findErr } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', targetUserId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
  if (!profile.username) {
    return res.status(200).json({ success: true, cleared: false, reason: 'NO_USERNAME_SET' });
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ username: null })
    .eq('id', targetUserId);
  if (updErr) throw updErr;

  return res.status(200).json({ success: true, cleared: true, previousUsername: profile.username });
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
    if (body.kind === 'physical_product') {
      return await createPhysicalProduct(body, supabase, res);
    }
    if (body.kind === 'product_stock') {
      return await updateProductStock(body, supabase, res);
    }

    // Admin diagnostic: report what THIS deployment's Privy credentials can do
    // (the auto-grant path depends on getUser, which login flows never
    // exercise, so a bad PRIVY_APP_SECRET is otherwise invisible). Returns the
    // resolved app id tail + the raw getUser outcome for a DID.
    if (body.kind === 'privy_probe') {
      const appId = process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || null;
      const probe = { appIdTail: appId ? appId.slice(-6) : null, secretSet: !!process.env.PRIVY_APP_SECRET };
      try {
        const { PrivyClient } = await import('@privy-io/server-auth');
        const privy = new PrivyClient(appId, process.env.PRIVY_APP_SECRET);
        const u = await privy.getUser(body.did || body.adminId);
        probe.emails = [u?.email?.address, u?.google?.email, u?.apple?.email].filter(Boolean);
      } catch (e) {
        probe.error = e?.message || String(e);
      }
      return res.status(200).json({ success: true, probe });
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
    if (body.kind === 'feed_post_delete') {
      return await deleteFeedPost(body, supabase, res);
    }
    if (body.kind === 'clear_username') {
      return await clearUsername(body, supabase, res);
    }

    // ---- Artifact batch mint ----
    let { prefix, startNum, count, tier, product, collection, season, isSeasonArtifact } = body;

    if (!prefix || startNum === undefined || !count || !tier) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Coerce explicitly: these arrive as JSON and a string startNum used to
    // make `startNum + i` concatenate ("1" + 0 -> "10") instead of add.
    const startNumInt = Number(startNum);
    const countInt = Number(count);
    if (!Number.isInteger(startNumInt) || startNumInt < 0) {
      return res.status(400).json({ error: 'startNum must be a non-negative integer' });
    }
    if (!Number.isInteger(countInt) || countInt < 1 || countInt > MAX_BATCH_MINT) {
      return res.status(400).json({ error: `count must be an integer between 1 and ${MAX_BATCH_MINT}` });
    }

    // Default product if missing
    if (!product) product = 'Hoodie';

    const records = [];
    const generatedUrls = [];
    const baseUrl = process.env.BASE_URL || 'https://monarch-passport.vercel.app';

    for (let i = 0; i < countInt; i++) {
      const num = startNumInt + i;
      const tagId = `${prefix}${num.toString().padStart(3, '0')}-${tagSecret()}`;

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
