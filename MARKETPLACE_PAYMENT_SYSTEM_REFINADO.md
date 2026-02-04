# Sistema de Pagos Marketplace - Refinado

**Fecha:** 3 de Febrero de 2026  
**Estado:** Implementado  
**Versión:** 2.0

---

## Resumen Ejecutivo

Se ha refinado el sistema de pagos del marketplace para manejar correctamente:

1. **Pagos 100% con créditos** (cuando el usuario tiene suficientes)
2. **Pagos híbridos** (créditos + Stripe cuando hay déficit)
3. **Cálculo preciso de créditos** usando la **Fórmula Maestra**

---

## Fórmula Maestra para Cálculo de Créditos

### Para DEPÓSITOS (Liberar semanas al marketplace)

```
Credits = BASE_SEASON_VALUE × TIER_MULTIPLIER × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER
```

**Valores Base por Temporada:**
- `RED` (Alta): 1000 créditos
- `WHITE` (Media): 600 créditos
- `BLUE` (Baja): 300 créditos

**Multiplicadores de Tier:**
- `DIAMOND`: 1.5
- `GOLD`: 1.3
- `SILVER_PLUS`: 1.1
- `STANDARD`: 1.0

**Multiplicadores de Tipo de Habitación:**
- `PRESIDENTIAL` (Penthouse): 2.5
- `SUITE` (3 BR): 2.0
- `DELUXE` (2 BR): 1.5
- `SUPERIOR` (1 BR): 1.2
- `STANDARD` (Studio): 1.0

**Multiplicador de Ubicación:** Configurado por propiedad (default: 1.0)

**Ejemplo:**
```
Liberar una semana 2BR en temporada RED en propiedad GOLD con location_multiplier 1.2:

Credits = 1000 × 1.3 × 1.2 × 1.5 = 2,340 créditos
```

---

### Para BOOKINGS (Reservar con créditos)

```
Credits_Per_Night = BASE_NIGHTLY_RATE × ROOM_MULTIPLIER × TIER_MULTIPLIER × LOCATION_MULTIPLIER
Total_Credits = Credits_Per_Night × Nights
```

**Valores Base Nocturnos:**
- `RED`: 150 créditos/noche
- `WHITE`: 90 créditos/noche
- `BLUE`: 45 créditos/noche

**Ejemplo:**
```
Reservar 7 noches en 2BR temporada RED en propiedad GOLD con location_multiplier 1.2:

Credits_Per_Night = 150 × 1.5 × 1.3 × 1.2 = 351 créditos/noche
Total_Credits = 351 × 7 = 2,457 créditos
```

---

## Conversión Créditos ↔ EUR

**Tasa de Conversión:** Configurable por admin (default: €0.10 por crédito)

```
1 crédito = €0.10
100 créditos = €10.00
1,000 créditos = €100.00
```

**Acceso a configuración:**
```sql
SELECT * FROM platform_settings WHERE setting_key = 'credit_to_eur_rate';
```

**API para obtener/actualizar:**
```typescript
// GET /api/public/credit-to-eur-rate
const rate = await CreditCalculationService.getCreditToEurRate();

// POST /api/admin/credit-to-eur-rate (requiere admin auth)
await CreditCalculationService.updateCreditToEurRate(0.12); // €0.12 por crédito
```

---

## Flujo de Pago Híbrido (Créditos + Stripe)

### Escenario

Usuario tiene **1,000 créditos** y quiere reservar una semana que cuesta **1,200 créditos**.

### Cálculo

1. **Déficit de créditos:** `1,200 - 1,000 = 200 créditos`
2. **Equivalente en EUR:** `200 × €0.10 = €20.00`
3. **Pago híbrido:**
   - Usar: 1,000 créditos
   - Cobrar con Stripe: €20.00

### Implementación Backend

**Archivo:** `backend/src/services/CreditBookingService.ts`

