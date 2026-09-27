// Structured security/audit events (underscore prefix: a helper, not a
// deployed function). One JSON line per event, prefixed `SECURITY_EVENT`, so
// Vercel log search, a log drain, or an alert rule can match on it.
//
// Sanitised by construction: fields whose names look like credentials are
// dropped, strings are length-capped, and callers pass only public or hashed
// identifiers (Privy DID, tag ID, IP *hash*) -- never tokens, passphrases,
// emails or raw IPs.

import { createClient } from '@supabase/supabase-js';

const MAX_LEN = 200;
const SENSITIVE_KEY = /token|secret|pass|authorization|cookie|email|^ip$/i;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PERSIST_TIMEOUT_MS = 1500;

let _admin = null;
function admin() {
  if (!_admin && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return _admin;
}

// Warn-level events are also stored in `security_events` so the scheduled
// alert check (api/v2/_securityAlert.js) can spot spikes. Bounded and
// best-effort: a slow or failing insert never blocks or breaks the request.
async function persist(event, fields) {
  const db = admin();
  if (!db) return;
  try {
    await Promise.race([
      db.from('security_events').insert({ source: 'passport', event, fields }),
      new Promise((resolve) => setTimeout(resolve, PERSIST_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error('SECURITY_EVENT_PERSIST_FAILED:', e?.message || e);
  }
}

/**
 * Log (and, for warn level, store) a security event. Callers should `await`
 * it: on Vercel, work still pending after the response is sent may be cut off.
 *
 * @param event   dotted name, e.g. 'auth.token_rejected', 'claim.succeeded'
 * @param fields  extra context (did, tagId, scope, ipHash, reason, ...)
 * @param level   'info' | 'warn' — warn for denials/failures so they stand out
 */
export async function securityEvent(event, fields = {}, level = 'info') {
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || SENSITIVE_KEY.test(key)) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, MAX_LEN) : value;
  }
  const line = 'SECURITY_EVENT ' + JSON.stringify({ event, level, at: new Date().toISOString(), ...safe });
  (level === 'warn' ? console.warn : console.log)(line);
  if (level === 'warn') await persist(event, safe);
}
