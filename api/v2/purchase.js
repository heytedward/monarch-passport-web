import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { effectiveStamina, DEFAULT_MAX_STAMINA, RECHARGE_COST } from './_ascension.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // Verify the caller really is userId via their own session token (RLS
    // enforces auth.uid() = id, so this fails for a forged userId).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: ownProfile, error: identityError } = await userClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (identityError || !ownProfile) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Dispatch ASCENSION actions (identity already verified above).
    if (action === 'recharge_stamina') return await rechargeStamina(admin, userId, res);
    if (action === 'claim_reward') return await claimReward(admin, userId, rewardId, res);

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
    return res.status(500).json({ error: err.message || 'INTERNAL_SERVER_ERROR' });
  }
}
