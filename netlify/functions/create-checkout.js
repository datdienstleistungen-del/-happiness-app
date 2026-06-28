const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, email } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['sepa_debit', 'card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Happiness KI-Zugang',
              description: 'Monatlicher Zugang zum Happiness AI Chat',
            },
            unit_amount: 499,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.URL || 'https://happiness-eu.netlify.app'}/ai-chat?payment=success`,
      cancel_url: `${process.env.URL || 'https://happiness-eu.netlify.app'}/ai-chat?payment=cancel`,
      metadata: {
        userId: userId,
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