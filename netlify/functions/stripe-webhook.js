import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const userId = session.metadata.userId;

    if (userId) {
      await supabase
        .from('ai_settings')
        .upsert({
          user_id: userId,
          is_premium: true,
          stripe_customer_id: session.customer,
          premium_since: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      console.log(`Premium activated for user: ${userId}`);
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object;
    const customerId = subscription.customer;

    await supabase
      .from('ai_settings')
      .update({ is_premium: false })
      .eq('stripe_customer_id', customerId);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
