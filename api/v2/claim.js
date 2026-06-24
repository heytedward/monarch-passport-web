import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { addSeasonXp, getActiveSeason, setSeasonPremium, XP_ACTIVATION } from './_ascension.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// One-time WNGS bonus for activating an artifact, keyed by tier. There's no
// tier->reward column in the DB yet, so this lives in code for now.
const ACTIVATION_BONUS = { default: 50 };

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
    // Verify the caller really is ownerId via their own session token (RLS
    // enforces auth.uid() = id, so this fails for a forged ownerId).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: ownProfile, error: identityError } = await userClient
      .from('profiles')
      .select('id')
      .eq('id', ownerId)
      .single();

    if (identityError || !ownProfile) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
          season && (!updated.season || updated.season === season.code || updated.season === season.name);
        if (matchesSeason) {
          await setSeasonPremium(admin, ownerId, season.id);
          isPremiumUnlocked = true;
        }
      }
    } catch (xpErr) {
      console.error('CLAIM_XP_WARN:', xpErr);
    }

    return res.status(200).json({ success: true, artifact: updated, awarded: bonus, premiumUnlocked: isPremiumUnlocked });
  } catch (err) {
    console.error('CLAIM_ERROR:', err);
    return res.status(500).json({ error: err.message || 'INTERNAL_SERVER_ERROR' });
  }
}
