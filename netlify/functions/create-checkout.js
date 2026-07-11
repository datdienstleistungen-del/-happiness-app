const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth-Check
  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) };
  }

  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    }).then(r => r.json())

    const user = authResponse?.id ? authResponse : authResponse?.data?.user

    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Ungueltiges Token' }) };
    }

    const { email } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price: 'price_1TnM1u2LYA3KKe2WtUxr8wXS',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.URL || 'https://happiness-eu.netlify.app'}/ai-chat?payment=success`,
      cancel_url: `${process.env.URL || 'https://happiness-eu.netlify.app'}/ai-chat?payment=cancel`,
      metadata: {
        userId: user.id,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};