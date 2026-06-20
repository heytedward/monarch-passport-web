import * as dotenv from 'dotenv';
// In Vercel serverless, __dirname isn't always reliable, so we check if we are not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Admins allowed to call this from the browser (e.g. CommandCenter) via a
// Privy session token, so the static ADMIN_PASSPHRASE never has to be
// shipped to client code. Same source CommandCenter's own allowlist reads.
const ADMIN_PRIVY_IDS = (process.env.VITE_ADMIN_PRIVY_ID || '')
  .split(',')
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean);

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
  if (!accessToken || !claimedAdminId || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }
  if (!ADMIN_PRIVY_IDS.includes(String(claimedAdminId).toLowerCase())) {
    return false;
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: ownProfile, error } = await userClient
    .from('profiles')
    .select('id')
    .eq('id', claimedAdminId)
    .single();

  return !error && !!ownProfile;
}

export default async function handler(req, res) {
  // 1. Guard against wrong methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Auth Check (static passphrase for scripts/automation, or a Privy
    // session token belonging to an admin in VITE_ADMIN_PRIVY_ID)
    const { shortCode, wngsAward, itemName, itemType, adminId } = req.body || {};
    if (!(await isAuthorizedAdmin(req, adminId))) {
      return res.status(401).json({ error: 'Unauthorized // Invalid Credentials' });
    }

    // 3. Validate Body
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

    const safeShortCode = shortCode.trim().toLowerCase();

    // 4. Supabase Logic
    if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase Environment Variables');
    }

    const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await admin
      .from('claim_links')
      .insert({
        short_code: safeShortCode,
        wngs_award: wngsAward,
        item_name: itemName,
        item_type: itemType,
      });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CLAIM_LINK_ALREADY_EXISTS' });
      }
      throw error;
    }

    // 5. SUCCESS
    return res.status(200).json({ success: true });

  } catch (error) {
    // 6. CATCH ALL: Never let the function hang
    console.error('CREATE_CLAIM_LINK_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
