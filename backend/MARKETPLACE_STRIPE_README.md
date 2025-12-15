# Marketplace Stripe Integration

## Overview

Complete marketplace booking system with Stripe payment integration.

## Features

- ✅ Payment Intent creation
- ✅ Secure Stripe Elements checkout
- ✅ Webhook handling for payment events
- ✅ Booking confirmation after successful payment
- ✅ Refund support
- ✅ Multi-language support (ES, EN, DE, FR)

## Setup

### Backend

1. **Install dependencies:**
```bash
cd hotels
npm install stripe
```

2. **Add environment variables:**
```bash
# In hotels/.env
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

3. **Run migration:**
```bash
npx sequelize-cli db:migrate
```

4. **Test webhook locally with Stripe CLI:**
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/hotels/webhooks/stripe
# Copy the webhook secret to .env
```

### Frontend

1. **Add Stripe publishable key:**
```bash
# In sw2-frontend/.env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

2. **Dependencies already installed:**
- @stripe/stripe-js
- @stripe/react-stripe-js

## API Endpoints

### Create Payment Intent
```http
POST /hotels/public/properties/:propertyId/rooms/:roomId/create-payment-intent
Content-Type: application/json

{
  "guest_name": "John Doe",
  "guest_email": "john@example.com",
  "guest_phone": "+1234567890",
  "check_in": "2025-12-20",
  "check_out": "2025-12-25"
}

Response:
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentIntentId": "pi_xxx",
    "booking": { ... }
  }
}
```

### Confirm Booking
```http
POST /hotels/public/bookings/confirm-payment
Content-Type: application/json

{
  "payment_intent_id": "pi_xxx"
}

Response:
{
  "success": true,
  "data": {
    "booking": {
      "id": 123,
      "status": "confirmed",
      "payment_status": "paid",
      ...
    }
  }
}
```

### Stripe Webhook
```http
POST /hotels/webhooks/stripe
Stripe-Signature: ...
Content-Type: application/json

{
  "type": "payment_intent.succeeded",
  "data": { ... }
}
```

## User Flow

1. **Browse Properties** → MarketplaceHome
2. **View Room Details** → PropertyDetails
3. **Fill Booking Form** → BookingForm (guest info + dates)
4. **Checkout** → MarketplaceCheckout (Stripe Elements)
5. **Success** → BookingSuccess (confirmation)

## Database Schema

```sql
-- New columns in bookings table
ALTER TABLE bookings ADD COLUMN payment_intent_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN payment_status ENUM('pending','processing','paid','failed','refunded');
ALTER TABLE bookings ADD COLUMN guest_phone VARCHAR(255);
```

## Testing

### Test Cards (Stripe)
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### Test Flow
1. Go to marketplace
2. Select property and room
3. Fill booking form
4. Enter test card
5. Complete payment
6. Verify booking created with status "confirmed"

## Webhook Events Handled

- `payment_intent.succeeded` → Confirm booking
- `payment_intent.payment_failed` → Mark as failed
- `payment_intent.canceled` → Mark as cancelled
- `charge.refunded` → Mark as refunded

## Security

- Webhook signature verification
- HTTPS enforcement in production
- PCI compliance via Stripe Elements
- No card data touches our servers

## Production Checklist

- [ ] Add real Stripe keys to production .env
- [ ] Configure Stripe webhook endpoint in dashboard
- [ ] Test webhook in production
- [ ] Enable HTTPS
- [ ] Configure email notifications
- [ ] Set up monitoring for failed payments
- [ ] Add refund UI for staff

## Troubleshooting

**Webhook not working:**
- Check STRIPE_WEBHOOK_SECRET is set
- Verify webhook endpoint is reachable
- Test with Stripe CLI locally

**Payment not completing:**
- Check browser console for errors
- Verify Stripe publishable key is correct
- Ensure CORS is configured properly

**Booking not confirmed:**
- Check backend logs for errors
- Verify payment intent ID is being passed correctly
- Check database for booking entry

## Next Steps

- [ ] Add email notifications (SendGrid/AWS SES)
- [ ] Implement booking cancellation with refund
- [ ] Add receipt generation (PDF)
- [ ] Create staff refund interface
- [ ] Add booking management for guests
- [ ] Implement dynamic pricing
