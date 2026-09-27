// Scheduled security alert check. Called every 15 minutes by a pg_cron job in
// Supabase (net.http_post with the shared ALERT_CRON_SECRET from Vault). Reads
// the last window of `security_events` and, when an event kind crosses its
// threshold, emails a summary via Resend -- at most once an hour per kind.
//
// Env: ALERT_CRON_SECRET (required), RESEND_API_KEY + ALERT_EMAIL (to send),
// ALERT_FROM (optional sender, must be on a Resend-verified domain).
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { securityEvent } from './_audit.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WINDOW_MIN = 15;
const COOLDOWN_MIN = 60;

// Events per window that count as a spike worth an email.
export const THRESHOLDS = {
  'ratelimit.degraded': 1,   // limiter failing open: limits aren't enforced
  'admin.auth_denied': 3,    // someone guessing at the admin mint route
  'claim.denied': 10,        // forged / mismatched claim attempts
  'claim.conflict': 15,      // many claims on already-owned tags
  'auth.token_rejected': 25, // bad or expired Privy tokens
  'ratelimit.denied': 30,    // enumeration or scripted abuse
  'csp.violation': 100,      // report-only CSP noise; a jump means something changed
};

// Equal-length, constant-time secret check (same approach as admin/mint.js).
function secretMatches(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const len = Math.max(a.length, b.length);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return timingSafeEqual(pa, pb) && a.length === b.length;
}

// Most frequent values of the identifying field for a kind, e.g. top DIDs or
// IP-hash prefixes behind a burst of rate-limit denials.
function topSources(rows) {
  const counts = new Map();
  for (const r of rows) {
    const f = r.fields || {};
    const key = f.who || f.did || f.blocked || f.ipHash || f.scope || f.method;
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
}

export function findSpikes(rows) {
  const byEvent = new Map();
  for (const r of rows) {
    if (!byEvent.has(r.event)) byEvent.set(r.event, []);
    byEvent.get(r.event).push(r);
  }
  const spikes = [];
  for (const [event, threshold] of Object.entries(THRESHOLDS)) {
    const list = byEvent.get(event) || [];
    if (list.length >= threshold) spikes.push({ event, count: list.length, threshold, top: topSources(list) });
  }
  return spikes;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderEmail(spikes) {
  const lines = spikes.map((s) => {
    const top = s.top.map(([k, n]) => `${k} (${n})`).join(', ') || 'n/a';
    return { text: `${s.event}: ${s.count} in ${WINDOW_MIN} min (threshold ${s.threshold}). Top: ${top}`, s, top };
  });
  const text = [
    `Security alert: ${spikes.length} event type(s) spiked in the last ${WINDOW_MIN} minutes.`,
    '',
    ...lines.map((l) => `- ${l.text}`),
    '',
    'Details: Vercel logs for monarch-passport, search "SECURITY_EVENT".',
  ].join('\n');
  const html = `<div style="font-family:monospace;font-size:13px">
<p><b>Security alert</b>: ${spikes.length} event type(s) spiked in the last ${WINDOW_MIN} minutes.</p>
<table cellpadding="6" style="border-collapse:collapse">
<tr><th align="left">Event</th><th align="right">Count</th><th align="right">Threshold</th><th align="left">Top sources</th></tr>
${lines.map((l) => `<tr><td>${esc(l.s.event)}</td><td align="right">${l.s.count}</td><td align="right">${l.s.threshold}</td><td>${esc(l.top)}</td></tr>`).join('\n')}
</table>
<p>Details: Vercel logs for monarch-passport, search <code>SECURITY_EVENT</code>.</p></div>`;
  return { text, html };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const expected = process.env.ALERT_CRON_SECRET;
  if (!expected) return res.status(503).json({ error: 'ALERT_NOT_CONFIGURED' });
  if (!secretMatches(req.headers['x-alert-secret'], expected)) {
    await securityEvent('alert.auth_denied', {}, 'warn');
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { data: rows, error } = await db
    .from('security_events')
    .select('event, fields')
    .gte('at', since)
    .limit(10000);
  if (error) return res.status(500).json({ error: 'QUERY_FAILED' });

  const spikes = findSpikes(rows || []);
  if (!spikes.length) return res.status(200).json({ checked: rows.length, spikes: 0 });

  // Per-kind cool-down so a sustained attack sends one email an hour, not four.
  const { data: state } = await db.from('security_alert_state').select('kind, last_sent_at');
  const lastSent = new Map((state || []).map((s) => [s.kind, new Date(s.last_sent_at).getTime()]));
  const due = spikes.filter((s) => !lastSent.has(s.event) || Date.now() - lastSent.get(s.event) > COOLDOWN_MIN * 60_000);
  if (!due.length) return res.status(200).json({ checked: rows.length, spikes: spikes.length, emailed: 0, reason: 'cooldown' });

  const { RESEND_API_KEY, ALERT_EMAIL } = process.env;
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    await securityEvent('alert.not_sent', { reason: 'email_not_configured', kinds: due.map((s) => s.event).join(',') });
    return res.status(200).json({ checked: rows.length, spikes: due.length, emailed: 0, reason: 'email_not_configured' });
  }

  const { text, html } = renderEmail(due);
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ALERT_FROM || 'Papillon Security <alerts@papillonbrand.us>',
      to: ALERT_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      subject: `[Security] ${due.map((s) => s.event).join(', ')}`,
      text,
      html,
    }),
  });
  if (!send.ok) {
    await securityEvent('alert.not_sent', { reason: `resend_${send.status}` }, 'warn');
    return res.status(502).json({ error: 'EMAIL_FAILED' });
  }

  const now = new Date().toISOString();
  await db.from('security_alert_state').upsert(due.map((s) => ({ kind: s.event, last_sent_at: now })));
  return res.status(200).json({ checked: rows.length, spikes: due.length, emailed: due.length });
}
