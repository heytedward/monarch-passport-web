import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { effectiveStamina, DEFAULT_MAX_STAMINA, RECHARGE_COST, getActiveSeason } from './_ascension.js';
import { avatarSvg } from './_avatarSvg.js';
import { verifyPrivyToken, getPrivyUserEmails } from './_auth.js';
import { recordQuestAction } from './_quests.js';
import { checkAndAwardStamps, isFullCollectionComplete, seasonMatchValues } from './_stamps.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NFT_BUCKET = 'nft-assets';
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'devnet';

// MONARCH_TIMES feed economy. Boosting/commenting are WNGS sinks; a post is
// promoted to FEATURED once it accumulates BOOST_FEATURE_THRESHOLD boosts.
const BOOST_COST = 50;
const BOOST_FEATURE_THRESHOLD = 20;
const COMMENT_COST = 10;
const COMMENT_MAX_LEN = 500;

// Notification feed: how far back the derived feed reaches. The audit ledger
// (`transactions`) is never trimmed — this is only the display window, so
// notifications effectively self-expire after 30 days.
const NOTIF_WINDOW_DAYS = 30;

// Maps WNGS ledger transaction_type -> a friendly confirmation. `kind` drives
// the icon/accent client-side. Unknown types fall back to a humanized label.
const NOTIF_LABELS = {
  NFC_TAP: { title: 'Artifact activated', kind: 'scan' },
  ARTIFACT_ACTIVATION: { title: 'Artifact activated', kind: 'scan' },
  QUEST_REWARD: { title: 'Quest complete', kind: 'quest' },
  SOCIAL_MINER_REWARD: { title: 'Social scan reward', kind: 'social' },
  SOCIAL_MINE: { title: 'Social scan', kind: 'social' },
  DIGITAL_PURCHASE: { title: 'Cosmetic unlocked', kind: 'shop' },
  PURCHASE_REWARD: { title: 'Store purchase reward', kind: 'shop' },
  ASCENSION_REWARD: { title: 'Ascension reward claimed', kind: 'ascension' },
  ADMIN_GRANT: { title: 'Gift received', kind: 'gift' },
  DISCOUNT_REDEMPTION: { title: 'WNGS discount created', kind: 'spend' },
  DISCOUNT_REFUND: { title: 'Discount refunded', kind: 'gift' },
  POST_BOOST: { title: 'Post boosted', kind: 'spend' },
  POST_COMMENT: { title: 'Comment posted', kind: 'spend' },
};

// WNGS → storefront discount: 100 WNGS = $1 off (mirrors the 10-per-$1 earn
// rate, a clean 10% loop). The 30% order cap is enforced storefront-side at
// checkout where the order total is known.
const WNGS_PER_DISCOUNT_DOLLAR = 100;
const MAX_DISCOUNT_USD = 500;

// Public handles: 3-20 chars, alphanumeric + underscore. Reserved names are
// blocked so they can't be claimed by a regular user.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'papillon', 'monarch',
  'moderator', 'mod', 'official', 'system', 'api', 'null', 'undefined', 'staff',
]);

function normalizeUsername(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

// Escape LIKE/ILIKE wildcards (% _ \) so an ilike lookup matches the username
// literally instead of as a pattern.
function likeEscape(s) {
  return s.replace(/[%_\\]/g, '\\$&');
}

// Unambiguous code alphabet (no 0/O/1/I).
function genDiscountCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'WNGS-' + s;
}

