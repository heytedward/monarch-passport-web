import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { tagId } = req.query;

  if (!tagId || typeof tagId !== 'string') {
    return res.status(400).json({ error: 'INVALID_ARTIFACT_ID' });
  }

  try {
    // Query Supabase
    const { data: artifact, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('tag_id', tagId)
      .single();

    // Handle Supabase errors or missing artifacts
    if (error || !artifact) {
      console.error('Supabase Error:', error?.message);
      return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND_IN_REGISTRY' });
    }

    // Return the formatted payload
    return res.status(200).json({
      id: artifact.tag_id,
      name: artifact.name,
      tier: artifact.tier,
      isActivated: artifact.is_activated,
      ownerId: artifact.owner_id,
      referrals: artifact.referrals
    });

  } catch (err) {
    console.error('Terminal Database Uplink Failed:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
