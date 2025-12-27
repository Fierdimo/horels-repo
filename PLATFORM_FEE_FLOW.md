# Flujo de Pagos con Comisión de Plataforma

## Resumen del Modelo

El sistema cobra al usuario el **costo normal del booking + un porcentaje de comisión**, pero solo transfiere el **costo normal** al PMS. La plataforma retiene el porcentaje de comisión.

```
Usuario paga: €100 (normal) + €12 (12% comisión) = €112 total
    ↓
Stripe recibe: €112
    ↓
PMS recibe: €100 (transfer)
    ↓
Plataforma retiene: €12 (comisión)
```

## Configuración

### 1. Platform Settings (Base de Datos)

```sql
-- tabla: platform_settings
setting_key: 'PLATFORM_FEE_PERCENTAGE'
setting_value: '12'
setting_type: 'NUMBER'
description: 'Platform commission percentage (e.g., 12 = 12%)'
```

**Configuración Actual**: 12%

Este valor es configurable desde:
- Base de datos directamente
- Panel de administración (futuro)
- Variable de entorno `EXTRA_CHARGE_PERCENT` como fallback

## Arquitectura del Sistema

### 1. Middleware: extraChargeMiddleware

**Archivo**: `backend/src/middleware/extraChargeMiddleware.ts`

**Función**:
- Se ejecuta antes de crear el Payment Intent
- Consulta el porcentaje de comisión desde `platform_settings`
- Calcula los montos:
  - `chargeAmountOriginal`: Costo base del booking (para PMS)
  - `chargeExtraFee`: Comisión de la plataforma
  - `chargeAmountWithFee`: Total a cobrar al usuario
- Inyecta estos valores en el `request` para uso posterior

**Ejemplo**:
```typescript
Request.body.amount = 100  // Costo base del booking

Middleware calcula:
- chargeAmountOriginal = 100      // Para PMS
- chargeExtraFee = 12              // Comisión 12%
- chargeAmountWithFee = 112        // Total al usuario
```

### 2. Campos en Booking Model

**Archivo**: `backend/src/models/Booking.ts`

**Nuevos Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `total_amount` | DECIMAL(10,2) | Monto total cobrado al usuario (base + comisión) |
| `platform_fee_amount` | DECIMAL(10,2) | Monto de la comisión (en EUR) |
| `platform_fee_percentage` | DECIMAL(5,2) | Porcentaje aplicado (ej: 12.00) |
| `pms_transfer_amount` | DECIMAL(10,2) | Monto a transferir al PMS (base) |
| `pms_transfer_status` | ENUM | Estado: pending / transferred / failed |
| `pms_transfer_id` | STRING | ID del Stripe Transfer |
| `pms_transfer_date` | DATE | Fecha del transfer al PMS |

### 3. Flujo de Creación de Booking (Marketplace)

**Secuencia**:

```
1. Usuario selecciona propiedad y fechas en Marketplace
    ↓
2. Frontend calcula costo base: €100
    ↓
3. POST /api/payments/intent
   Body: { amount: 100, currency: 'eur', type: 'hotel_payment' }
    ↓
4. extraChargeMiddleware se ejecuta:
   - Lee PLATFORM_FEE_PERCENTAGE de DB (12%)
   - Calcula: fee = 100 * 0.12 = 12
   - Calcula: totalWithFee = 100 + 12 = 112
   - Inyecta en request: { amountWithFee: 112, original: 100, fee: 12 }
    ↓
5. stripeController.createPaymentIntent:
   - Crea Payment Intent en Stripe por €112
   - Metadata incluye: { originalAmount: 100, extraFee: 12 }
    ↓
6. Frontend muestra:
   - Subtotal: €100
   - Platform Fee (12%): €12
   - Total: €112
    ↓
7. Usuario confirma pago con tarjeta
    ↓
8. Stripe procesa pago de €112
    ↓
9. Webhook: payment_intent.succeeded
    ↓
10. Backend crea/actualiza Booking:
    - total_amount = 112
    - platform_fee_amount = 12
    - platform_fee_percentage = 12.00
    - pms_transfer_amount = 100
    - pms_transfer_status = 'pending'
    - payment_status = 'paid'
    ↓
11. (Futuro) Proceso automático o manual transfiere €100 al PMS
    - Stripe Transfer API
    - Actualiza: pms_transfer_status = 'transferred'
    - Actualiza: pms_transfer_id = 'tr_xxx'
    - Actualiza: pms_transfer_date = NOW()
```

## Implementación de Transfers al PMS

### Opción A: Stripe Connect (Recomendado)

Para transferir fondos al PMS usando Stripe Connect:

```typescript
// Cuando el booking es confirmado
const transfer = await stripe.transfers.create({
  amount: booking.pms_transfer_amount * 100, // En centavos
  currency: 'eur',
  destination: pmsStripeAccountId, // Cuenta Connect del PMS
  transfer_group: `booking_${booking.id}`,
  metadata: {
    booking_id: booking.id,
    property_id: booking.property_id
  }
});

// Actualizar booking
await booking.update({
  pms_transfer_id: transfer.id,
  pms_transfer_status: 'transferred',
  pms_transfer_date: new Date()
});
```

### Opción B: Payout Manual

Para PMSs sin Stripe Connect:
1. Acumular transfers pendientes
2. Proceso batch diario/semanal
3. Payout a cuenta bancaria del PMS
4. Actualizar status manualmente

## Endpoints Afectados

### 1. POST /api/payments/intent
```typescript
// Request
{
  "amount": 100,         // Costo base
  "currency": "eur",
  "type": "hotel_payment",
  "metadata": {
    "booking_id": "123",
    "property_id": "45"
  }
}

// Response (después de middleware)
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentIntentId": "pi_xxx",
    "amount": 112,        // Total con fee
    "originalAmount": 100, // Base
    "extraFee": 12        // Comisión
  }
}
```

