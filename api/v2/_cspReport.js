// Receives Content-Security-Policy violation reports from browsers while the
// policy is in report-only mode (vercel.json), so the policy can be tightened
// and then enforced from real traffic instead of guesswork.
//
// Accepts both formats browsers send:
//   - `report-uri`  -> application/csp-report  { "csp-report": { ... } }
//   - `report-to`   -> application/reports+json [ { type, body: { ... } } ]
//
// Only the violated directive, the blocked resource's origin and the page path
// are logged -- never query strings, full URLs or script samples, which can
// carry tokens or personal data.
import { securityEvent } from './_audit.js';

const MAX_BODY = 16 * 1024;

function parseBody(body) {
  if (body == null) return null;
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// `https://x.y/path?q` -> `https://x.y`; keywords like `inline`/`eval` pass through.
function originOf(value) {
  if (!value || typeof value !== 'string') return undefined;
  try { return new URL(value).origin; } catch { return value.slice(0, 40); }
}
function pathOf(value) {
  if (!value || typeof value !== 'string') return undefined;
  try { return new URL(value).pathname; } catch { return undefined; }
}

function normalise(parsed) {
  const out = [];
  const reports = Array.isArray(parsed) ? parsed : [parsed];
  for (const r of reports.slice(0, 20)) {
    const b = r?.['csp-report'] || (r?.type === 'csp-violation' ? r.body : null);
    if (!b) continue;
    out.push({
      directive: b['effective-directive'] || b.effectiveDirective || b['violated-directive'] || b.violatedDirective,
      blocked: originOf(b['blocked-uri'] || b.blockedURL),
      page: pathOf(b['document-uri'] || b.documentURL),
      disposition: b.disposition,
    });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = parseBody(req.body);
  if (parsed) {
    for (const v of normalise(parsed)) await securityEvent('csp.violation', v, 'warn');
  }
  return res.status(204).end();
}
