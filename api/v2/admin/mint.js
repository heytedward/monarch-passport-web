import * as dotenv from 'dotenv';
// In Vercel serverless, __dirname isn't always reliable, so we check if we are not in production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Guard against wrong methods
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Auth Check
    const passphrase = req.headers['x-admin-passphrase'];
    if (passphrase !== process.env.ADMIN_PASSPHRASE) {
      return res.status(401).json({ error: 'Unauthorized // Invalid Passphrase' });
    }

    // 3. Extract Body
    let { prefix, startNum, count, tier, product, collection, season, isSeasonArtifact } = req.body;
    if (!prefix || startNum === undefined || !count || !tier) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Default product if missing
    if (!product) product = 'Hoodie';

    // 4. Supabase Logic
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase Environment Variables");
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const records = [];
    const generatedUrls = [];
    const baseUrl = process.env.BASE_URL || 'https://monarch-passport.vercel.app';

    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      const tagId = `${prefix}${num.toString().padStart(3, '0')}`;
      
      records.push({
        tag_id: tagId,
        tier: tier,
        is_activated: false,
        name: product,
        collection: collection || null,
        season: season || null,
        is_season_artifact: !!isSeasonArtifact
      });

      generatedUrls.push(`${baseUrl}/v/${tagId}`);
    }

    const { error } = await supabase
      .from('artifacts')
      .insert(records);

    if (error) throw error;

    // 5. SUCCESS: Return the generated URLs
    return res.status(200).json({ success: true, urls: generatedUrls });

  } catch (error) {
    // 6. CATCH ALL: Never let the function hang
    console.error("MINT_API_ERROR:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
