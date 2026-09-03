import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { clientIpHash, enforceRateLimit, sendRateLimited } from './v2/_ratelimit.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Unauthenticated public signup — without a cap it's a free write endpoint for
// spam and a way to probe which addresses are already on the list.
const WAITLIST_IP_LIMIT = 5;
const WAITLIST_IP_WINDOW_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'EMAIL_REQUIRED' });
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return res.status(400).json({ error: 'INVALID_EMAIL' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('WAITLIST_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rate = await enforceRateLimit(admin, {
      scope: 'waitlist',
      identifier: clientIpHash(req),
      limit: WAITLIST_IP_LIMIT,
      windowMs: WAITLIST_IP_WINDOW_MS,
    });
    if (!rate.allowed) return sendRateLimited(res, rate.retryAfterMs);

    const { error } = await admin
      .from('waitlist')
      .upsert({ email: trimmed }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('WAITLIST_ERROR:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
