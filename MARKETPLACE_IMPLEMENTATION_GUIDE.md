# Guía de Implementación - Marketplace Refinado

**Para:** Equipo de Desarrollo  
**Tarea:** Integrar sistema de pagos híbridos refinado  
**Tiempo estimado:** 2-3 horas

---

## 📋 Pre-requisitos

Antes de empezar, asegúrate de tener:

- [x] Stripe configurado (`STRIPE_SECRET_KEY` en `.env`)
- [x] Stripe Publishable Key en frontend (`VITE_STRIPE_PUBLISHABLE_KEY`)
- [x] Base de datos actualizada con tablas V2
- [x] `platform_settings` table con `credit_to_eur_rate`

---

## 🚀 Paso 1: Verificar Backend (5 min)

### 1.1 Verificar StripeService actualizado

```bash
cd backend
cat src/services/stripeService.ts | grep "createCreditMarketplacePaymentIntent"
```

**Debería mostrar:** El nuevo método implementado

### 1.2 Verificar CreditBookingService actualizado

```bash
cat src/services/CreditBookingService.ts | grep "stripeService.createCreditMarketplacePaymentIntent"
```

**Debería mostrar:** La llamada al método de Stripe

### 1.3 Test rápido del backend

```typescript
// backend/src/test-hybrid-payment.ts
import CreditCalculationService from './services/CreditCalculationService';

async function testRefinedSystem() {
  // 1. Get conversion rate
  const rate = await CreditCalculationService.getCreditToEurRate();
  console.log('✅ Conversion rate:', rate);

  // 2. Calculate hybrid payment
  const hybrid = await CreditCalculationService.calculateHybridPayment(1000, 1200);
  console.log('✅ Hybrid calculation:', hybrid);
  // Expected: { creditsUsed: 1000, cashRequired: 20, creditShortfall: 200 }

  console.log('✅ Backend ready!');
}

testRefinedSystem();
```

Ejecutar:
```bash
npm run ts-node src/test-hybrid-payment.ts
```

---

## 🎨 Paso 2: Integrar Frontend (30 min)

### 2.1 Copiar componentes nuevos

Los archivos ya están creados en:
- `frontend/src/components/marketplace/HybridPaymentSelector.tsx`
- `frontend/src/pages/marketplace/RefinedCreditCheckoutPage.tsx`

**No action needed - ya están listos para usar.**

### 2.2 Instalar dependencias de Stripe (si no están)

```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 2.3 Actualizar rutas

**Archivo:** `frontend/src/App.tsx` o tu archivo de rutas

```tsx
import { RefinedCreditCheckoutPage } from '@/pages/marketplace/RefinedCreditCheckoutPage';

// En tus rutas:
<Route path="/marketplace/checkout/:itemId" element={<RefinedCreditCheckoutPage />} />
```

### 2.4 Actualizar botón de checkout en marketplace

**Archivo:** `frontend/src/pages/marketplace/MarketplacePage.tsx` (o similar)

```tsx
// Antes:
<button onClick={() => navigate(`/marketplace/old-checkout/${item.id}`)}>
  Reservar
</button>

// Después:
<button onClick={() => navigate(`/marketplace/checkout/${item.id}`)}>
  Reservar
</button>
```

---

## 🔧 Paso 3: Configurar Tasa de Conversión (5 min)

### Opción A: SQL Directo

```sql
INSERT INTO platform_settings (
  setting_key, 
  setting_value, 
  setting_type,
  description
) VALUES (
  'credit_to_eur_rate',
  '0.10',
  'NUMBER',
  'EUR value per credit for hybrid payment calculations'
) ON DUPLICATE KEY UPDATE 
  setting_value = '0.10';