```typescript
async bookWithCredits(request: BookingRequest): Promise<BookingResult> {
  return await sequelize.transaction(async (tx: Transaction) => {
    // 1. Reserve inventory item
    const reservation = await InventoryService.reserve(...);

    // 2. Validate payment
    const requiredCredits = item.credit_price;
    
    // 3. Deduct credits from wallet
    if (request.creditsToUse > 0) {
      await CreditWalletService.deduct(
        request.ownerId,
        request.creditsToUse,
        'BOOKING_PAYMENT',
        `Booking payment for inventory item #${request.inventoryItemId}`,
        tx
      );
    }

    // 4. Process cash payment if needed (NEW - INTEGRATED WITH STRIPE)
    let cashPaid = 0;
    let stripeChargeId: string | undefined;
    
    if (request.cashAmount && request.cashAmount > 0) {
      const owner = await User.findByPk(request.ownerId);
      const stripeService = new StripeService();

      // Get or create Stripe customer
      const customerId = await stripeService.getOrCreateCustomer(
        request.ownerId,
        owner.email,
        `${owner.first_name} ${owner.last_name}`
      );

      // Create and confirm payment intent
      const paymentIntent = await stripeService.createCreditMarketplacePaymentIntent({
        amount: request.cashAmount,
        currency: 'eur',
        customerId,
        paymentMethodId: request.stripePaymentMethodId,
        inventoryItemId: request.inventoryItemId,
        weekId: item.week_id,
        propertyId: item.property_id,
        creditsUsed: request.creditsToUse,
        description: `Hybrid payment for inventory #${request.inventoryItemId}`
      });

      cashPaid = request.cashAmount;
      stripeChargeId = paymentIntent.id;
    }

    // 5. Create booking record
    const booking = await Booking.create({
      property_id: item.property_id,
      payment_method: request.paymentType === 'credits_only' ? 'CREDITS' : 'HYBRID',
      total_amount: cashPaid,
      payment_status: 'paid',
      payment_intent_id: stripeChargeId,
      raw: {
        credits_used: creditsUsed,
        cash_amount: cashPaid,
        inventory_item_id: request.inventoryItemId
      }
    }, { transaction: tx });

    // 6. Confirm inventory sale
    await InventoryService.confirmBooking(...);

    return { booking, creditsUsed, cashPaid, ... };
  });
}
```

### Nuevo Método en StripeService

**Archivo:** `backend/src/services/stripeService.ts`

```typescript
/**
 * Crear Payment Intent para pagos híbridos del marketplace de créditos
 */
async createCreditMarketplacePaymentIntent(params: {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  inventoryItemId: number;
  weekId?: number | null;
  propertyId: number;
  creditsUsed: number;
  description: string;
}) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100), // Convert to cents
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    confirm: true, // Confirm immediately
    off_session: true, // For saved payment methods
    description: params.description,
    metadata: {
      type: 'credit_marketplace_hybrid',
      inventory_item_id: params.inventoryItemId.toString(),
      week_id: params.weekId?.toString() || '',
      property_id: params.propertyId.toString(),
      credits_used: params.creditsUsed.toString(),
      cash_amount: params.amount.toString()
    },
    return_url: `${process.env.FRONTEND_URL}/marketplace/booking-success`
  });

  // Check if payment succeeded
  if (paymentIntent.status !== 'succeeded') {
    throw new Error(`Payment failed with status: ${paymentIntent.status}`);
  }

  return paymentIntent;
}
```

---

## Frontend: UX de Selección de Pago

### Componente: CreditPaymentOption

**Archivo:** `frontend/src/components/marketplace/CreditPaymentOption.tsx`

**Características:**

1. **Muestra balance de créditos** en tiempo real
2. **Calcula créditos requeridos** usando backend (Master Formula)
3. **Detecta automáticamente déficit** de créditos
4. **Ofrece pago híbrido** cuando no hay suficientes créditos
5. **Usa tasa de conversión** configurable por admin

**Flujo Visual:**

```
┌─────────────────────────────────────────┐
│  💰 Pagar con Créditos                  │
├─────────────────────────────────────────┤
│                                         │
│  Tus Créditos: 1,000                   │
│  Se Requieren: 1,200                   │
│                                         │
│  ⚠️ Faltan 200 créditos (€20.00)      │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ ✨ Usar 1,000 créditos            │ │
│  │ 💳 Pagar €20.00 con tarjeta      │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Confirmar Pago Híbrido]              │
└─────────────────────────────────────────┘
```

**Código Clave:**

```typescript
// Fetch credit calculation from backend (Master Formula)
const { data: creditCalculation } = useQuery({
  queryKey: ['credit-calculation', propertyId, roomId, checkIn, checkOut],
  queryFn: () => timeshareApi.calculateCreditCost({
    propertyId: parseInt(propertyId),
    roomId: parseInt(roomId),
    checkIn,
    checkOut
  }),
  staleTime: 60000 // 1 minute
});

