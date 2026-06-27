import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import {
  addSeasonXp,
  consumeOneStamina,
  XP_SOCIAL_MINE,
  WNGS_SOCIAL_MINE,
} from './_ascension.js';
import { recordQuestAction } from './_quests.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Intentionally unauthenticated -- this logs a visit to a public referral
// link (/social/:userId), and the visitor isn't expected to be logged in.
// The LINK OWNER (userId) is the one who earns, gated by their stamina.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { userId } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('LOG_SOCIAL_SCAN_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, wngs_balance, current_stamina, max_stamina, last_stamina_regen')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    // Always log the visit, whether or not it pays out.
    const { error: insertError } = await admin
      .from('artifact_scans')
      .insert([{ owner_id: userId, scan_type: 'SOCIAL_LINK' }]);

    if (insertError) throw insertError;

    // Stamina gate: a mine pays the owner only while they have stamina.
    const { ok, newStored, newUpdatedAt } = consumeOneStamina(
      profile.current_stamina,
      profile.last_stamina_regen,
      profile.max_stamina
    );

    if (!ok) {
      return res.status(200).json({ success: true, mined: false, reason: 'STAMINA_DEPLETED', stamina: 0 });
    }

    // Burn 1 stamina + credit the small WNGS trickle.
    const { error: updErr } = await admin
      .from('profiles')
      .update({
        current_stamina: newStored,
        last_stamina_regen: newUpdatedAt,
        wngs_balance: (profile.wngs_balance || 0) + WNGS_SOCIAL_MINE,
      })
      .eq('id', userId);

    if (updErr) throw updErr;

    // Battlepass XP toward the active season (best-effort).
    let xpProgress = null;
    try {
      xpProgress = await addSeasonXp(admin, userId, XP_SOCIAL_MINE);
    } catch (xpErr) {
      console.error('SOCIAL_MINE_XP_WARN:', xpErr);
    }

    // Audit trail, consistent with other earn paths.
    await admin.from('transactions').insert({
      user_id: userId,
      amount: WNGS_SOCIAL_MINE,
      transaction_type: 'SOCIAL_MINE',
      metadata: { stamina_remaining: newStored },
    });

    // Each successful mine advances the ACHIEVE_5_SOCIAL_SCANS quest (counts
    // SOCIAL_MINE transactions). Best-effort -- never fail the mine over it.
    try {
      await recordQuestAction(admin, userId, 'ACHIEVE_5_SOCIAL_SCANS');
    } catch (qErr) {
      console.error('SOCIAL_MINE_QUEST_WARN:', qErr);
    }

    return res.status(200).json({
      success: true,
      mined: true,
      stamina: newStored,
      wngsAwarded: WNGS_SOCIAL_MINE,
      xpAwarded: xpProgress ? XP_SOCIAL_MINE : 0,
      level: xpProgress?.level,
    });
  } catch (err) {
    console.error('LOG_SOCIAL_SCAN_ERROR:', err);
    return res.status(500).json({ error: err.message || 'INTERNAL_SERVER_ERROR' });
  }
}
