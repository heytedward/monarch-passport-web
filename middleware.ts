import { next } from '@vercel/edge';

// Server-rendered link previews for /social/:userId.
//
// This app is a Vite SPA: one index.html with static meta tags, and the
// crawlers that build link cards do not run JavaScript. Without this, every
// shared collector link previews identically — no callsign, no context — which
// is most of the reason to share one at all.
//
// Only crawlers get the synthesized document. Real browsers fall straight
// through to the app, so this is prerendering, not cloaking: both audiences are
// told the same thing, one of them just can't execute React to find it out.
//
// Runs on Vercel's Edge Middleware, which is billed and counted separately from
// the 12 Serverless Functions this repo already has (see CLAUDE.md) — worth
// re-confirming against the plan before relying on it.

export const config = {
  matcher: '/social/:path*',
};

// Deliberately narrow: only user-agents that actually build preview cards.
// Anything unmatched — including every real browser — passes through.
const CRAWLER_UA =
  /(twitterbot|facebookexternalhit|slackbot|slack-imgproxy|discordbot|linkedinbot|whatsapp|telegrambot|pinterest|redditbot|skypeuripreview|embedly|quora link preview|bitlybot|vkshare|applebot|bingbot|googlebot|mastodon|bsky)/i;

const SITE_NAME = 'MONARCH PASSPORT';
const FALLBACK_TITLE = 'MONARCH PASSPORT';
const DESCRIPTION =
  'Tap this signal to boost a collector on the Monarch network. Papillon Brand.';

// The username column is constrained to [A-Za-z0-9_] or Monarch#<digits>, so
// none of these can appear today. Escaped anyway: this value crosses a trust
// boundary into markup, and that constraint is one migration away from changing.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resolve a Privy DID to its public callsign via the public_callsign RPC
// (db/public_callsign.sql) using the anon key. `profiles` itself stays
// RLS-locked; the function returns one field for one id and cannot be used to
// enumerate members.
async function fetchCallsign(userId: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    // Bounded so a slow database can never hold up a crawler; a missed callsign
    // costs a generic card, a hung request costs the preview entirely.
    const res = await fetch(`${url}/rest/v1/rpc/public_callsign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_id: userId }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const value = await res.json();
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function previewDocument(title: string, canonical: string, imageUrl: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(DESCRIPTION);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${imageUrl}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${canonical}">Open Monarch Passport</a></p>
</body>
</html>`;
}

export default async function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  if (!CRAWLER_UA.test(ua)) return next();

  const url = new URL(request.url);
  const userId = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');

  const callsign = userId ? await fetchCallsign(userId) : null;
  const title = callsign ? `${callsign} // ${SITE_NAME}` : FALLBACK_TITLE;
  const imageUrl = `${url.origin}/og/monarch-card.png`;

  return new Response(previewDocument(title, url.toString(), imageUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short cache: a collector can change their callsign, and crawlers
      // re-fetch on demand anyway.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
