import * as dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { userId, productId } = req.body || {};

  if (!accessToken || !userId || !productId) {
    return res.status(400).json({ error: 'MISSING_PAYLOAD_DATA' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('PURCHASE_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    // Verify the caller really is userId via their own session token (RLS
    // enforces auth.uid() = id, so this fails for a forged userId).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: ownProfile, error: identityError } = await userClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (identityError || !ownProfile) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, price_wngs, category')
      .eq('id', productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });

    // Only items priced in WNGS are purchasable this way. Physical products
    // only carry price_usd/external_buy_url and are bought via the storefront,
    // not here.
    if (product.price_wngs == null) {
      return res.status(400).json({ error: 'PRODUCT_NOT_PURCHASABLE_WITH_WNGS' });
    }

    const { data: owned, error: ownedError } = await admin
      .from('user_assets')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (ownedError) throw ownedError;
    if (owned) return res.status(409).json({ error: 'ITEM_ALREADY_OWNED' });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('wngs_balance')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

    const price = product.price_wngs || 0;
    const currentBalance = profile.wngs_balance || 0;

    if (currentBalance < price) {
      return res.status(402).json({ error: 'INSUFFICIENT_WNGS' });
    }

    // Guard the debit against a concurrent purchase changing the balance
    // between the read above and this write: only succeeds if the balance
    // is still what we just read.
    const { data: debited, error: debitError } = await admin
      .from('profiles')
      .update({ wngs_balance: currentBalance - price })
      .eq('id', userId)
      .eq('wngs_balance', currentBalance)
      .select('wngs_balance')
      .maybeSingle();

    if (debitError) throw debitError;
    if (!debited) {
      return res.status(409).json({ error: 'BALANCE_CHANGED // RETRY' });
    }

    const { error: assetError } = await admin
      .from('user_assets')
      .insert({ user_id: userId, product_id: productId });

    if (assetError) {
      // Refund the debit since the item was never granted.
      await admin
        .from('profiles')
        .update({ wngs_balance: debited.wngs_balance + price })
        .eq('id', userId);
      throw assetError;
    }

    const { error: txError } = await admin
      .from('transactions')
      .insert({
        user_id: userId,
        amount: -price,
        transaction_type: 'DIGITAL_PURCHASE',
        metadata: { product_id: productId },
      });

    if (txError) throw txError;

    return res.status(200).json({ success: true, newBalance: debited.wngs_balance });
  } catch (err) {
    console.error('PURCHASE_ERROR:', err);
    return res.status(500).json({ error: err.message || 'INTERNAL_SERVER_ERROR' });
  }
}
