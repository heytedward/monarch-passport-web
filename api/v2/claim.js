import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { addSeasonXp, getActiveSeason, setSeasonPremium, XP_ACTIVATION } from './_ascension.js';
import { verifyPrivyToken } from './_auth.js';
import { recordQuestAction } from './_quests.js';
import { clientIpHash, enforceRateLimit, sendRateLimited } from './_ratelimit.js';
import { checkAndAwardStamps, isFullCollectionComplete, normalizeSeasonCode } from './_stamps.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// One-time WNGS bonus for activating an artifact, keyed by tier. There's no
// tier->reward column in the DB yet, so this lives in code for now.
const ACTIVATION_BONUS = { default: 50 };

// Claiming is the endpoint an enumeration attack actually monetises: an
// unclaimed tag_id assigns ownership to whoever asks first. Until tags carry
// NTAG 424 SUN authentication, these caps are what bound the damage. Nobody
// legitimately activates garments in bulk, so both budgets sit far above real
// use and far below what walking an ID space needs.
const CLAIM_IP_LIMIT = 5;
const CLAIM_IP_WINDOW_MS = 60 * 60 * 1000;
const CLAIM_USER_LIMIT = 10;
const CLAIM_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { tagId, ownerId } = req.body || {};

  if (!accessToken || !tagId || !ownerId) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('CLAIM_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    // Verify the Privy token server-side and confirm it matches the claimed
    // owner (Supabase can't validate Privy tokens).
    const verifiedUserId = await verifyPrivyToken(accessToken);
    if (!verifiedUserId || verifiedUserId !== ownerId) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Counted before the tag is looked up, so probes for non-existent tag IDs
    // (what enumeration mostly produces) consume budget too.
    const ipRate = await enforceRateLimit(admin, {
      scope: 'claim_ip',
      identifier: clientIpHash(req),
      limit: CLAIM_IP_LIMIT,
      windowMs: CLAIM_IP_WINDOW_MS,
    });
    if (!ipRate.allowed) return sendRateLimited(res, ipRate.retryAfterMs);

    const userRate = await enforceRateLimit(admin, {
      scope: 'claim_user',
      identifier: verifiedUserId,
      limit: CLAIM_USER_LIMIT,
      windowMs: CLAIM_USER_WINDOW_MS,
    });
    if (!userRate.allowed) return sendRateLimited(res, userRate.retryAfterMs);

    const { data: artifact, error: fetchError } = await admin
      .from('artifacts')
      .select('tag_id, tier, is_activated')
      .eq('tag_id', tagId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!artifact) return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND' });
    if (artifact.is_activated) {
      return res.status(409).json({ error: 'ARTIFACT_ALREADY_CLAIMED' });
    }

    // The is_activated=false filter guards against a race with a concurrent
    // claim of the same tag landing here at the same time.
    const { data: updated, error: updateError } = await admin
      .from('artifacts')
      .update({ is_activated: true, owner_id: ownerId })
      .eq('tag_id', tagId)
      .eq('is_activated', false)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return res.status(409).json({ error: 'ARTIFACT_ALREADY_CLAIMED' });
    }

    const bonus = ACTIVATION_BONUS[artifact.tier] ?? ACTIVATION_BONUS.default;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('wngs_balance, total_taps')
      .eq('id', ownerId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

    const { error: balanceError } = await admin
      .from('profiles')
      .update({
        wngs_balance: (profile.wngs_balance || 0) + bonus,
        total_taps: (profile.total_taps || 0) + 1,
      })
      .eq('id', ownerId);

    if (balanceError) throw balanceError;

    const { error: txError } = await admin
      .from('transactions')
      .insert({
        user_id: ownerId,
        amount: bonus,
        transaction_type: 'ARTIFACT_ACTIVATION',
        metadata: { tag_id: tagId },
      });

    if (txError) throw txError;

    // ASCENSION: activation grants battlepass XP, and activating a season
    // artifact unlocks the PREMIUM track for the active season. Best-effort --
    // never fail the (already-committed) claim over battlepass bookkeeping.
    let isPremiumUnlocked = false;
    try {
      await addSeasonXp(admin, ownerId, XP_ACTIVATION);
      if (updated.is_season_artifact) {
        const season = await getActiveSeason(admin);
        const matchesSeason =
          season && (!updated.season ||
            normalizeSeasonCode(updated.season) === normalizeSeasonCode(season.code) ||
            normalizeSeasonCode(updated.season) === normalizeSeasonCode(season.title));
        if (matchesSeason) {
          await setSeasonPremium(admin, ownerId, season.id);
          isPremiumUnlocked = true;
        }
      }
    } catch (xpErr) {
      console.error('CLAIM_XP_WARN:', xpErr);
    }

    // Activating an artifact is a physical-to-digital NFC scan -> advances
    // ACHIEVE_1_NFC_SCAN. Best-effort.
    try {
      await recordQuestAction(admin, ownerId, 'ACHIEVE_1_NFC_SCAN');
    } catch (qErr) {
      console.error('CLAIM_QUEST_WARN:', qErr);
    }

    // STAMPS: first-ever artifact claim awards the FIRST_TAP stamp. Best-effort.
    if ((profile.total_taps || 0) === 0) {
      try {
        await checkAndAwardStamps(admin, ownerId, 'FIRST_TAP');
      } catch (stampErr) {
        console.error('CLAIM_STAMP_WARN:', stampErr);
      }
    }

    // STAMPS: check if user now owns the full season collection (NFC artifact
    // + all collection_items). Best-effort.
    try {
      const season = await getActiveSeason(admin);
      if (season) {
        const complete = await isFullCollectionComplete(admin, ownerId, season.id);
        if (complete) {
          await checkAndAwardStamps(admin, ownerId, 'FULL_SEASON_COLLECTION');
        }
      }
    } catch (stampErr) {
      console.error('CLAIM_COLLECTION_STAMP_WARN:', stampErr);
    }

    return res.status(200).json({ success: true, artifact: updated, awarded: bonus, premiumUnlocked: isPremiumUnlocked });
  } catch (err) {
    console.error('CLAIM_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