```

### Opción B: Via API (requiere crear endpoint admin)

```typescript
// POST /api/admin/credit-to-eur-rate
{
  "rate": 0.10
}
```

### Verificar configuración:

```bash
# Backend
npm run ts-node -e "
import CreditCalculationService from './src/services/CreditCalculationService';
CreditCalculationService.getCreditToEurRate().then(rate => console.log('Rate:', rate));
"
```

---

## ✅ Paso 4: Testing (45 min)

### 4.1 Test Manual - Flujo Completo

#### Escenario 1: Pago 100% Créditos

1. **Setup:**
   - Usuario con 2,000 créditos
   - Item de 1,500 créditos

2. **Pasos:**
   ```
   a. Login como owner con suficientes créditos
   b. Ir a marketplace → Seleccionar item
   c. Click "Reservar" → Redirige a checkout
   d. Verificar:
      - Balance: 2,000 créditos disponibles
      - Requeridos: 1,500 créditos
      - Opción "Solo Créditos" seleccionada por defecto
      - NO se muestra formulario de Stripe
   e. Click "Confirmar Pago con Créditos"
   f. Verificar:
      - Toast: "¡Reserva confirmada!"
      - Redirige a /bookings/:id
      - Balance actualizado: 500 créditos
   ```

#### Escenario 2: Pago Híbrido (Créditos + Stripe)

1. **Setup:**
   - Usuario con 1,000 créditos
   - Item de 1,200 créditos
   - Stripe test card: `4242 4242 4242 4242`

2. **Pasos:**
   ```
   a. Login como owner con créditos insuficientes
   b. Ir a marketplace → Seleccionar item
   c. Click "Reservar" → Redirige a checkout
   d. Verificar:
      - Balance: 1,000 créditos disponibles
      - Requeridos: 1,200 créditos
      - Alerta: "⚠️ Faltan 200 créditos (€20.00)"
      - Opción "Créditos + Tarjeta" seleccionada
      - Muestra: "✨ Usar 1,000 créditos"
      - Muestra: "💳 Pagar €20.00 con tarjeta"
   e. Se muestra formulario Stripe Elements
   f. Ingresar datos de tarjeta:
      - Número: 4242 4242 4242 4242
      - Expiry: 12/34
      - CVC: 123
   g. Click "Pagar €20.00"
   h. Verificar:
      - Toast: "¡Reserva confirmada!"
      - Redirige a /bookings/:id
      - Balance actualizado: 0 créditos
   ```

#### Escenario 3: Cálculo de Créditos con Fórmula Maestra

1. **Setup:**
   - Property: GOLD tier, location_multiplier = 1.2
   - Room: 2BR (DELUXE)
   - Season: RED
   - Nights: 7

2. **Verificar cálculo:**
   ```
   Expected:
   BASE_NIGHTLY_RATE = 150
   ROOM_MULTIPLIER = 1.5 (DELUXE)
   TIER_MULTIPLIER = 1.3 (GOLD)
   LOCATION_MULTIPLIER = 1.2
   
   Credits_Per_Night = 150 × 1.5 × 1.3 × 1.2 = 351
   Total_Credits = 351 × 7 = 2,457
   ```

3. **Pasos:**
   ```
   a. En checkout, verificar breakdown:
      - "Por noche: 351 créditos"
      - "7 noches: 2,457 créditos"
      - "Temporada: RED"
      - "Tipo: DELUXE"
   b. Verificar conversión (si aplica):
      - Deficit: 457 créditos
      - EUR: €45.70 (con rate 0.10)
   ```

### 4.2 Test con Console Logs

Abrir DevTools → Console y verificar logs:

```javascript
// Debe mostrar:
🔍 creditToEurRate from API: 0.10
💰 CreditPaymentOption Conversion: {
  creditToEurRate: 0.10,
  conversionRate: 0.10,
  creditDeficit: 200,
  deficitInEUR: 20,
  calculation: "200 × 0.10 = 20"
}
```

### 4.3 Test de Errores

#### Error 1: Tarjeta rechazada

```
Card: 4000 0000 0000 0002
Expected: Toast "Payment failed with status: requires_payment_method"
```

#### Error 2: Reserva expirada

```
1. Iniciar checkout
2. Esperar 15+ minutos
3. Expected: Toast "Tu reserva temporal ha expirado" + redirect
```

#### Error 3: Item no disponible

```
1. Usuario A reserva item
2. Usuario B intenta reservar mismo item
3. Expected: Error "Inventory item is not available"
```

---

## 🐛 Troubleshooting

### Problema: "creditToEurRate is undefined"

**Causa:** Configuración no existe en DB

**Solución:**
```sql
INSERT INTO platform_settings (setting_key, setting_value, setting_type)
VALUES ('credit_to_eur_rate', '0.10', 'NUMBER');
```

### Problema: "Stripe is not defined"

**Causa:** Publishable key no configurada

**Solución:**
```env
# frontend/.env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Problema: "Payment failed with status: requires_payment_method"

