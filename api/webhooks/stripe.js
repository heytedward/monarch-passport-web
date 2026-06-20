import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'node:stream/consumers';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const { userId, wngsAmount } = session.metadata;

      if (userId && wngsAmount) {
        console.log(`Fulfilling acquisition for user ${userId}: ${wngsAmount} WNGS`);
        
        const { error } = await supabase.rpc('increment_wngs', {
          user_id: userId,
          amount: parseInt(wngsAmount, 10)
        });

        if (error) {
          // If RPC fails, try a direct update
          console.error('RPC increment_wngs failed, trying direct update:', error);
          const { data: profile } = await supabase
            .from('profiles')
            .select('wngs_balance')
            .eq('id', userId)
            .single();
          
          if (profile) {
            await supabase
              .from('profiles')
              .update({ wngs_balance: (profile.wngs_balance || 0) + parseInt(wngsAmount, 10) })
              .eq('id', userId);
          }
        }
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
}
