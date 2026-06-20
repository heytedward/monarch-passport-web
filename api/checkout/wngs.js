import Stripe from 'stripe';
import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bundleName, priceInCents, wngsAmount, userId } = req.body;

  if (!bundleName || !priceInCents || !wngsAmount || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: bundleName,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        wngsAmount: wngsAmount.toString(),
      },
      success_url: `${process.env.VITE_APP_URL}/wallet?checkout=success`,
      cancel_url: `${process.env.VITE_APP_URL}/shop`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
