import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const { tagId, ownerId } = req.body;

  if (!tagId || !ownerId) return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });

  try {
    const { data, error } = await supabase
      .from('artifacts')
      .update({ is_activated: true, owner_id: ownerId })
      .eq('tag_id', tagId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, artifact: data });
  } catch (err) {
    console.error('Activation Failed:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
