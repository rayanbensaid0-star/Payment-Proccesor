const message = document.getElementById('message');
const amountForm = document.getElementById('amount-form');
const paymentForm = document.getElementById('payment-form');
const payButton = document.getElementById('pay-button');

let stripe;
let elements;

function show(text, isError = false) {
  message.textContent = text;
  message.className = isError ? 'error' : 'ok';
}

async function init() {
  const { publishableKey } = await fetch('/config').then((r) => r.json());
  stripe = Stripe(publishableKey);

  // Returning from a redirect (e.g. 3D Secure) — show the result.
  const clientSecret = new URLSearchParams(location.search).get('payment_intent_client_secret');
  if (clientSecret) {
    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
    show(paymentIntent.status === 'succeeded' ? 'Payment successful!' : `Payment status: ${paymentIntent.status}`,
      paymentIntent.status !== 'succeeded');
  }
}

amountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = Math.round(parseFloat(document.getElementById('amount').value) * 100);

  const res = await fetch('/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'usd' }),
  });
  const data = await res.json();
  if (data.error) return show(data.error, true);

  // Card details are entered into Stripe's secure iframe; they never touch our server.
  elements = stripe.elements({ clientSecret: data.clientSecret });
  elements.create('payment').mount('#payment-element');

  amountForm.hidden = true;
  paymentForm.hidden = false;
  show('');
});

paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  payButton.disabled = true;

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: { return_url: window.location.origin + '/' },
  });

  // Only reached if there was an immediate error; otherwise Stripe redirects.
  if (error) show(error.message, true);
  payButton.disabled = false;
});

init();
