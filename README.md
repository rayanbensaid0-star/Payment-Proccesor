# Payment Processor

A card payment processor built with Node.js, Express and [Stripe](https://stripe.com).

Card details are entered into Stripe's secure Payment Element, so raw card numbers never reach this server. That keeps you out of most PCI compliance scope.

## Features

- Card checkout page (supports 3D Secure)
- `POST /create-payment-intent`: start a payment
- `GET /payments/:id`: check a payment's status
- `POST /refund`: full or partial refunds
- `POST /webhook`: signed Stripe webhooks (payment succeeded, failed or refunded)

## Setup

1. Create a free Stripe account and grab your **test** keys from https://dashboard.stripe.com/test/apikeys
2. Install and configure:
   ```bash
   npm install
   cp .env.example .env   # then paste your keys into .env
   ```
3. Run it:
   ```bash
   npm start
   ```
4. Open http://localhost:4242

### Test cards

| Card number          | Result                  |
|----------------------|-------------------------|
| 4242 4242 4242 4242  | Success                 |
| 4000 0025 0000 3155  | Requires 3D Secure      |
| 4000 0000 0000 9995  | Declined (insufficient funds) |

Use any future expiry date, any CVC and any postcode.

### Webhooks (local)

```bash
stripe listen --forward-to localhost:4242/webhook
```
Copy the `whsec_...` secret it prints into `.env`.

## API examples

```bash
# Create a $10.00 payment
curl -X POST localhost:4242/create-payment-intent \
  -H "Content-Type: application/json" -d '{"amount":1000,"currency":"usd"}'

# Refund it
curl -X POST localhost:4242/refund \
  -H "Content-Type: application/json" -d '{"paymentIntentId":"pi_..."}'
```

## Before going live

- Never commit `.env` (it's already in `.gitignore`)
- Add authentication to `/refund`
- Switch to live keys only after testing
- Serve over HTTPS
