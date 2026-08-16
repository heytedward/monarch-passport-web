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

// Wallet addresses linked to an already-verified DID -- the embedded Privy
// wallet plus any externally linked ones.
//
// Used to confirm a mint recipient actually belongs to the caller. Unlike
// getPrivyUserEmails below this is NOT best-effort: it throws on failure, so a
// caller can never silently fall through to "no wallets" and treat an
// unverifiable address as acceptable.
//
// Addresses are returned verbatim -- Solana pubkeys are base58 and
// case-sensitive, so callers must not lowercase before comparing.
export async function getPrivyUserWallets(did) {
  if (!did) throw new Error('MISSING_DID');
  if (!APP_ID || !APP_SECRET) throw new Error('PRIVY_NOT_CONFIGURED');
  const u = await client().getUser(did);
  const accounts = Array.isArray(u?.linkedAccounts) ? u.linkedAccounts : [];
  const addresses = [
    u?.wallet?.address,
    ...accounts.filter((a) => String(a?.type || '').includes('wallet')).map((a) => a?.address),
  ];
  return [...new Set(addresses.filter(Boolean).map(String))];
}

// Linked email addresses (email/Google/Apple logins) for an already-verified
// DID, lowercased and deduped. Used to match storefront purchases made with
// the same email. Returns [] on any failure -- callers treat it best-effort.
export async function getPrivyUserEmails(did) {
  if (!did || !APP_ID || !APP_SECRET) return [];
  try {
    const u = await client().getUser(did);
    const emails = [u?.email?.address, u?.google?.email, u?.apple?.email];
    return [...new Set(emails.filter(Boolean).map((e) => String(e).toLowerCase()))];
  } catch (e) {
    console.error('PRIVY_GET_USER_FAILED:', e?.message || e);
    return [];
  }
}
