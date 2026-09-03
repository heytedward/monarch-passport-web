import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { addSeasonXp, XP_TAP } from './_ascension.js';
import { verifyPrivyToken } from './_auth.js';
import { recordQuestAction } from './_quests.js';
import { enforceRateLimit, sendRateLimited } from './_ratelimit.js';
import { checkAndAwardStamps } from './_stamps.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Recurring per-tap WNGS reward, keyed by tier. There's no tier->reward
// column in the DB yet, so this lives in code for now.
const TAP_REWARD = { default: 5 };
const TAP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// The per-tag cooldown above is the real payout gate; this only stops a single
// account hammering the endpoint across many owned tags. Set well above any
// plausible wardrobe.
const TAP_USER_LIMIT = 60;
const TAP_USER_WINDOW_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { tagId, userId } = req.body || {};

  if (!accessToken || !tagId || !userId) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('TAP_REWARD_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    // Verify the Privy token server-side and confirm it matches the claimed
    // user (Supabase can't validate Privy tokens).
    const verifiedUserId = await verifyPrivyToken(accessToken);
    if (!verifiedUserId || verifiedUserId !== userId) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rate = await enforceRateLimit(admin, {
      scope: 'tap_reward',
      identifier: verifiedUserId,
      limit: TAP_USER_LIMIT,
      windowMs: TAP_USER_WINDOW_MS,
    });
    if (!rate.allowed) return sendRateLimited(res, rate.retryAfterMs);

    const { data: artifact, error: fetchError } = await admin
      .from('artifacts')
      .select('tag_id, tier, is_activated, owner_id')
      .eq('tag_id', tagId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!artifact) return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND' });
    if (!artifact.is_activated) {
      return res.status(400).json({ error: 'ARTIFACT_NOT_ACTIVATED' });
    }
    if (artifact.owner_id !== userId) {
      return res.status(403).json({ error: 'NOT_ARTIFACT_OWNER' });
    }

    const { data: lastTap, error: lastTapError } = await admin
      .from('transactions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('transaction_type', 'ARTIFACT_TAP')
      .eq('metadata->>tag_id', tagId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastTapError) throw lastTapError;

    if (lastTap) {
      const elapsed = Date.now() - new Date(lastTap.created_at).getTime();
      if (elapsed < TAP_COOLDOWN_MS) {
        return res.status(429).json({
          error: 'TAP_COOLDOWN_ACTIVE',
          retryAfterMs: TAP_COOLDOWN_MS - elapsed,
        });
      }
    }

    const reward = TAP_REWARD[artifact.tier] ?? TAP_REWARD.default;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('wngs_balance, total_taps')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

    const { error: balanceError } = await admin
      .from('profiles')
      .update({
        wngs_balance: (profile.wngs_balance || 0) + reward,
        total_taps: (profile.total_taps || 0) + 1,
      })
      .eq('id', userId);

    if (balanceError) throw balanceError;

    const { error: txError } = await admin
      .from('transactions')
      .insert({
        user_id: userId,
        amount: reward,
        transaction_type: 'ARTIFACT_TAP',
        metadata: { tag_id: tagId },
      });

    if (txError) throw txError;

    // ASCENSION: a tap also feeds battlepass XP for the active season.
    // Best-effort -- never fail the (already-committed) tap reward over it.
    let xpProgress = null;
    try {
      xpProgress = await addSeasonXp(admin, userId, XP_TAP);
    } catch (xpErr) {
      console.error('TAP_REWARD_XP_WARN:', xpErr);
    }

    // A tap is a physical-to-digital NFC scan -> advances ACHIEVE_1_NFC_SCAN.
    try {
      await recordQuestAction(admin, userId, 'ACHIEVE_1_NFC_SCAN');
    } catch (qErr) {
      console.error('TAP_REWARD_QUEST_WARN:', qErr);
    }

    // STAMPS: check if user crossed a WNGS milestone. Best-effort.
    try {
      const newBalance = (profile.wngs_balance || 0) + reward;
      await checkAndAwardStamps(admin, userId, 'WNGS_MILESTONE', newBalance);
    } catch (stampErr) {
      console.error('TAP_REWARD_STAMP_WARN:', stampErr);
    }

    return res.status(200).json({
      success: true,
      awarded: reward,
      xpAwarded: xpProgress ? XP_TAP : 0,
      level: xpProgress?.level,
    });
  } catch (err) {
    console.error('TAP_REWARD_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
