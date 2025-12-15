# Flujo de Pagos con Stripe Connect

## Arquitectura de Pagos

El sistema utiliza **Stripe Connect** para gestionar pagos split entre la plataforma y los hoteles.

### Componentes

1. **Plataforma (Platform Account)**: Cuenta principal de Stripe que cobra al guest
2. **Hotel (Connected Account)**: Cuenta Stripe Connect del hotel que recibe su pago
3. **Guest**: Usuario que paga el precio final (incluye comisión)

## Flujo Completo

### 1. Setup Inicial (One-time)

#### Hotel conecta su cuenta Stripe:
```typescript
POST /api/properties/:id/connect-stripe
Authorization: Bearer {staff_token}

Response:
{
  "onboardingUrl": "https://connect.stripe.com/oauth/..."
}
```

El hotel completa el onboarding y la plataforma guarda `stripe_connect_account_id` en la property.

### 2. Creación de Booking

#### Guest selecciona habitación:
```javascript
// GET /api/public/properties/5/rooms/20
{
  "id": 20,
  "name": "Deluxe Room",
  "hotelPrice": 89.00,        // Precio configurado por hotel
  "guestPrice": 99.68,        // Precio que paga el guest (+12% comisión)
  "platformCommission": 10.68 // Ganancia de la plataforma
}
```

#### Guest crea booking:
```javascript
POST /api/bookings
Authorization: Bearer {guest_token}
{
  "propertyId": 5,
  "roomId": 20,
  "checkIn": "2025-12-20",
  "checkOut": "2025-12-23",
  "nights": 3
}

Response:
{
  "bookingId": 123,
  "totalAmount": 299.04,      // guestPrice * nights = 99.68 * 3
  "hotelPayout": 267.00,      // hotelPrice * nights = 89.00 * 3
  "platformCommission": 32.04, // 10.68 * 3
  "status": "pending_payment"
}
```

### 3. Procesamiento de Pago

#### Crear Payment Intent con Destination Charge:
```typescript
POST /api/bookings/123/payment-intent
Authorization: Bearer {guest_token}

// Backend crea:
const paymentIntent = await stripe.paymentIntents.create({
  amount: 29904, // $299.04 en centavos (guestPrice * nights)
  currency: 'usd',
  payment_method_types: ['card'],
  
  // STRIPE CONNECT: Destination Charge
  transfer_data: {
    destination: property.stripe_connect_account_id, // Cuenta del hotel
    amount: 26700 // $267.00 en centavos (hotelPayout)
  },
  
  // La diferencia ($32.04) se queda automáticamente en la plataforma
  application_fee_amount: 3204, // $32.04 en centavos (comisión)
  
  metadata: {
    bookingId: 123,
    propertyId: 5,
    roomId: 20,
    hotelPrice: 89.00,
    guestPrice: 99.68,
    nights: 3
  }
});

Response:
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxxxxxxxxxxxx"
}
```

#### Guest confirma pago en frontend:
```javascript
// Frontend usa Stripe.js
const {error, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Guest Name',
      email: 'guest@example.com'
    }
  }
});

if (paymentIntent.status === 'succeeded') {
  // Notificar al backend
  await axios.patch('/api/bookings/123/confirm', {
    paymentIntentId: paymentIntent.id
  });
}
```

### 4. Confirmación y Distribución Automática

```typescript
PATCH /api/bookings/123/confirm
Authorization: Bearer {guest_token}
{
  "paymentIntentId": "pi_xxxxxxxxxxxxx"
}

// Backend:
1. Verifica payment intent en Stripe
2. Actualiza booking: status = "confirmed"
3. Stripe automáticamente:
   - Cobra $299.04 al guest
   - Transfiere $267.00 al hotel (stripe_connect_account_id)
   - Retiene $32.04 en la plataforma
```

## Modelo de Datos

### Booking Table
```sql
CREATE TABLE bookings (
  id INT PRIMARY KEY,
  property_id INT,
  room_id INT,
  guest_user_id INT,
  check_in DATE,
  check_out DATE,
  nights INT,
  
  -- Precios
  hotel_price_per_night DECIMAL(10,2),  -- $89.00
  guest_price_per_night DECIMAL(10,2),  -- $99.68
  commission_per_night DECIMAL(10,2),   -- $10.68
  
  total_guest_amount DECIMAL(10,2),     -- $299.04
  total_hotel_payout DECIMAL(10,2),     -- $267.00
  total_platform_commission DECIMAL(10,2), -- $32.04
  commission_rate DECIMAL(5,2),         -- 12.00
  
  -- Stripe
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),      -- ID de la transferencia al hotel
  
  status ENUM('pending_payment', 'confirmed', 'cancelled', 'refunded'),
  payment_status ENUM('pending', 'succeeded', 'failed', 'refunded'),
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Property Table
```sql
ALTER TABLE properties ADD COLUMN stripe_connect_account_id VARCHAR(255);
ALTER TABLE properties ADD COLUMN stripe_connect_status ENUM('not_connected', 'pending', 'active', 'restricted');
ALTER TABLE properties ADD COLUMN stripe_onboarding_completed BOOLEAN DEFAULT FALSE;
```

## Estados de Pago

### Flujo Normal
1. **pending_payment**: Booking creado, esperando pago
2. **processing**: Payment intent creado, procesando
3. **confirmed**: Pago exitoso, distribución completada
4. **completed**: Servicio completado (después del checkout)

### Flujo de Error
1. **payment_failed**: Pago rechazado
2. **cancelled**: Usuario canceló antes del pago
3. **refunded**: Reembolso procesado

## Reembolsos

```typescript
POST /api/bookings/123/refund
Authorization: Bearer {admin_token or staff_token}
{
  "reason": "Guest cancellation",
  "amount": 299.04 // null = full refund
}

