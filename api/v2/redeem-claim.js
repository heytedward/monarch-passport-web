import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { verifyPrivyToken } from './_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { shortCode, userId } = req.body || {};

  if (!accessToken || !shortCode || !userId) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('REDEEM_CLAIM_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    // 1. Verify the caller really owns this identity by reading their own
    // profile through their own session token (RLS enforces auth.uid() = id,
    // so this fails for a forged userId regardless of what's passed in).
    const verifiedUserId = await verifyPrivyToken(accessToken);
    if (!verifiedUserId || verifiedUserId !== userId) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Reject duplicate redemptions of the same claim link
    const { data: existingTx, error: txError } = await admin
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>claim_id', shortCode)
      .maybeSingle();

    if (txError) throw txError;
    if (existingTx) {
      return res.status(409).json({ error: 'CLAIM_FAILED // ALREADY_SCANNED' });
    }

    // 3. Look up the reward. select('*') so an optional max_redemptions column
    // is read when present without erroring on installs that don't have it yet.
    const { data: claimLink, error: claimError } = await admin
      .from('claim_links')
      .select('*')
      .eq('short_code', shortCode)
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimLink) {
      return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND' });
    }

    const amount = claimLink.wngs_award;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'CLAIM_FAILED // INVALID_ARTIFACT' });
    }

    // 3b. Global usage cap: if this link has a max_redemptions, reject once the
    // total number of redemptions (across all users) reaches it. Counted from
    // the NFC_TAP transactions tagged with this claim_id. Best-effort under
    // concurrency (count-then-write isn't atomic), which is fine for a promo cap.
    const cap = claimLink.max_redemptions;
    if (cap != null && Number(cap) > 0) {
      const { count, error: countError } = await admin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_type', 'NFC_TAP')
        .eq('metadata->>claim_id', shortCode);
      if (countError) throw countError;
      if ((count || 0) >= Number(cap)) {
        return res.status(409).json({ error: 'CLAIM_FAILED // REDEMPTION_LIMIT_REACHED' });
      }
    }

    // 4. Credit the balance. There is no `increment_wngs` RPC in this
    // project's schema (confirmed against the live PostgREST schema cache),
    // so credit it the same way api/webhooks/stripe.js's fallback does:
    // a service-role read-then-write, trusted because it only runs here.
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('wngs_balance')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const newBalance = (profile.wngs_balance || 0) + amount;

    const { error: updateError } = await admin
      .from('profiles')
      .update({ wngs_balance: newBalance })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 5. Record the transaction last so a failed credit above never leaves
    // behind a transaction row that would make a retry look already-claimed.
    const { error: insertError } = await admin
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        transaction_type: 'NFC_TAP',
        metadata: { claim_id: shortCode },
      });

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, awarded: amount });
  } catch (err) {
    console.error('REDEEM_CLAIM_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
