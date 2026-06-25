// Server-side Privy token verification. Underscore prefix => not a Vercel
// function. Supabase doesn't validate Privy tokens, so we verify them here and
// then do all DB work with the service role.
import { PrivyClient } from '@privy-io/server-auth';

const APP_ID = process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;

let _privy = null;
function client() {
  if (!_privy) _privy = new PrivyClient(APP_ID, APP_SECRET);
  return _privy;
}

// Verify a Privy access token; returns the authenticated user's DID, or null.
export async function verifyPrivyToken(accessToken) {
  if (!accessToken || !APP_ID || !APP_SECRET) return null;
  try {
    const claims = await client().verifyAuthToken(accessToken);
    return claims.userId || null;
  } catch (e) {
    console.error('PRIVY_VERIFY_FAILED:', e?.message || e);
    return null;
  }
}

// Pull the Bearer token off a request and verify it -> DID or null.
export async function verifiedUserId(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return verifyPrivyToken(token);
}
