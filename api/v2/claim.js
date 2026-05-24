import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const { tagId, ownerId } = req.body;

  if (!tagId || !ownerId) return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase Environment Variables");
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('artifacts')
      .update({ 
        is_activated: true, 
        owner_id: ownerId 
      })
      .eq('tag_id', tagId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, artifact: data });
  } catch (err) {
    console.error('Activation Failed:', err);
    return res.status(500).json({ error: err.message || 'INTERNAL_SERVER_ERROR' });
  }
}
