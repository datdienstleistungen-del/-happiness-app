import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PRICE_TO_TIER = {
  [process.env.STRIPE_PRICE_PRO || 'price_1UDy532LYA3KKe2WcHmMXgAJ']: 'pro',
  [process.env.STRIPE_PRICE_ENTERPRISE || 'price_1UDy7D2LYA3KKe2WOChePnhU']: 'enterprise',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const priceId = session.metadata?.priceId || session.line_items?.data?.[0]?.price?.id;
    const tier = PRICE_TO_TIER[priceId] || 'pro';

    if (userId) {
      await supabase
        .from('ai_settings')
        .upsert({
          user_id: userId,
          is_premium: true,
          premium_tier: tier,
          stripe_customer_id: session.customer,
          stripe_price_id: priceId,
          premium_since: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      console.log(`Premium activated for user: ${userId} (tier: ${tier})`);
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object;
    const customerId = subscription.customer;

    await supabase
      .from('ai_settings')
      .update({ is_premium: false, premium_tier: 'free' })
      .eq('stripe_customer_id', customerId);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
