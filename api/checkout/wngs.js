import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { verifyPrivyToken } from '../v2/_auth.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { bundleId, userId } = req.body || {};

  if (!accessToken || !bundleId || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('CHECKOUT_ERROR: Missing Supabase environment variables');
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }

  try {
    // Identity check: only the authenticated user may start a checkout that
    // credits their own account (Supabase can't validate Privy tokens).
    const verifiedUserId = await verifyPrivyToken(accessToken);
    if (!verifiedUserId || verifiedUserId !== userId) {
      return res.status(401).json({ error: 'ACCESS_DENIED // IDENTITY_VERIFICATION_FAILED' });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Price and payout are read from the DB, never trusted from the client. A
    // WNGS bundle stores its USD cost in price_usd and the WNGS grant the buyer
    // receives in price_wngs (see Shop.tsx's WNGS_BUNDLE mapping).
    const { data: bundle, error: bundleError } = await admin
      .from('products')
      .select('id, name, price_usd, price_wngs, category, is_active')
      .eq('id', bundleId)
      .maybeSingle();

    if (bundleError) throw bundleError;
    if (!bundle || bundle.category !== 'WNGS_BUNDLE' || bundle.is_active === false) {
      return res.status(404).json({ error: 'BUNDLE_NOT_FOUND' });
    }

    const priceInCents = Math.round(Number(bundle.price_usd) * 100);
    const wngsAmount = Number(bundle.price_wngs);
    if (
      !Number.isFinite(priceInCents) || priceInCents <= 0 ||
      !Number.isInteger(wngsAmount) || wngsAmount <= 0
    ) {
      return res.status(400).json({ error: 'BUNDLE_MISCONFIGURED' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: bundle.name,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      // Metadata is server-set here and immutable to the client afterwards, so
      // the webhook can credit wngsAmount without re-deriving it.
      metadata: {
        userId,
        bundleId: bundle.id,
        wngsAmount: wngsAmount.toString(),
      },
      success_url: `${process.env.VITE_APP_URL}/wallet?checkout=success`,
      cancel_url: `${process.env.VITE_APP_URL}/shop`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