// Backend:
const refund = await stripe.refunds.create({
  payment_intent: booking.stripe_payment_intent_id,
  amount: 29904, // centavos
  reverse_transfer: true, // Revierte también la transferencia al hotel
  refund_application_fee: true // Devuelve la comisión
});

// Resultado:
// - Guest recibe $299.04
// - Hotel devuelve $267.00
// - Plataforma devuelve $32.04
```

## Webhooks de Stripe

```typescript
POST /api/webhooks/stripe
Stripe-Signature: {signature}

// Eventos importantes:
- payment_intent.succeeded → Confirmar booking
- payment_intent.payment_failed → Marcar booking como failed
- charge.refunded → Actualizar booking a refunded
- account.updated → Actualizar stripe_connect_status del hotel
```

## Ejemplo Completo con Código

### Backend: Crear Payment Intent
```typescript
// src/controllers/bookingController.ts

async createPaymentIntent(req: AuthRequest, res: Response) {
  const { bookingId } = req.params;
  
  const booking = await Booking.findByPk(bookingId, {
    include: [Property, Room]
  });
  
  // Calcular precios con comisión
  const nights = booking.nights;
  const hotelPrice = booking.room.customPrice || booking.room.basePrice;
  const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
  const commission = guestPrice - hotelPrice;
  
  const totalGuestAmount = guestPrice * nights;
  const totalHotelPayout = hotelPrice * nights;
  const totalCommission = commission * nights;
  
  // Verificar que el hotel tenga Stripe Connect
  if (!booking.property.stripe_connect_account_id) {
    return res.status(400).json({
      error: 'Hotel has not connected Stripe account'
    });
  }
  
  // Crear Payment Intent con Destination Charge
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalGuestAmount * 100), // centavos
    currency: 'usd',
    payment_method_types: ['card'],
    
    // Split payment
    transfer_data: {
      destination: booking.property.stripe_connect_account_id,
      amount: Math.round(totalHotelPayout * 100)
    },
    application_fee_amount: Math.round(totalCommission * 100),
    
    metadata: {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      roomId: booking.roomId,
      nights,
      hotelPrice,
      guestPrice,
      commission
    }
  });
  
  // Guardar datos en booking
  await booking.update({
    stripe_payment_intent_id: paymentIntent.id,
    total_guest_amount: totalGuestAmount,
    total_hotel_payout: totalHotelPayout,
    total_platform_commission: totalCommission,
    payment_status: 'processing'
  });
  
  res.json({
    clientSecret: paymentIntent.client_secret,
    amount: totalGuestAmount
  });
}
```

### Frontend: Confirmar Pago
```typescript
// React component
const confirmPayment = async () => {
  const {error, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: guestName,
        email: guestEmail
      }
    }
  });
  
  if (error) {
    setError(error.message);
  } else if (paymentIntent.status === 'succeeded') {
    // Notificar backend
    await api.patch(`/bookings/${bookingId}/confirm`, {
      paymentIntentId: paymentIntent.id
    });
    
    navigate('/booking-confirmation');
  }
};
```

## Seguridad y Compliance

### PCI Compliance
- ✅ Nunca guardar números de tarjeta
- ✅ Usar Stripe.js para tokenización
- ✅ HTTPS en producción
- ✅ Validar webhooks con signatures

### Validaciones Backend
```typescript
// Verificar que el monto coincida
const calculatedAmount = await calculateBookingAmount(booking);
if (Math.abs(calculatedAmount - paymentIntent.amount) > 1) {
  throw new Error('Amount mismatch');
}

// Verificar que el payment intent pertenece al booking
if (paymentIntent.metadata.bookingId !== booking.id) {
  throw new Error('Invalid payment intent');
}

// Verificar que no ha sido usado antes
if (booking.stripe_payment_intent_id && 
    booking.payment_status === 'succeeded') {
  throw new Error('Booking already paid');
}
```

## Testing

### Test con Stripe Test Mode
```bash
# Test cards
4242 4242 4242 4242 - Success
4000 0000 0000 9995 - Declined (insufficient funds)
4000 0000 0000 0002 - Declined (generic)
```

### Simular Webhooks
```bash
stripe trigger payment_intent.succeeded
stripe trigger charge.refunded
```

## Próximos Pasos para Implementación

1. ✅ Sistema de comisiones configurables (COMPLETADO)
2. ✅ Cálculo automático de precios (COMPLETADO)
3. 🔄 Agregar campos a tabla bookings (SQL migration)
4. 🔄 Implementar Stripe Connect onboarding
5. 🔄 Crear Payment Intent con destination charge
6. 🔄 Webhooks de Stripe
7. 🔄 Sistema de reembolsos
8. 🔄 Dashboard de pagos para hotels

## Referencias

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)