### 2. GET /api/dashboard/bookings
```typescript
// Response incluye:
{
  "bookings": [{
    "id": 1,
    "total_amount": 112.00,
    "platform_fee_amount": 12.00,
    "platform_fee_percentage": 12.00,
    "pms_transfer_amount": 100.00,
    "pms_transfer_status": "pending",
    "payment_status": "paid"
  }]
}
```

### 3. GET /api/client/payments
```typescript
// Response para usuarios
{
  "payments": [{
    "id": 1,
    "booking_id": 1,
    "amount": 112.00,      // Total pagado por usuario
    "status": "completed",
    "Booking": {
      "Property": { "name": "Hotel Paradise" }
    }
  }]
}
```

## Frontend: Mostrar Desglose de Pago

### Marketplace Checkout

```tsx
// En el checkout, mostrar desglose claro:
<div className="border-t pt-4">
  <div className="flex justify-between text-gray-600">
    <span>Booking Cost</span>
    <span>€{baseAmount.toFixed(2)}</span>
  </div>
  <div className="flex justify-between text-gray-600">
    <span>Platform Fee (12%)</span>
    <span>€{platformFee.toFixed(2)}</span>
  </div>
  <div className="flex justify-between text-lg font-bold mt-2 border-t pt-2">
    <span>Total</span>
    <span>€{totalAmount.toFixed(2)}</span>
  </div>
</div>
```

### Payment History (Guest)

El usuario solo ve el total pagado (€112), no el desglose interno.

## Reportes y Analytics

### Para Administradores

Crear dashboard con:
- Total revenue (suma de platform_fee_amount)
- Transfers pendientes al PMS
- Transfers completados
- Comisión promedio
- Revenue por propiedad

### Query de Ejemplo

```sql
-- Total de comisiones del mes
SELECT 
  SUM(platform_fee_amount) as total_commission,
  COUNT(*) as total_bookings,
  AVG(platform_fee_percentage) as avg_percentage
FROM bookings
WHERE payment_status = 'paid'
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

-- Transfers pendientes al PMS
SELECT 
  property_id,
  COUNT(*) as pending_transfers,
  SUM(pms_transfer_amount) as total_pending
FROM bookings
WHERE pms_transfer_status = 'pending'
  AND payment_status = 'paid'
GROUP BY property_id;
```

## Migración de Datos Existentes

Para bookings existentes sin fee data:

```sql
-- Calcular y poblar fees retroactivamente
UPDATE bookings
SET 
  platform_fee_percentage = 12.00,
  platform_fee_amount = ROUND(total_amount * 0.12 / 1.12, 2),
  pms_transfer_amount = ROUND(total_amount / 1.12, 2),
  pms_transfer_status = CASE 
    WHEN payment_status = 'paid' THEN 'pending'
    ELSE NULL
  END
WHERE payment_status = 'paid'
  AND platform_fee_amount IS NULL;
```

## Testing

### 1. Test del Middleware

```typescript
// Test que el middleware calcula correctamente
it('should calculate 12% platform fee', async () => {
  const req = { body: { amount: 100 } };
  await extraChargeMiddleware(req, res, next);
  
  expect(req.chargeAmountOriginal).toBe(100);
  expect(req.chargeExtraFee).toBe(12);
  expect(req.chargeAmountWithFee).toBe(112);
});
```

### 2. Test de Payment Intent

```typescript
// Test que Payment Intent se crea con monto correcto
it('should create payment intent with fee', async () => {
  const response = await request(app)
    .post('/api/payments/intent')
    .send({ amount: 100, currency: 'eur', type: 'hotel_payment' });
  
  expect(response.body.data.amount).toBe(112);
  expect(response.body.data.originalAmount).toBe(100);
  expect(response.body.data.extraFee).toBe(12);
});
```

### 3. Test de Booking Creation

```typescript
// Test que booking guarda correctamente los fees
it('should save platform fee data', async () => {
  // Simular webhook de pago exitoso
  const booking = await Booking.findOne({ where: { payment_intent_id: 'pi_test' } });
  
  expect(booking.total_amount).toBe(112);
  expect(booking.platform_fee_amount).toBe(12);
  expect(booking.pms_transfer_amount).toBe(100);
  expect(booking.pms_transfer_status).toBe('pending');
});
```

## Checklist de Implementación

- [x] Crear migración para PLATFORM_FEE_PERCENTAGE setting
- [x] Crear migración para campos de fee en bookings
- [x] Actualizar PlatformSetting model (ya existe)
- [x] Actualizar Booking model con nuevos campos
- [x] Actualizar extraChargeMiddleware para usar DB
- [x] Documentar flujo completo
- [ ] Ejecutar migraciones en DB
- [ ] Actualizar stripeController para guardar fee data
- [ ] Actualizar webhook handler para guardar fee en booking
- [ ] Implementar Stripe Transfer al PMS (futuro)
- [ ] Crear dashboard de analytics de comisiones
- [ ] Actualizar frontend checkout para mostrar desglose
- [ ] Tests unitarios y de integración

## Siguientes Pasos

1. **Ejecutar migraciones**:
   ```bash
   cd backend
   npx sequelize-cli db:migrate
   ```

2. **Verificar setting**:
   ```sql
   SELECT * FROM platform_settings WHERE setting_key = 'PLATFORM_FEE_PERCENTAGE';
   ```

3. **Actualizar webhook handler** para guardar fees al crear booking

4. **Probar flujo completo** en marketplace

5. **Implementar transfer al PMS** cuando sea necesario
