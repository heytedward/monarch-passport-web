import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';
import { verifyPrivyToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing artifact ID' });
    }

    if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase Environment Variables");
    }

    const supabase = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: artifact, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('tag_id', id)
      .single();

    if (error || !artifact) {
      return res.status(404).json({ error: "Artifact not found" });
    }

    // Never expose the owner's Privy DID to anonymous callers (tag IDs are
    // enumerable). Instead, only tell the caller whether *they* own this tag,
    // verified against an optional Bearer token, and return a boolean.
    let isOwner = false;
    if (artifact.owner_id) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const verifiedUserId = await verifyPrivyToken(token);
        isOwner = !!verifiedUserId && verifiedUserId === artifact.owner_id;
      }
    }

    return res.status(200).json({
      id: artifact.tag_id,
      name: artifact.name,
      tier: artifact.tier,
      isActivated: artifact.is_activated,
      isOwner,
      collection: artifact.collection,
      season: artifact.season,
      isSeasonArtifact: artifact.is_season_artifact
    });

  } catch (error) {
    console.error("VERIFY_API_ERROR:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