**Causa:** Payment Intent falló

**Solución:**
1. Verificar Stripe secret key válida
2. Usar test card válida: `4242 4242 4242 4242`
3. Verificar logs en Stripe Dashboard

### Problema: "Booking creation failed"

**Causa:** Transacción rollback

**Solución:**
1. Check backend logs
2. Verificar FK constraints
3. Verificar `payment_intent_id` en bookings table

---

## 📊 Verificación Final

### Checklist de Funcionalidad

- [ ] ✅ Pago 100% créditos funciona
- [ ] ✅ Pago híbrido (créditos + Stripe) funciona
- [ ] ✅ Cálculo de créditos correcto (Master Formula)
- [ ] ✅ Tasa de conversión se aplica correctamente
- [ ] ✅ Balance de créditos se actualiza
- [ ] ✅ Booking se crea en DB
- [ ] ✅ Reserva temporal expira correctamente
- [ ] ✅ Errores de Stripe se manejan bien
- [ ] ✅ Toast notifications funcionan
- [ ] ✅ Redirección post-booking funciona

### Verificación en Base de Datos

```sql
-- 1. Verificar booking creado
SELECT 
  id, 
  payment_method, 
  total_amount,
  payment_status,
  payment_intent_id,
  JSON_EXTRACT(raw, '$.credits_used') as credits_used,
  JSON_EXTRACT(raw, '$.cash_amount') as cash_amount
FROM bookings 
WHERE id = [BOOKING_ID];

-- Expected (pago híbrido):
-- payment_method: 'HYBRID'
-- total_amount: 20.00
-- credits_used: 1000
-- cash_amount: 20.00

-- 2. Verificar transacción de créditos
SELECT * FROM credit_transactions 
WHERE user_id = [USER_ID]
ORDER BY created_at DESC 
LIMIT 5;

-- Expected:
-- type: 'BOOKING_PAYMENT'
-- amount: -1000 (negative = debit)
-- balance_after: [updated balance]

-- 3. Verificar Stripe payment intent
-- Ir a Stripe Dashboard → Payments
-- Buscar payment_intent_id
-- Verificar status: 'succeeded'
-- Verificar metadata: credits_used, inventory_item_id, etc.
```

---

## 🎉 ¡Listo para Producción!

Si todos los tests pasan, el sistema está listo para:

1. **Deploy a staging** para QA final
2. **Load testing** con múltiples usuarios simultáneos
3. **Security audit** de flujo de pagos
4. **Deploy a producción**

---

## 📞 Siguiente Paso: Admin Panel

Crear panel admin para configurar tasa de conversión:

**Archivo:** `frontend/src/pages/admin/PlatformSettings.tsx`

```tsx
<div className="setting-row">
  <label>Credit to EUR Conversion Rate</label>
  <input 
    type="number" 
    step="0.01"
    value={creditToEurRate}
    onChange={(e) => setCreditToEurRate(parseFloat(e.target.value))}
  />
  <button onClick={updateRate}>Save</button>
  <p className="help-text">
    1 credit = €{creditToEurRate.toFixed(2)}
  </p>
</div>
```

---

**Documento creado:** 3 de Febrero de 2026  
**Última actualización:** 3 de Febrero de 2026  
**Autor:** Sistema de Refinamiento Marketplace
