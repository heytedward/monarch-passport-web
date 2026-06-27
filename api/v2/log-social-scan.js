import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createHash } from 'crypto';
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

// A given visitor (by IP) only pays out for the same owner once per window.
// This is what stops a link owner from self-farming WNGS by scripting hits to
// their own /social/:id link, and stops an attacker from draining a victim's
// stamina from a single source. Distinct real visitors (distinct IPs) still pay.
const SOCIAL_MINE_IP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Trust Vercel's injected client-IP headers (a client can't strip these). Fall
// back through the chain; return null only if nothing is present.
function clientIpHash(req) {
  const real = req.headers['x-real-ip'];
  const xff = req.headers['x-forwarded-for'];
  let ip = null;
  if (typeof real === 'string' && real.trim()) ip = real.trim();
  else if (typeof xff === 'string' && xff.trim()) ip = xff.split(',')[0].trim();
  else ip = req.socket?.remoteAddress || null;
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}

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

    // Anti-farm gate: skip payout if this same IP already mined this owner
    // within the cooldown window. Checked before the stamina gate so a repeat
    // hit neither pays out nor burns the owner's stamina. Recorded SOCIAL_MINE
    // transactions carry the ip_hash, so they double as the rate-limit ledger.
    const ipHash = clientIpHash(req);
    if (ipHash) {
      const cutoff = new Date(Date.now() - SOCIAL_MINE_IP_COOLDOWN_MS).toISOString();
      const { data: recentMine } = await admin
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', 'SOCIAL_MINE')
        .eq('metadata->>ip_hash', ipHash)
        .gte('created_at', cutoff)
        .limit(1)
        .maybeSingle();
      if (recentMine) {
        return res.status(200).json({ success: true, mined: false, reason: 'RATE_LIMITED' });
      }
    }

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
      metadata: { stamina_remaining: newStored, ip_hash: ipHash },
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
