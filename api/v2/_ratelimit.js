// Shared fixed-window rate limiter (underscore-prefixed: a helper, not a
// deployed function). Backed by the `rate_limits` table + `rate_limit_hit` RPC
// from db/security_hardening.sql.
//
// Why a table and not memory: Vercel functions are per-invocation and scale
// horizontally, so an in-process counter would reset constantly and be trivial
// to sidestep. Postgres is the only shared state this app has.
//
// FAILS OPEN. If the migration hasn't been applied, or Postgres is unhappy, the
// request is allowed and the failure is logged. A rate limiter that fails
// closed here would take /verify and /claim down for everyone on a DB blip —
// and this layer is defence-in-depth under the real fix (NTAG 424 SUN message
// authentication), not the primary control.

import { createHash } from 'crypto';

// Fraction of calls that also sweep elapsed windows, so the table doesn't grow
// without bound. ~1 in 200 requests pays a cheap indexed DELETE.
const SWEEP_PROBABILITY = 0.005;

// Trust Vercel's injected client-IP headers (a client can't strip these). Fall
// back through the chain; return null only if nothing is present. Hashed so the
// limiter never stores raw IPs. Mirrors clientIpHash in log-social-scan.js.
export function clientIpHash(req) {
  const real = req.headers['x-real-ip'];
  const xff = req.headers['x-forwarded-for'];
  let ip = null;
  if (typeof real === 'string' && real.trim()) ip = real.trim();
  else if (typeof xff === 'string' && xff.trim()) ip = xff.split(',')[0].trim();
  else ip = req.socket?.remoteAddress || null;
  return ip ? createHash('sha256').update(ip).digest('hex') : null;
}

/**
 * Count one hit against a fixed window and report whether the caller is over
 * budget.
 *
 * @param admin        service-role Supabase client
 * @param scope        limiter name, e.g. 'verify' (namespaces the bucket)
 * @param identifier   who is being limited — an IP hash or a Privy DID
 * @param limit        max hits allowed per window
 * @param windowMs     window length in ms
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export async function enforceRateLimit(admin, { scope, identifier, limit, windowMs }) {
  // No identifier means nothing to key on (e.g. no IP headers at all). Allowing
  // is the only option — there's no bucket to count into.
  if (!identifier) return { allowed: true, retryAfterMs: 0 };

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const bucket = `${scope}:${identifier}:${windowStart}`;

  try {
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_expires: new Date(windowEnd).toISOString(),
    });
    if (error) throw error;

    if (Math.random() < SWEEP_PROBABILITY) {
      admin.rpc('rate_limits_sweep').then(
        () => {},
        (e) => console.error('RATE_LIMIT_SWEEP_FAILED:', e?.message || e)
      );
    }

    const hits = Number(data) || 0;
    if (hits > limit) {
      return { allowed: false, retryAfterMs: windowEnd - now };
    }
    return { allowed: true, retryAfterMs: 0 };
  } catch (err) {
    // See FAILS OPEN above. Loud, because a persistently degraded limiter means
    // the enumeration guard on /verify and /claim is not actually running.
    console.error(`RATE_LIMIT_DEGRADED [${scope}]:`, err?.message || err);
    return { allowed: true, retryAfterMs: 0 };
  }
}

// Consistent 429 for every caller, with Retry-After in seconds (HTTP spec) and
// ms in the body (what the client code already works in).
export function sendRateLimited(res, retryAfterMs) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ error: 'RATE_LIMITED', retryAfterMs });
}