// Fetch conversion rate from backend
const { data: creditToEurRate } = useQuery({
  queryKey: ['credit-to-eur-rate'],
  queryFn: timeshareApi.getCreditToEurRate,
  staleTime: 30000 // 30 seconds
});

const creditsRequired = creditCalculation?.creditsRequired || 0;
const totalBalance = wallet?.wallet?.totalBalance ?? 0;
const hasEnoughCredits = totalBalance >= creditsRequired;
const creditDeficit = creditsRequired - totalBalance;

// Calculate EUR deficit
const conversionRate = creditToEurRate || 0.10;
const deficitInEUR = creditDeficit > 0 
  ? Math.ceil(creditDeficit * conversionRate) 
  : 0;
```

---

## Página de Checkout: CreditCheckoutPage

**Archivo:** `frontend/src/pages/marketplace/CreditCheckoutPage.tsx`

**Mejoras Implementadas:**

1. **Opciones de pago automáticas:**
   - Opción 1: Créditos completos (si hay suficientes)
   - Opción 2: Créditos + Tarjeta (si hay déficit)
   - Opción 3: Solo tarjeta (sin usar créditos)

2. **Reserva temporal:** 15 minutos para completar checkout

3. **Temporizador visible:** Countdown en tiempo real

4. **Integración con Stripe:**
   - Métodos de pago guardados
   - Formulario de nueva tarjeta (Stripe Elements)
   - Confirmación automática

**Flujo:**

```
1. Usuario selecciona item → Redirige a /marketplace/checkout/:itemId
2. Backend crea reserva temporal (15 min)
3. Frontend carga:
   - Detalles del item
   - Balance de créditos
   - Opciones de pago calculadas
4. Usuario selecciona opción de pago
5. Si hay cashAmount > 0:
   - Mostrar selector de método de pago Stripe
   - Confirmar Payment Intent
6. Crear booking con creditsUsed + cashPaid
7. Redirigir a confirmación
```

---

## Endpoints API

### Calcular Costo en Créditos

```http
POST /api/timeshare/calculate-credit-cost
Content-Type: application/json

{
  "propertyId": 1,
  "roomId": 5,
  "checkIn": "2026-06-15",
  "checkOut": "2026-06-22"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "creditsRequired": 2457,
    "creditsPerNight": 351,
    "totalAmountEUR": 245.70,
    "pricePerNightEUR": 35.10,
    "nights": 7,
    "season": "RED",
    "roomType": "DELUXE",
    "breakdown": {
      "baseRate": 150,
      "tierMultiplier": 1.3,
      "locationMultiplier": 1.2,
      "roomTypeMultiplier": 1.5,
      "propertyTier": "GOLD",
      "seasonType": "RED"
    }
  }
}
```

### Obtener Tasa de Conversión

```http
GET /api/public/credit-to-eur-rate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rate": 0.10
  }
}
```

### Reservar con Créditos (Híbrido)

```http
POST /api/marketplace/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "inventoryItemId": 42,
  "paymentType": "credits_plus_cash",
  "creditsToUse": 1000,
  "cashAmount": 20.00,
  "stripePaymentMethodId": "pm_card_visa"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking confirmed!",
  "data": {
    "bookingId": 123,
    "creditsUsed": 1000,
    "cashPaid": 20.00,
    "walletBalance": 0
  }
}
```

---

## Configuración Admin

### Actualizar Tasa de Conversión

**UI Admin Panel:**
```
Settings → Platform Settings → Credit System

