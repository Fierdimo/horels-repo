# Flujo de Compra de Reserva - Datos Disponibles

## Resumen del Flujo
1. **BookingForm** → Recopila datos del huésped y fechas
2. **MarketplaceCheckout** → Muestra resumen y procesa pago Stripe
3. **CheckoutForm** → Formulario de pago con tarjeta
4. **BookingSuccess** → Confirmación de reserva

---

## 📋 Datos Disponibles por Etapa

### **1. BOOKING FORM** (BookingForm.tsx)

El formulario recopila:

```typescript
// Datos del huésped
- guestName: string
- guestEmail: string  
- guestPhone: string (opcional)
- specialRequests: string (opcional)

// Fechas
- checkIn: string (ISO format)
- checkOut: string (ISO format)

// De persistencia
- state.guests: number (número de huéspedes)
- room.guestPrice: number (precio final que paga el guest)
```

**Estos datos se pasan al siguiente paso via navigate state:**
```tsx
navigate(`...checkout`, {
  state: {
    checkIn,
    checkOut,
    guests: state.guests || 1,
    guestName,
    guestEmail,
    guestPhone
  }
});
```

---

### **2. CHECKOUT PAGE** (MarketplaceCheckout.tsx)

**Datos del Room:**
```typescript
room: {
  id: number
  name: string
  type: string
  guestPrice: number  // Precio por noche que paga el guest
}
```

**Datos de Propiedad:**
```typescript
roomData?.data?.property: {
  id: number
  name: string
  location: string
}
```

**Datos Calculados:**
```typescript
nights = differenceInDays(parseISO(checkOut), parseISO(checkIn))
pricePerNight = room?.guestPrice
totalAmount = nights * pricePerNight  // Monto total a cobrar

// Información del guest (desde state)
guestName: string
guestEmail: string
guestPhone?: string
guests: number
```

**Información de Usuario (si está autenticado):**
```typescript
user: {
  id: number
  email: string
  role: 'owner' | 'guest' | 'staff' | 'admin'
  property_id?: number
}

// Métodos de pago guardados
paymentMethods: [
  {
    id: string
    brand: string      // 'visa', 'mastercard', etc
    last4: string      // Últimos 4 dígitos
    exp_month: number
    exp_year: number
  }
]
```

---

### **3. PAYMENT INTENT** (Backend)

Cuando se crea el Payment Intent, se envía al endpoint:
```
POST /public/properties/:propertyId/rooms/:roomId/create-payment-intent
```

**Request Body:**
```typescript
{
  guestName: string
  guestEmail: string
  guestPhone?: string
  checkIn: string        // ISO date
  checkOut: string       // ISO date
  guests: number
}
```

**Response del Backend:**
```typescript
{
  success: true,
  data: {
    clientSecret: string        // Para Stripe Elements
    paymentIntentId: string      // ID del Payment Intent
    amount: number               // Monto en EUR
    isTestPrice: boolean         // Si usa precio de prueba
  }
}
```

---

### **4. RESUMEN VISIBLE EN PÁGINA DE PAGO**

Actualmente mostrando:

✅ **Booking Summary:**
- Property name
- Room name
- Check-in date
- Check-out date
- Number of nights
- Number of guests
- Price per night
- Total amount
- Test price warning (si aplica)

✅ **Métodos de Pago:**
- Tarjetas guardadas (si existen)
- Opción para usar nueva tarjeta

⚠️ **Lo que FALTA (RECOMENDACIONES):**
- [ ] Desglose de costos (precio hotel + comisión plataforma)
- [ ] Política de cancelación
- [ ] Información del huésped (nombre, email, teléfono)
- [ ] Términos y condiciones
- [ ] Garantía de seguridad de pago

---

## 🎯 Datos que Puedes Usar para Mejorar

### **Desglose de Precios Completo**

Desde el backend, calcula y devuelve:

```typescript
// En publicRoutes.ts line ~330-340
const hotelPrice = room.customPrice || 0;
const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
const commissionRate = await pricingService.getPlatformCommissionRate();

// Respuesta incluye:
{
  hotelPrice: number
  guestPrice: number  
  platformCommission: number  // guestPrice - hotelPrice
  commissionRate: number      // e.g., 15
}
```

**Podrías mostrar en checkout:**
```
Precio por noche (hotel)     €150.00
Comisión plataforma (+15%)   €22.50
━━━━━━━━━━━━━━━━━━━━━━━━━
Precio por noche (guest)     €172.50

Multiplicado por 3 noches    €517.50
```

### **Información del Huésped**

```typescript
// Ya tienes en state:
guestName
guestEmail
guestPhone

// Puedes mostrar:
"Reserva para: {guestName}"
"Confirmación enviada a: {guestEmail}"
"Contacto: {guestPhone}"
```

### **Información de la Propiedad**

```typescript
roomData?.data?.property: {
  id
  name
  location
  city
  country
  check_in_time
  check_out_time
  amenities      // Del PMS
}
```

---

## 🔄 Flujo Completo de Datos

```
BookingForm
    ↓
    ├─ guestName, guestEmail, guestPhone
    ├─ checkIn, checkOut
    └─ state.guests
    ↓
MarketplaceCheckout (recibe state)
    ↓
    ├─ Fetches: /public/properties/{id}/rooms/{roomId}
    │  └─ Room + Property data (name, type, guestPrice, etc)
    │
    ├─ Create Payment Intent: POST /create-payment-intent
    │  ├─ Input: guestName, guestEmail, checkIn, checkOut, nights, pricePerNight
    │  └─ Output: clientSecret, paymentIntentId, amount, isTestPrice
    │
    ├─ Muestra Summary (property, room, dates, nights, total)
    ├─ Muestra Payment Methods (tarjetas guardadas o nueva)
    │
    └─ Procesa pago
        ├─ Si usa tarjeta nueva → CheckoutForm (Stripe Elements)
        └─ Si usa tarjeta guardada → API confirm-payment-with-saved-card
        ↓
BookingSuccess
    └─ Confirmación con paymentIntentId
```

---

## 💡 Recomendaciones para Mejorar la Experiencia

1. **Mostrar desglose de precios** con comisión explícita
2. **Confirmar datos del huésped** antes de procesar pago
3. **Mostrar política de cancelación** y términos
4. **Indicar garantía de pago seguro** (Stripe badge)
5. **Mostrar información del hotel** (check-in/out times, ubicación)
6. **Email de confirmación** después del pago exitoso
7. **Resumen imprimible** de la reserva

---

## 📞 Endpoints Relacionados

### **Para Obtener Datos:**
- `GET /public/properties/{id}/rooms` - Lista de rooms
- `GET /public/properties/{id}/rooms/{roomId}` - Detalles del room
- `GET /auth/profile` - Datos del usuario (si autenticado)
- `GET /auth/payment-methods` - Tarjetas guardadas (si autenticado)

### **Para Procesar Pago:**
- `POST /public/properties/{propertyId}/rooms/{roomId}/create-payment-intent`
- `POST /public/bookings/confirm-payment-with-saved-card`
- `POST /public/bookings/confirm-payment`

---

## 🛡️ Datos de Seguridad a Tener en Cuenta

❌ **NUNCA mostrar en el frontend:**
- Números completos de tarjeta
- CVC/CVV
- Token de Stripe (clientSecret se usa solo en cliente Stripe)

✅ **OK mostrar:**
- Últimos 4 dígitos de tarjeta (****1234)
- Marca de tarjeta (Visa, Mastercard, etc)
- Fecha de expiración
- Nombre del titular

