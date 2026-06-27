import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentSecret = process.env.AGENT_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Security: Check Authorization Header
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${agentSecret}`) {
    return res.status(401).json({ error: "[ ACCESS_DENIED // INVALID_AGENT_SIGNATURE ]" });
  }

  try {
    const { title, raw_content, image_url, agent_identity } = req.body;

    // 3. Validation
    if (!title || !raw_content) {
      return res.status(400).json({ error: "Missing required fields: title and raw_content" });
    }

    // 4. Data Formatting
    const formattedTitle = title.toUpperCase();
    const formattedContent = raw_content.startsWith('[ ARCHIVAL_LOG ]') 
      ? raw_content 
      : `[ ARCHIVAL_LOG ] ${raw_content}`;
    const authorName = agent_identity ? agent_identity.toUpperCase() : 'AUTONOMOUS_AGENT';

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