Credit to EUR Rate: [0.10] EUR per credit
```

**Backend:**
```typescript
// POST /api/admin/credit-to-eur-rate
await CreditCalculationService.updateCreditToEurRate(0.12);
```

**SQL Directo:**
```sql
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description)
VALUES ('credit_to_eur_rate', '0.12', 'NUMBER', 'EUR value per credit')
ON DUPLICATE KEY UPDATE setting_value = '0.12';
```

---

## Testing

### Test Case 1: Pago 100% Créditos

```typescript
test('Should book with full credits when user has enough', async () => {
  // Setup: User has 2,500 credits, item costs 2,400 credits
  const booking = await CreditBookingService.bookWithCredits({
    inventoryItemId: 1,
    ownerId: userId,
    paymentType: 'credits_only',
    creditsToUse: 2400,
    cashAmount: 0
  });

  expect(booking.creditsUsed).toBe(2400);
  expect(booking.cashPaid).toBe(0);
  expect(booking.walletBalanceAfter).toBe(100); // 2500 - 2400
});
```

### Test Case 2: Pago Híbrido

```typescript
test('Should book with hybrid payment when credits insufficient', async () => {
  // Setup: User has 1,000 credits, item costs 1,200 credits
  // Conversion rate: €0.10/credit → deficit = 200 credits = €20
  
  const booking = await CreditBookingService.bookWithCredits({
    inventoryItemId: 1,
    ownerId: userId,
    paymentType: 'credits_plus_cash',
    creditsToUse: 1000,
    cashAmount: 20.00,
    stripePaymentMethodId: 'pm_test_card'
  });

  expect(booking.creditsUsed).toBe(1000);
  expect(booking.cashPaid).toBe(20.00);
  expect(booking.walletBalanceAfter).toBe(0);
  expect(booking.booking.payment_method).toBe('HYBRID');
});
```

### Test Case 3: Cálculo con Fórmula Maestra

```typescript
test('Should calculate credits correctly using Master Formula', async () => {
  // Property: GOLD tier, location_multiplier 1.2
  // Room: 2BR (DELUXE - multiplier 1.5)
  // Season: RED
  // Nights: 7
  
  const calculation = await CreditCalculationService.calculateBookingCost(
    propertyId: 1,
    roomType: 'DELUXE',
    seasonType: 'RED',
    nights: 7
  );

  // Expected: 150 × 1.5 × 1.3 × 1.2 = 351 credits/night × 7 = 2,457 credits
  expect(calculation.creditsPerNight).toBe(351);
  expect(calculation.totalCredits).toBe(2457);
});
```

---

## Próximos Pasos

### ✅ Completado

- [x] Integración Stripe con pagos híbridos
- [x] Cálculo preciso con Fórmula Maestra
- [x] Tasa de conversión configurable
- [x] Endpoint para calcular créditos requeridos
- [x] Frontend con detección automática de déficit

### 🔄 En Progreso

- [ ] Mejorar UX del selector de método de pago Stripe
- [ ] Añadir validación de monto en frontend antes de confirmar
- [ ] Toast notifications más descriptivos

### 📋 Pendiente

- [ ] Panel admin para ajustar tasas de conversión
- [ ] Historial de pagos híbridos en dashboard owner
- [ ] Reportes de revenue por tipo de pago (credits vs cash)
- [ ] Refunds automáticos en cancelaciones
- [ ] Tests E2E completos del flujo de pago

---

## Notas Técnicas

### Seguridad

- Payment Intent se confirma **off_session** con tarjeta guardada
- Transacción DB envuelve: reserva → pago → booking → confirmación
- Rollback automático si falla cualquier paso
- Metadata de Stripe incluye referencias para auditoría

### Performance

- Cálculos de créditos cacheados (5 min)
- Conversión rate cacheado (30 seg)
- Reservas temporales con TTL (15 min)
- Query optimization con indexes en `inventory_items`

### Escalabilidad

- Sistema preparado para múltiples divisas (EUR, USD, GBP)
- Fórmula maestra parametrizable por admin
- Stripe Webhooks para confirmaciones asíncronas
- Queue system ready para procesar pagos batch

---

**Documento creado por:** Sistema de Refinación Marketplace  
**Última actualización:** 3 de Febrero de 2026
