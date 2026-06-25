import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// RLS-protected tables (profiles, user_assets, transactions) require the
// caller's Privy token; the bare anon client is blocked and returns nothing.
// Build a per-request authed client that forwards the token (mirrors the
// server-side userClient pattern). Falls back to the anon client without one.
export const authedClient = (token?: string | null) =>
  token
    ? createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
    : supabase
