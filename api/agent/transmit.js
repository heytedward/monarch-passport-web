import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentSecret = process.env.AGENT_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 20000;
const MAX_AUTHOR_LEN = 100;

// Absolute http(s) only — the feed renders image_url as an <img src>.
function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Length-independent, constant-time bearer check.
//
// The previous comparison was `authHeader !== \`Bearer ${agentSecret}\``, which
// fails open when AGENT_SECRET_KEY is unset: the template literal renders
// "Bearer undefined", so anyone sending that header could publish to the feed.
// A missing secret must be a hard failure, never a usable credential.
function isAuthorizedAgent(authHeader) {
  if (!agentSecret || typeof authHeader !== 'string') return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  // SHA-256 both sides so the buffers are always 32 bytes: timingSafeEqual
  // throws on length mismatch, and an early length check would itself leak the
  // secret's length through timing.
  const a = createHash('sha256').update(authHeader.slice(7)).digest();
  const b = createHash('sha256').update(agentSecret).digest();
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Security: Check Authorization Header
  if (!isAuthorizedAgent(req.headers.authorization)) {
    return res.status(401).json({ error: "[ ACCESS_DENIED // INVALID_AGENT_SIGNATURE ]" });
  }

  try {
    const { title, raw_content, image_url, agent_identity } = req.body || {};

    // 3. Validation. Types are checked explicitly: a non-string title used to
    // reach .toUpperCase() below and throw a 500 instead of a 400. Lengths are
    // capped so a holder of the agent key can't write unbounded rows.
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: "Missing required fields: title and raw_content" });
    }
    if (typeof raw_content !== 'string' || !raw_content.trim()) {
      return res.status(400).json({ error: "Missing required fields: title and raw_content" });
    }
    if (title.length > MAX_TITLE_LEN || raw_content.length > MAX_CONTENT_LEN) {
      return res.status(413).json({
        error: `Content too long (title max ${MAX_TITLE_LEN}, raw_content max ${MAX_CONTENT_LEN})`,
      });
    }
    if (agent_identity !== undefined && typeof agent_identity !== 'string') {
      return res.status(400).json({ error: "agent_identity must be a string" });
    }
    // Rendered as an <img src>, so restrict to absolute http(s) URLs — this
    // rejects javascript:, data:, and file: before they reach the feed.
    if (image_url !== undefined && image_url !== null && !isHttpUrl(image_url)) {
      return res.status(400).json({ error: "image_url must be an absolute http(s) URL" });
    }

    // 4. Data Formatting
    const formattedTitle = title.trim().toUpperCase();
    const trimmedContent = raw_content.trim();
    const formattedContent = trimmedContent.startsWith('[ ARCHIVAL_LOG ]')
      ? trimmedContent
      : `[ ARCHIVAL_LOG ] ${trimmedContent}`;
    const authorName = agent_identity
      ? agent_identity.trim().toUpperCase().slice(0, MAX_AUTHOR_LEN)
      : 'AUTONOMOUS_AGENT';

    // 5. Database Injection (Service Role bypasses RLS)
    const { data, error } = await supabase
      .from('monarch_times')
      .insert([
        {
          title: formattedTitle,
          content: formattedContent,
          image_url: image_url || null,
          author: authorName,
          status: 'PUBLISHED'
        }
      ]);

    if (error) throw error;

    // 6. Return Success
    return res.status(200).json({ status: "[ TRANSMISSION_LOGGED_SUCCESSFULLY ]" });

  } catch (err) {
    console.error('Agent transmission error:', err);
    return res.status(500).json({ error: "[ INTERNAL_SYSTEM_FAILURE ]" });
  }
}
