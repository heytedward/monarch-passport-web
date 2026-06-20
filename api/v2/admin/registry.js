import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Auth Check
    const passphrase = req.headers['x-admin-passphrase'];
    if (passphrase !== process.env.ADMIN_PASSPHRASE) {
      return res.status(401).json({ error: 'Unauthorized // Invalid Passphrase' });
    }

    if ((!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase Environment Variables");
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch all records
    const { data: artifacts, error } = await supabase
      .from('artifacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(artifacts);

  } catch (error) {
    console.error("REGISTRY_API_ERROR:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
