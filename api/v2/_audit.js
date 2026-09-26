// Structured security/audit events (underscore prefix: a helper, not a
// deployed function). One JSON line per event, prefixed `SECURITY_EVENT`, so
// Vercel log search, a log drain, or an alert rule can match on it.
//
// Sanitised by construction: fields whose names look like credentials are
// dropped, strings are length-capped, and callers pass only public or hashed
// identifiers (Privy DID, tag ID, IP *hash*) -- never tokens, passphrases,
// emails or raw IPs.

const MAX_LEN = 200;
const SENSITIVE_KEY = /token|secret|pass|authorization|cookie|email|^ip$/i;

/**
 * @param event   dotted name, e.g. 'auth.token_rejected', 'claim.succeeded'
 * @param fields  extra context (did, tagId, scope, ipHash, reason, ...)
 * @param level   'info' | 'warn' — warn for denials/failures so they stand out
 */
export function securityEvent(event, fields = {}, level = 'info') {
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || SENSITIVE_KEY.test(key)) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, MAX_LEN) : value;
  }
  const line = 'SECURITY_EVENT ' + JSON.stringify({ event, level, at: new Date().toISOString(), ...safe });
  (level === 'warn' ? console.warn : console.log)(line);
}

// Short, non-reversible prefix of an IP hash: enough to correlate repeated
// attempts from one source in the logs without storing the full digest.
export const ipTag = (ipHash) => (ipHash ? ipHash.slice(0, 12) : null);