// Spend WNGS to refill social-mining stamina to full (a net WNGS sink).
async function rechargeStamina(admin, userId, res) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('wngs_balance, current_stamina, max_stamina, last_stamina_regen')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

  const max = profile.max_stamina || DEFAULT_MAX_STAMINA;
  const current = effectiveStamina(profile.current_stamina, profile.last_stamina_regen, max);
  if (current >= max) {
    return res.status(400).json({ error: 'STAMINA_ALREADY_FULL', stamina: current });
  }

  const balance = profile.wngs_balance || 0;
  if (balance < RECHARGE_COST) {
    return res.status(402).json({ error: 'INSUFFICIENT_WNGS' });
  }

  // Balance-guarded debit + refill to full (the user's per-account max).
  const { data: debited, error: debitError } = await admin
    .from('profiles')
    .update({
      wngs_balance: balance - RECHARGE_COST,
      current_stamina: max,
      last_stamina_regen: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('wngs_balance', balance)
    .select('wngs_balance')
    .maybeSingle();
  if (debitError) throw debitError;
  if (!debited) return res.status(409).json({ error: 'BALANCE_CHANGED // RETRY' });

  await admin.from('transactions').insert({
    user_id: userId,
    amount: -RECHARGE_COST,
    transaction_type: 'STAMINA_RECHARGE',
    metadata: {},
  });

  return res.status(200).json({ success: true, newBalance: debited.wngs_balance, stamina: max });
}

// Claim an unlocked ASCENSION level reward (gated by level + premium track).
async function claimReward(admin, userId, rewardId, res) {
  if (!rewardId) return res.status(400).json({ error: 'MISSING_REWARD_ID' });

  const { data: reward, error: rErr } = await admin
    .from('season_rewards')
    .select('*')
    .eq('id', rewardId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!reward) return res.status(404).json({ error: 'REWARD_NOT_FOUND' });

  const { data: progress, error: pErr } = await admin
    .from('user_season_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('season_id', reward.season_id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!progress) return res.status(403).json({ error: 'NO_PROGRESS_IN_SEASON' });

  if ((progress.level || 0) < reward.level) {
    return res.status(403).json({ error: 'LEVEL_NOT_REACHED' });
  }
  if (reward.track === 'premium' && !progress.is_premium) {
    return res.status(403).json({ error: 'PREMIUM_REQUIRED' });
  }

  const claimed = Array.isArray(progress.claimed_levels) ? progress.claimed_levels : [];
  if (claimed.includes(rewardId)) {
    return res.status(409).json({ error: 'REWARD_ALREADY_CLAIMED' });
  }

  // Grant by type.
  if (reward.reward_type === 'avatar' || reward.reward_type === 'theme') {
    if (!reward.product_id) return res.status(400).json({ error: 'REWARD_MISSING_PRODUCT' });
    const { data: owned } = await admin
      .from('user_assets')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', reward.product_id)
      .maybeSingle();
    if (!owned) {
      const { error: insErr } = await admin
        .from('user_assets')
        .insert({ user_id: userId, product_id: reward.product_id });
      if (insErr) throw insErr;
    }
  } else if (reward.reward_type === 'wngs') {
    const amount = reward.wngs_amount || 0;
    const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
    await admin.from('profiles').update({ wngs_balance: (prof?.wngs_balance || 0) + amount }).eq('id', userId);
    await admin.from('transactions').insert({
      user_id: userId, amount, transaction_type: 'ASCENSION_REWARD', metadata: { reward_id: rewardId },
    });
  } else if (reward.reward_type === 'physical') {
    await admin.from('user_season_progress').update({ physical_claimed: true }).eq('id', progress.id);
  }

  // Mark claimed.
  const { error: updErr } = await admin
    .from('user_season_progress')
    .update({ claimed_levels: [...claimed, rewardId] })
    .eq('id', progress.id);
  if (updErr) throw updErr;

  return res.status(200).json({ success: true, rewardType: reward.reward_type });
}

// Mint an owned avatar as a Solana NFT to the user's wallet (server-authority).
// Heavy Metaplex SDK is dynamically imported so it only loads on this path.
async function mintAvatar(admin, userId, body, res) {
  const { assetId, recipient } = body;
  if (!assetId || !recipient) return res.status(400).json({ error: 'MISSING_ASSET_OR_RECIPIENT' });
  if (!process.env.MINT_AUTHORITY_SECRET) return res.status(500).json({ error: 'MINT_AUTHORITY_NOT_CONFIGURED' });

  const { data: asset, error: aErr } = await admin
    .from('user_assets')
    .select('id, user_id, mint_address, products(name, category, palette, rarity, collection)')
    .eq('id', assetId)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!asset || asset.user_id !== userId) return res.status(403).json({ error: 'ASSET_NOT_OWNED' });
  if (asset.mint_address) return res.status(409).json({ error: 'ALREADY_MINTED', mintAddress: asset.mint_address });
  const product = asset.products;
  if (!product || product.category !== 'AVATAR') return res.status(400).json({ error: 'NOT_AN_AVATAR' });

  const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
  const { createNft, mplTokenMetadata } = await import('@metaplex-foundation/mpl-token-metadata');
  const { generateSigner, keypairIdentity, percentAmount, publicKey } = await import('@metaplex-foundation/umi');
  const { base58 } = await import('@metaplex-foundation/umi/serializers');

  let owner;
  try { owner = publicKey(recipient); } catch { return res.status(400).json({ error: 'INVALID_RECIPIENT' }); }

  // Render the avatar and host image + metadata in Supabase Storage.
  const svg = avatarSvg(product.palette);
  await admin.storage.from(NFT_BUCKET).upload(`${assetId}.svg`, svg, { contentType: 'image/svg+xml', upsert: true });
  const imageUrl = admin.storage.from(NFT_BUCKET).getPublicUrl(`${assetId}.svg`).data.publicUrl;
  const metadata = {
    name: product.name, symbol: 'MONARCH',
    description: 'Monarch Passport digital identity.',
    image: imageUrl,
    attributes: [
      { trait_type: 'Type', value: 'Avatar' },
      { trait_type: 'Rarity', value: product.rarity || 'COMMON' },
      ...(product.collection ? [{ trait_type: 'Collection', value: product.collection }] : []),
    ],
  };
  await admin.storage.from(NFT_BUCKET).upload(`${assetId}.json`, JSON.stringify(metadata), { contentType: 'application/json', upsert: true });
  const metaUrl = admin.storage.from(NFT_BUCKET).getPublicUrl(`${assetId}.json`).data.publicUrl;

  // Mint with the server authority keypair; NFT lands in the recipient's wallet.
  const umi = createUmi(SOLANA_RPC).use(mplTokenMetadata());
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(JSON.parse(process.env.MINT_AUTHORITY_SECRET)))));

  await admin.from('user_assets').update({ mint_status: 'minting' }).eq('id', assetId);
  try {
    const mint = generateSigner(umi);
    const { signature } = await createNft(umi, {
      mint,
      name: product.name.slice(0, 32),
      symbol: 'MONARCH',
      uri: metaUrl,
      sellerFeeBasisPoints: percentAmount(0),
      tokenOwner: owner,
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

    const mintAddress = mint.publicKey.toString();
    const sig = base58.deserialize(signature)[0];
    await admin.from('user_assets')
      .update({ mint_address: mintAddress, mint_status: 'minted', mint_signature: sig })
      .eq('id', assetId);

    return res.status(200).json({
      success: true,
      mintAddress,
      signature: sig,
      explorerUrl: `https://explorer.solana.com/address/${mintAddress}?cluster=${SOLANA_CLUSTER}`,
    });
  } catch (e) {
    await admin.from('user_assets').update({ mint_status: 'failed' }).eq('id', assetId);
    throw e;
  }
}

// Storefront -> Closet auto-grant. monarch-labs' Stripe webhook queues one
// purchase_grants row per purchased line item (keyed by buyer email); here we
// match the logged-in user's Privy emails, mint each unit as an already-
// activated artifact so it shows in the Closet vault, and credit the
// purchase's WNGS reward (10 wngs per $1 -- keep in sync with the storefront
// cart display). Returns { names, wngs }.
async function grantPendingPurchases(admin, userId) {
  const emails = await getPrivyUserEmails(userId);
  if (!emails.length) return { names: [], wngs: 0 };

  const { data: grants, error } = await admin
    .from('purchase_grants')
    .select('id, product_handle, product_name, quantity, stripe_session_id')
    .in('email', emails)
    .eq('status', 'PENDING');
  if (error) throw error;
  if (!grants || !grants.length) return { names: [], wngs: 0 };

  // Prices for the WNGS reward, looked up by handle.
  const handles = [...new Set(grants.map((g) => String(g.product_handle).toLowerCase()))];
  const { data: priceRows } = await admin
    .from('products')
    .select('handle, price_usd')
    .in('handle', handles);
  const priceByHandle = Object.fromEntries((priceRows || []).map((p) => [p.handle, Number(p.price_usd) || 0]));

  const grantedNames = [];
  let totalWngs = 0;
  for (const grant of grants) {
    // Claim the grant first (conditional update) so a concurrent login can't
    // double-mint; only the winner proceeds to create artifacts.
    const { data: claimed, error: claimErr } = await admin
      .from('purchase_grants')
      .update({ status: 'GRANTED', granted_to: userId, granted_at: new Date().toISOString() })
      .eq('id', grant.id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();
    if (claimErr || !claimed) continue;

    const name = grant.product_name || String(grant.product_handle).replace(/-/g, ' ').toUpperCase();
    const qty = Math.max(1, Number(grant.quantity) || 1);
    const sessionShort = String(grant.stripe_session_id).replace(/^cs_(live|test)_/, '').slice(0, 10).toUpperCase();
    const rows = [];
    for (let n = 1; n <= qty; n++) {
      rows.push({
        tag_id: `SHOP-${sessionShort}-${grant.id.slice(0, 4).toUpperCase()}${n}`,
        name,
        tier: 'COMMON',
        collection: 'PAPILLON_STORE',
        is_activated: true,
        owner_id: userId,
      });
    }
    const { error: insErr } = await admin.from('artifacts').insert(rows);
    if (insErr) {
      console.error('PURCHASE_GRANT_ARTIFACT_FAILED:', insErr);
      continue;
    }
    grantedNames.push(qty > 1 ? `${name} x${qty}` : name);
    totalWngs += Math.round((priceByHandle[String(grant.product_handle).toLowerCase()] || 0) * 10) * qty;
  }

  // Credit the purchase reward once for everything granted this login.
  if (totalWngs > 0) {
    const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
    await admin.from('profiles').update({ wngs_balance: (prof?.wngs_balance || 0) + totalWngs }).eq('id', userId);
    await admin.from('transactions').insert({
      user_id: userId,
      amount: totalWngs,
      transaction_type: 'PURCHASE_REWARD',
      metadata: { source: 'store_order_sync', items: grantedNames },
    });
  }

  return { names: grantedNames, wngs: totalWngs };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { userId, productId, action, rewardId } = req.body || {};

  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('PURCHASE_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the Privy token server-side and confirm it matches the claimed
    // user. Supabase can't validate Privy tokens, so this is the real identity
    // check; everything below uses the service role.
    const verifiedUserId = await verifyPrivyToken(accessToken);
    if (!verifiedUserId || verifiedUserId !== userId) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    // --- reads (return the user's own data; the client's RLS reads are blocked) ---
    if (action === 'ensure_profile') {
      await admin.from('profiles').upsert(
        { id: userId, wngs_balance: 0 }, { onConflict: 'id', ignoreDuplicates: true }
      );
      // Auto-grant the SYSTEM_LOGIN quest now that the profile row exists.
      // Best-effort -- never fail profile bootstrap over quest bookkeeping.
      try {
        await recordQuestAction(admin, userId, 'SYSTEM_LOGIN');
      } catch (qErr) {
        console.error('QUEST_LOGIN_WARN:', qErr);
      }
      // Storefront purchases waiting on this email -> Closet + WNGS reward.
      // Same best-effort rule: a grant failure must never block login.
      let granted = [];
      let grantedWngs = 0;
      try {
        const grantResult = await grantPendingPurchases(admin, userId);
        granted = grantResult.names;
        grantedWngs = grantResult.wngs;
      } catch (gErr) {
        console.error('PURCHASE_GRANT_WARN:', gErr);
      }
      const { data: profile } = await admin
        .from('profiles')
        .select('wngs_balance, active_theme, active_avatar, total_taps, current_stamina, max_stamina, last_stamina_regen, username')
        .eq('id', userId)
        .maybeSingle();
      // Resolve the equipped avatar's palette so the client can render it.
      let avatarColors = null;
      let themeAccent = null;
      if (profile?.active_avatar) {
        const { data: av } = await admin.from('products').select('palette').eq('id', profile.active_avatar).maybeSingle();
        avatarColors = av?.palette || null;
      }
      if (profile?.active_theme) {
        const { data: th } = await admin.from('products').select('accent_color').eq('id', profile.active_theme).maybeSingle();
        themeAccent = th?.accent_color || null;
      }
      return res.status(200).json({ success: true, profile, avatarColors, themeAccent, granted, grantedWngs });
    }

    if (action === 'check_username') {
      const username = normalizeUsername(req.body?.username);
      if (!USERNAME_RE.test(username)) {
        return res.status(200).json({ success: true, available: false, reason: 'INVALID_FORMAT' });
      }
      if (RESERVED_USERNAMES.has(username.toLowerCase())) {
        return res.status(200).json({ success: true, available: false, reason: 'RESERVED' });
      }
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', likeEscape(username))
        .neq('id', userId)
        .maybeSingle();
      return res.status(200).json({ success: true, available: !existing });
    }

    if (action === 'set_username') {
      const username = normalizeUsername(req.body?.username);
      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ error: 'INVALID_USERNAME_FORMAT' });
      }
      if (RESERVED_USERNAMES.has(username.toLowerCase())) {
        return res.status(400).json({ error: 'USERNAME_RESERVED' });
      }
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', likeEscape(username))
        .neq('id', userId)
        .maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'USERNAME_TAKEN' });
      }
      const { error: updErr } = await admin
        .from('profiles')
        .update({ username })
        .eq('id', userId);
      if (updErr) {
        // Case-insensitive unique index caught a race with a concurrent claim.
        if (updErr.code === '23505') {
          return res.status(409).json({ error: 'USERNAME_TAKEN' });
        }
        throw updErr;
      }
      return res.status(200).json({ success: true, username });
    }

    if (action === 'get_owned') {
      const { data } = await admin
        .from('user_assets')
        .select('id, product_id, mint_address, mint_status, products(*)')
        .eq('user_id', userId);
      return res.status(200).json({ success: true, assets: data || [] });
    }

    // Physical artifacts this user has claimed via NFC tap. These live in the
    // `artifacts` table (owner_id), separate from cosmetics in user_assets, and
    // power the Closet VAULT so tapped gear actually shows in the closet.
    if (action === 'get_artifacts') {
      const { data } = await admin
        .from('artifacts')
        .select('tag_id, name, tier, collection, season, is_season_artifact')
        .eq('owner_id', userId)
        .order('name', { ascending: true });
      return res.status(200).json({ success: true, artifacts: data || [] });
    }

    if (action === 'get_transactions') {
      const { data } = await admin
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return res.status(200).json({ success: true, transactions: data || [] });
    }

    // Derived notification feed: a rolling 30-day window over the WNGS ledger,
    // mapped to friendly confirmations (scans, quests, gifts, purchases…).
    // On-open model — nothing is written; the audit ledger stays intact and the
    // feed simply stops showing rows older than the window (self-expiring).
    if (action === 'get_notifications') {
      const since = new Date(Date.now() - NOTIF_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await admin
        .from('transactions')
        .select('id, amount, transaction_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      const notifications = (data || []).map((t) => {
        const label = NOTIF_LABELS[t.transaction_type] || {
          title: String(t.transaction_type || 'ACTIVITY').replace(/_/g, ' ').toLowerCase(),
          kind: 'system',
        };
        const amount = t.amount || 0;
        return {
          id: t.id,
          kind: label.kind,
          title: label.title,
          amount,
          positive: amount >= 0,
          created_at: t.created_at,
        };
      });
      return res.status(200).json({ success: true, notifications });
    }

    // Spend WNGS to mint a fixed-dollar storefront discount code. The WNGS is
    // debited here (in the authenticated passport) so the storefront never has
    // to trust an identity — it only validates the code.
    if (action === 'create_discount') {
      const discountUsd = Math.floor(Number(req.body?.discountUsd) || 0);
      if (!(discountUsd >= 1) || discountUsd > MAX_DISCOUNT_USD) {
        return res.status(400).json({ error: 'INVALID_DISCOUNT_AMOUNT' });
      }
      const cost = discountUsd * WNGS_PER_DISCOUNT_DOLLAR;

      const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
      const bal = prof?.wngs_balance || 0;
      if (bal < cost) return res.status(400).json({ error: 'INSUFFICIENT_WNGS', balance: bal, needed: cost });

      // Guarded debit (optimistic concurrency): only succeeds if the balance
      // hasn't moved since we read it.
      const { data: debited } = await admin
        .from('profiles')
        .update({ wngs_balance: bal - cost })
        .eq('id', userId)
        .eq('wngs_balance', bal)
        .select('wngs_balance')
        .maybeSingle();
      if (!debited) return res.status(409).json({ error: 'BALANCE_CHANGED_RETRY' });

      const code = genDiscountCode();
      const { error: insErr } = await admin.from('wngs_discounts').insert({
        code, user_id: userId, wngs_spent: cost, discount_usd: discountUsd, status: 'active',
      });
      if (insErr) {
        // Never keep the WNGS if the code wasn't created — refund immediately.
        await admin.from('profiles').update({ wngs_balance: debited.wngs_balance + cost }).eq('id', userId);
        console.error('CREATE_DISCOUNT_INSERT_FAIL:', insErr);
        return res.status(500).json({ error: 'DISCOUNT_CREATE_FAILED' });
      }
      await admin.from('transactions').insert({
        user_id: userId, amount: -cost, transaction_type: 'DISCOUNT_REDEMPTION',
        metadata: { code, discount_usd: discountUsd },
      });
      return res.status(200).json({ success: true, code, discountUsd, wngsSpent: cost, balance: debited.wngs_balance });
    }

    if (action === 'get_discounts') {
      const { data } = await admin
        .from('wngs_discounts')
        .select('code, wngs_spent, discount_usd, status, created_at, redeemed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      return res.status(200).json({ success: true, discounts: data || [] });
    }

    // Cancel an unused code → full WNGS refund. Only 'active' codes; the
    // guarded status flip prevents refunding a code that just got redeemed.
    if (action === 'cancel_discount') {
      const code = String(req.body?.code || '');
      const { data: row } = await admin
        .from('wngs_discounts').select('*').eq('code', code).eq('user_id', userId).maybeSingle();
      if (!row) return res.status(404).json({ error: 'CODE_NOT_FOUND' });
      if (row.status !== 'active') return res.status(400).json({ error: 'CODE_NOT_ACTIVE' });

      const { data: cancelled } = await admin
        .from('wngs_discounts')
        .update({ status: 'cancelled' })
        .eq('code', code)
        .eq('status', 'active')
        .select('code')
        .maybeSingle();
      if (!cancelled) return res.status(409).json({ error: 'CODE_STATE_CHANGED' });

      const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
      const bal = prof?.wngs_balance || 0;
      await admin.from('profiles').update({ wngs_balance: bal + row.wngs_spent }).eq('id', userId);
      await admin.from('transactions').insert({
        user_id: userId, amount: row.wngs_spent, transaction_type: 'DISCOUNT_REFUND', metadata: { code },
      });
      return res.status(200).json({ success: true, refunded: row.wngs_spent, balance: bal + row.wngs_spent });
    }

    if (action === 'get_quests') {
      // Active quests + this user's progress, both via service role so the
      // browser's RLS-blocked per-user read of user_quests isn't an issue.
      const [{ data: quests }, { data: userQuests }] = await Promise.all([
        admin.from('quests').select('*').eq('is_active', true).order('created_at', { ascending: true }),
        admin.from('user_quests').select('quest_id, status, progress, target').eq('user_id', userId),
      ]);
      return res.status(200).json({ success: true, quests: quests || [], userQuests: userQuests || [] });
    }

    // Stamps for the active season (+ cross-season), with this user's earned
    // state merged. Resilient: if the stamps tables don't exist yet, returns
    // an empty list rather than erroring (feature stays dark until seeded).
    if (action === 'get_stamps') {
      const season = await getActiveSeason(admin);
      let q = admin.from('stamps').select('*').order('sort_order', { ascending: true });
      q = season ? q.or(`season_id.eq.${season.id},season_id.is.null`) : q.is('season_id', null);
      const { data: stamps } = await q;
      const { data: userStamps } = await admin
        .from('user_stamps').select('stamp_id, earned_at').eq('user_id', userId);
      const earned = {};
      (userStamps || []).forEach((r) => { earned[r.stamp_id] = r.earned_at; });
      const result = (stamps || [])
        .map((s) => ({ ...s, earned: !!earned[s.id], earned_at: earned[s.id] || null }))
        .filter((s) => !s.is_hidden || s.earned); // hidden stamps only show once earned
      return res.status(200).json({ success: true, stamps: result, season: season || null });
    }

    // The active season's physical set (NFC season artifacts + collection_items)
    // with how many this user owns -- powers the Closet collection tracker.
    if (action === 'get_season_artifacts') {
      const season = await getActiveSeason(admin);
      if (!season) return res.status(200).json({ success: true, season: null, total: 0, owned: 0, items: [] });
      const seasonCode = season.code || season.title;
      const [{ data: nfc }, { data: items }] = await Promise.all([
        admin.from('artifacts').select('tag_id, name, owner_id').eq('is_season_artifact', true).in('season', seasonMatchValues(seasonCode)),
        admin.from('collection_items').select('id, name, image_url, sort_order').eq('season_id', season.id).order('sort_order', { ascending: true }),
      ]);
      const itemIds = (items || []).map((i) => i.id);
      let ownedItemIds = new Set();
      if (itemIds.length) {
        const { data: uci } = await admin
          .from('user_collection_items').select('item_id').eq('user_id', userId).in('item_id', itemIds);
        ownedItemIds = new Set((uci || []).map((r) => r.item_id));
      }
      const all = [
        ...(nfc || []).map((a) => ({ type: 'NFC', name: a.name || a.tag_id, image_url: null, owned: a.owner_id === userId })),
        ...(items || []).map((i) => ({ type: 'ITEM', name: i.name, image_url: i.image_url, owned: ownedItemIds.has(i.id) })),
      ];
      return res.status(200).json({
        success: true, season, total: all.length, owned: all.filter((x) => x.owned).length, items: all,
      });
    }

    // Register a physical collection item from its QR code. Idempotent via the
    // (user_id,item_id) unique constraint; awards the full-collection stamp.
    if (action === 'collect') {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
      const { data: item } = await admin
        .from('collection_items')
        .select('id, name, description, season_id, image_url')
        .eq('item_code', String(code).trim().toUpperCase())
        .maybeSingle();
      if (!item) return res.status(404).json({ error: 'INVALID_ITEM_CODE' });
      await admin
        .from('user_collection_items')
        .upsert({ user_id: userId, item_id: item.id }, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      try {
        if (await isFullCollectionComplete(admin, userId, item.season_id)) {
          await checkAndAwardStamps(admin, userId, 'FULL_SEASON_COLLECTION');
        }
      } catch (e) { console.error('COLLECT_STAMP_WARN:', e); }
      return res.status(200).json({ success: true, item: { name: item.name, description: item.description, image_url: item.image_url } });
    }

    // Read comments for a feed post (service role; feed is login-gated anyway).
    if (action === 'get_comments') {
      const { postId } = req.body || {};
      if (!postId) return res.status(400).json({ error: 'MISSING_POST_ID' });
      const { data } = await admin
        .from('post_comments')
        .select('id, user_id, body, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      return res.status(200).json({ success: true, comments: data || [] });
    }

    // Boost ("hype") a feed post: spend BOOST_COST WNGS, log the boost, bump the
    // post's counter, and flip it to FEATURED once the threshold is crossed.
    if (action === 'boost_post') {
      const { postId } = req.body || {};
      if (!postId) return res.status(400).json({ error: 'MISSING_POST_ID' });

      const { data: post } = await admin
        .from('monarch_times').select('id, boost_count, is_featured').eq('id', postId).maybeSingle();
      if (!post) return res.status(404).json({ error: 'POST_NOT_FOUND' });

      const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
      if (!prof) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
      const bal = prof.wngs_balance || 0;
      if (bal < BOOST_COST) return res.status(402).json({ error: 'INSUFFICIENT_WNGS' });

      // Balance-guarded debit (only succeeds if the balance is unchanged).
      const { data: debited } = await admin
        .from('profiles').update({ wngs_balance: bal - BOOST_COST })
        .eq('id', userId).eq('wngs_balance', bal).select('wngs_balance').maybeSingle();
      if (!debited) return res.status(409).json({ error: 'BALANCE_CHANGED // RETRY' });

      await admin.from('post_boosts').insert({ post_id: postId, user_id: userId, amount: BOOST_COST });
      const newCount = (post.boost_count || 0) + 1;
      const isFeatured = post.is_featured || newCount >= BOOST_FEATURE_THRESHOLD;
      await admin.from('monarch_times').update({ boost_count: newCount, is_featured: isFeatured }).eq('id', postId);
      await admin.from('transactions').insert({
        user_id: userId, amount: -BOOST_COST, transaction_type: 'POST_BOOST', metadata: { post_id: postId },
      });
      return res.status(200).json({ success: true, newBalance: debited.wngs_balance, boostCount: newCount, isFeatured });
    }

    // Comment on a feed post: spend COMMENT_COST WNGS, then insert the comment.
    if (action === 'add_comment') {
      const { postId, body: commentBody } = req.body || {};
      const textBody = typeof commentBody === 'string' ? commentBody.trim() : '';
      if (!postId || !textBody) return res.status(400).json({ error: 'MISSING_COMMENT' });

      const { data: post } = await admin.from('monarch_times').select('id').eq('id', postId).maybeSingle();
      if (!post) return res.status(404).json({ error: 'POST_NOT_FOUND' });

      const { data: prof } = await admin.from('profiles').select('wngs_balance').eq('id', userId).maybeSingle();
      if (!prof) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
      const bal = prof.wngs_balance || 0;
      if (bal < COMMENT_COST) return res.status(402).json({ error: 'INSUFFICIENT_WNGS' });

      const { data: debited } = await admin
        .from('profiles').update({ wngs_balance: bal - COMMENT_COST })
        .eq('id', userId).eq('wngs_balance', bal).select('wngs_balance').maybeSingle();
      if (!debited) return res.status(409).json({ error: 'BALANCE_CHANGED // RETRY' });

      const { data: comment, error: cErr } = await admin
        .from('post_comments')
        .insert({ post_id: postId, user_id: userId, body: textBody.slice(0, COMMENT_MAX_LEN) })
        .select('id, user_id, body, created_at')
        .single();
      if (cErr) {
        // Refund the debit since the comment was never stored.
        await admin.from('profiles').update({ wngs_balance: debited.wngs_balance + COMMENT_COST }).eq('id', userId);
        throw cErr;
      }
      await admin.from('transactions').insert({
        user_id: userId, amount: -COMMENT_COST, transaction_type: 'POST_COMMENT', metadata: { post_id: postId },
      });
      return res.status(200).json({ success: true, newBalance: debited.wngs_balance, comment });
    }

    // Dispatch ASCENSION actions (identity already verified above).
    if (action === 'recharge_stamina') return await rechargeStamina(admin, userId, res);
    if (action === 'claim_reward') return await claimReward(admin, userId, rewardId, res);
    if (action === 'mint_avatar') return await mintAvatar(admin, userId, req.body, res);

    // Default: buy a digital product with WNGS.
    if (!productId) return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });

    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, price_wngs, category')
      .eq('id', productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });

    // Only items priced in WNGS are purchasable this way. Physical products
    // only carry price_usd/external_buy_url and are bought via the storefront,
    // not here.
    if (product.price_wngs == null) {
      return res.status(400).json({ error: 'PRODUCT_NOT_PURCHASABLE_WITH_WNGS' });
    }

    const { data: owned, error: ownedError } = await admin
      .from('user_assets')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (ownedError) throw ownedError;
    if (owned) return res.status(409).json({ error: 'ITEM_ALREADY_OWNED' });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('wngs_balance')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

    const price = product.price_wngs || 0;
    const currentBalance = profile.wngs_balance || 0;

    if (currentBalance < price) {
      return res.status(402).json({ error: 'INSUFFICIENT_WNGS' });
    }

    // Guard the debit against a concurrent purchase changing the balance
    // between the read above and this write: only succeeds if the balance
    // is still what we just read.
    const { data: debited, error: debitError } = await admin
      .from('profiles')
      .update({ wngs_balance: currentBalance - price })
      .eq('id', userId)
      .eq('wngs_balance', currentBalance)
      .select('wngs_balance')
      .maybeSingle();

    if (debitError) throw debitError;
    if (!debited) {
      return res.status(409).json({ error: 'BALANCE_CHANGED // RETRY' });
    }

    const { error: assetError } = await admin
      .from('user_assets')
      .insert({ user_id: userId, product_id: productId });

    if (assetError) {
      // Refund the debit since the item was never granted.
      await admin
        .from('profiles')
        .update({ wngs_balance: debited.wngs_balance + price })
        .eq('id', userId);
      throw assetError;
    }

    const { error: txError } = await admin
      .from('transactions')
      .insert({
        user_id: userId,
        amount: -price,
        transaction_type: 'DIGITAL_PURCHASE',
        metadata: { product_id: productId },
      });

    if (txError) throw txError;

    return res.status(200).json({ success: true, newBalance: debited.wngs_balance });
  } catch (err) {
    console.error('PURCHASE_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
