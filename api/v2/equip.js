import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { verifyPrivyToken } from './_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// These ship free with every account (see Closet.tsx's hardcoded defaults),
// so they're equippable without a user_assets ownership row.
const DEFAULT_THEME_IDS = ['SYSTEM_LIGHT', 'SYSTEM_DARK', 'CRIMSON_OVERRIDE'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { userId, itemId, itemType } = req.body || {};

  if (!accessToken || !userId || !itemId || (itemType !== 'theme' && itemType !== 'avatar')) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('EQUIP_ERROR: Missing Supabase environment variables');
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

    const isDefaultTheme = itemType === 'theme' && DEFAULT_THEME_IDS.includes(itemId);

    if (!isDefaultTheme) {
      const { data: owned, error: ownedError } = await admin
        .from('user_assets')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', itemId)
        .maybeSingle();

      if (ownedError) throw ownedError;
      if (!owned) {
        return res.status(403).json({ error: 'ITEM_NOT_OWNED' });
      }
    }

    const updateData = itemType === 'theme' ? { active_theme: itemId } : { active_avatar: itemId };

    const { error: updateError } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('EQUIP_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
