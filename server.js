require('dotenv').config();
const express = require('express');
const path = require('path');

const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, PORT = 4242 } = process.env;

if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
  console.error('Missing Stripe keys. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const stripe = require('stripe')(STRIPE_SECRET_KEY);
const app = express();

// Webhooks need the raw body to verify Stripe's signature, so this route
// is registered before express.json().
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send('Webhook secret not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature check failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Fulfil the order here (mark as paid, send receipt, etc.)
      console.log(`Payment succeeded: ${event.data.object.id} (${event.data.object.amount} ${event.data.object.currency})`);
      break;
    case 'payment_intent.payment_failed':
      console.log(`Payment failed: ${event.data.object.id}`);
      break;
    case 'charge.refunded':
      console.log(`Charge refunded: ${event.data.object.id}`);
      break;
    default:
      break;
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config', (req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

// Create a payment for an amount in the smallest currency unit (e.g. cents).
app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency = 'usd' } = req.body;

  if (!Number.isInteger(amount) || amount < 50) {
    return res.status(400).json({ error: 'Amount must be a whole number of cents, at least 50.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/payments/:id', async (req, res) => {
  try {
    const pi = await stripe.paymentIntents.retrieve(req.params.id);
    res.json({ id: pi.id, status: pi.status, amount: pi.amount, currency: pi.currency });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Full refund by default; pass { amount } for a partial refund.
// NOTE: protect this route with authentication before going live.
app.post('/refund', async (req, res) => {
  const { paymentIntentId, amount } = req.body;
  if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount ? { amount } : {}),
    });
    res.json({ id: refund.id, status: refund.status, amount: refund.amount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Payment processor running on http://localhost:${PORT}`));
