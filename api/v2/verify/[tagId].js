import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { tagId } = req.query;

  if (!tagId || typeof tagId !== 'string') {
    return res.status(400).json({ error: 'INVALID_ARTIFACT_ID' });
  }

  try {
    const { data: artifact, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('tag_id', tagId)
      .single();

    if (error || !artifact) {
      return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND_IN_REGISTRY' });
    }

    return res.status(200).json({
      id: artifact.tag_id,
      name: artifact.name,
      tier: artifact.tier,
      isActivated: artifact.is_activated,
      ownerId: artifact.owner_id,
      referrals: artifact.referrals
    });

  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
