# Sistema Unificado: Tres Flujos Sin Conflictos

## 🎯 Tres Casos de Uso Diferentes

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATAFORMA SWORLD                            │
├─────────────────┬───────────────────┬───────────────────────────┤
│                 │                   │                           │
│  🔄 TIMESHARE   │  🌙 NIGHT CREDITS │   📦 MARKETPLACE         │
│  (Week Swaps)   │  (Use Credits)    │   (Room Rentals)         │
│                 │                   │                           │
└─────────────────┴───────────────────┴───────────────────────────┘
```

---

## 1️⃣ TIMESHARE SWAPS (Intercambio de Semanas)

### **Quién**: Owner A ↔ Owner B
### **Qué**: Intercambio completo de semanas (7 días)
### **Cuándo cobra**: Solo si swap exitoso (€10 fee)
### **Requiere**: Match entre owners

### **Flujo:**
```
Owner A solicita swap Semana 20 → Semana 35
    ↓
Sistema encuentra match (o staff asigna)
    ↓
Ambos owners confirman
    ↓
Owner A paga €10 fee
    ↓
Swap se ejecuta: semanas intercambiadas
```

### **No genera conflictos con marketplace porque:**
- Solo intercambia semanas completas
- No afecta disponibilidad de habitaciones individuales
- Las semanas intercambiadas cambian de owner pero siguen siendo "weeks"

---

## 2️⃣ NIGHT CREDITS (Uso de Créditos)

### **Quién**: Owner (convirtió semana → créditos)
### **Qué**: Usar créditos para reservar noches
### **Cuándo cobra**: ❌ NO se cobra (owner ya pagó cuando compró semana original)
### **Requiere**: Aprobación de staff + disponibilidad

### **Flujo Original (Ya existe en código):**
```
Owner convierte Semana 20 (red) → 6 créditos nocturnos
    ↓
Owner solicita usar 3 créditos en Hotel X
    ↓
Sistema verifica: ¿hay disponibilidad?
    ↓
SI disponible → Crea booking automático
    ↓
Créditos: 6 → 3 restantes
```

### **⚠️ PROBLEMA IDENTIFICADO:**
El código actual crea booking **inmediatamente** sin aprobación de staff. Esto puede causar conflictos con el marketplace si la habitación no está realmente disponible.

### **✅ FLUJO MEJORADO (Con aprobación de staff):**
```
Owner solicita usar 3 créditos
    ↓
Crea "night_credit_request" (estado: 'pending')
    ↓
Staff del hotel REVISA disponibilidad real
    ↓
Staff APRUEBA → Crea booking + descuenta créditos
    ↓
Staff RECHAZA → Créditos no se descuentan
```

### **No genera conflictos porque:**
- Staff verifica disponibilidad real antes de aprobar
- Una vez aprobado, el booking bloquea la habitación en ambos sistemas
- Si no hay disponibilidad, se rechaza (créditos siguen activos)

---

## 3️⃣ MARKETPLACE (Compra Directa de Habitaciones)

### **Quién**: Guest (sin propiedad) u Owner (comprando noches extras)
### **Qué**: Reserva de habitaciones individuales por noche
### **Cuándo cobra**: Siempre (comisión 12%)
### **Requiere**: Solo disponibilidad

### **Flujo:**
```
Usuario busca habitación en Hotel X (3 noches)
    ↓
Ve precio: €300 (hotel: €268, comisión: €32)
    ↓
Paga inmediatamente con Stripe
    ↓
Booking creado automáticamente
    ↓
Hotel recibe payout
```

### **No genera conflictos porque:**
- Solo muestra habitaciones realmente disponibles
- Verifica que no haya bookings activos ni weeks bloqueadas
- Una vez reservado, bloquea disponibilidad para todos

---

## 🔗 TU IDEA: Combinar Night Credits + Marketplace

### **Caso de Uso:**
> Owner tiene 3 créditos nocturnos pero quiere quedarse 5 noches

### **Flujo Híbrido Propuesto:**

**OPCIÓN A: Dos reservas separadas**
```
1. Owner solicita usar 3 créditos (días 1-3)
   → Staff aprueba → Booking A (gratis)
   
2. Owner compra 2 noches adicionales en marketplace (días 4-5)
   → Paga €200 → Booking B (con comisión)
   
Resultado: 2 bookings diferentes pero consecutivos
```

**OPCIÓN B: Booking unificado (Recomendado)**
```
1. Owner solicita 5 noches en total
   → Indica: "Usar 3 créditos + comprar 2 noches"
   
2. Sistema calcula:
   - Días 1-3: Gratis (usa créditos)
   - Días 4-5: €200 (marketplace)
   - Total a pagar: €200
   
3. Staff aprueba todo junto
   
4. Owner paga €200
   
5. Sistema crea:
   - 1 booking unificado (5 noches)
   - Descuenta 3 créditos
   - Cobra €200 (hotel recibe €178, plataforma €22)
```

---

## 🗄️ Nueva Tabla: `night_credit_requests`

```sql
CREATE TABLE night_credit_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Quién solicita
  owner_id INT NOT NULL,
  credit_id INT NOT NULL,  -- Qué crédito usa
  
  -- Qué solicita
  property_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights_requested INT NOT NULL,
  room_type VARCHAR(50),
  
  -- Estado de aprobación
  status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  reviewed_by_staff_id INT NULL,
  review_date TIMESTAMP NULL,
  staff_notes TEXT NULL,
  
  -- Extensión marketplace (opcional)
  additional_nights INT DEFAULT 0,  -- Noches que comprará en marketplace
  additional_price DECIMAL(10,2) DEFAULT 0.00,
  payment_intent_id VARCHAR(255) NULL,
  
  -- Booking resultante
  booking_id INT NULL,  -- Se llena cuando se aprueba
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 📋 Flujo Completo: Night Credits con Aprobación

### **Fase 1: Owner solicita (Frontend)**

```javascript
// Owner tiene 6 créditos, quiere 8 noches
POST /hotels/owner/night-credits/requests
{
  creditId: 123,
  propertyId: 5,
  checkIn: '2025-08-01',
  checkOut: '2025-08-09',  // 8 noches
  nightsRequested: 6,  // Usar 6 créditos
  additionalNights: 2,  // Comprar 2 noches extra
  roomType: 'deluxe'
}

// Respuesta
{
  success: true,
  message: 'Request submitted for staff approval',
  data: {
    requestId: 456,
    usingCredits: 6,
    buyingNights: 2,
    estimatedCost: 200.00,  // Solo las 2 noches extras
    status: 'pending'
  }
}
```

### **Fase 2: Staff revisa (Staff Dashboard)**

```javascript
GET /hotels/staff/night-credits/requests
// Lista todas las solicitudes pendientes

GET /hotels/staff/night-credits/requests/456
// Detalle de solicitud específica
{
  id: 456,
  owner: {
    name: 'John Doe',
    email: 'john@example.com',
    totalCredits: 6
  },
  request: {
    checkIn: '2025-08-01',
    checkOut: '2025-08-09',
    nightsWithCredits: 6,
    additionalNights: 2,
    roomType: 'deluxe'
  },
  availability: {
    available: true,
    roomsAvailable: 3,
    conflicts: []
  }
}

// Staff aprueba
PATCH /hotels/staff/night-credits/requests/456/approve
{
  staffNotes: 'Habitación deluxe confirmada'
}
```

### **Fase 3: Sistema ejecuta (Automático)**

```javascript
// 1. Si hay noches adicionales, crear Payment Intent
if (additionalNights > 0) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: additionalPrice * 100,
    currency: 'eur',
    customer: owner.stripe_customer_id,
    application_fee_amount: commission * 100,
    transfer_data: {
      destination: hotel.stripe_connect_account_id
    },
    metadata: {
      type: 'night_credit_extension',
      request_id: requestId,
      credit_nights: 6,
      paid_nights: 2
    }
  });
  
  // Enviar client_secret al owner para pagar
  notifyOwner({
    type: 'payment_required',
    amount: additionalPrice,
    clientSecret: paymentIntent.client_secret
  });
}

// 2. Cuando pago confirmado (o si no hay pago), crear booking
await createBookingFromCreditRequest({
  requestId: 456,
  creditId: 123,
  nightsUsed: 6,
  nightsPaid: 2,
  totalNights: 8
});

// 3. Actualizar créditos
await updateCredit({
  creditId: 123,
  remainingNights: 6 - 6 = 0,
  status: 'used'
});
```

---

## 🎯 Prevención de Conflictos

### **1. Conflicto: Habitación reservada en marketplace mientras se revisa crédito**

**Solución**: Bloqueo temporal
```javascript
// Cuando staff aprueba solicitud de crédito
async function approveNightCreditRequest(requestId) {
  // 1. Re-verificar disponibilidad
  const available = await checkRoomAvailability(propertyId, checkIn, checkOut);
  
  if (!available) {
    return { error: 'Room no longer available' };
  }
  
  // 2. Crear "soft lock" temporal (15 minutos para pagar)
  await createTemporaryHold({
    propertyId,
    checkIn,
    checkOut,
    type: 'night_credit_payment',
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  
  // 3. Proceder con pago/booking
}
```

### **2. Conflicto: Week de timeshare bloqueada mientras se usa crédito**

**Solución**: Validación cruzada
```javascript
// Antes de aprobar solicitud de crédito
async function validateNoCreditConflicts(propertyId, checkIn, checkOut) {
  // Verificar que no haya weeks activas en esas fechas
  const conflictingWeeks = await Week.findAll({
    where: {
      property_id: propertyId,
      start_date: { [Op.lte]: checkOut },
      end_date: { [Op.gte]: checkIn },
      status: { [Op.in]: ['available', 'confirmed'] }
    }
  });
  
  if (conflictingWeeks.length > 0) {
    throw new Error('Property has active weeks in this period');
  }
  
  // Verificar que no haya swap requests pendientes
  const conflictingSwaps = await SwapRequest.findAll({
    where: {
      property_id: propertyId,
      status: { [Op.in]: ['pending', 'matched'] }
    }
  });
  
  if (conflictingSwaps.length > 0) {
    throw new Error('Property has pending swap requests');
  }
}
```

### **3. Conflicto: Múltiples solicitudes de crédito simultáneas**

**Solución**: Idempotencia + locks
```javascript
// Al crear solicitud de crédito
async function createNightCreditRequest(ownerId, creditId, data) {
  // 1. Lock el crédito durante la solicitud
  const credit = await NightCredit.findByPk(creditId, {
    lock: true,
    transaction: t
  });
  
  // 2. Verificar que no haya otra solicitud activa con mismo crédito
  const existingRequest = await NightCreditRequest.findOne({
    where: {
      credit_id: creditId,
      status: 'pending'
    }
  });
  
  if (existingRequest) {
    throw new Error('You already have a pending request with this credit');
  }
  
  // 3. Crear nueva solicitud
  const request = await NightCreditRequest.create({...});
  
  return request;
}
```

---

## 📊 Dashboard: Vista Unificada para Staff

```javascript
GET /hotels/staff/dashboard
{
  pendingRequests: {
    swapRequests: 3,       // Timeshare swaps pendientes
    creditRequests: 5,     // Night credit requests pendientes
    marketplaceBookings: 0 // Marketplace es automático
  },
  
  availability: {
    totalRooms: 50,
    availableNow: 23,
    blockedByWeeks: 10,     // Habitaciones en weeks activas
    blockedByBookings: 17,  // Habitaciones con bookings
    softLocks: 2            // Locks temporales (aprobaciones pendientes)
  },
  
  revenue: {
    swapFees: 120.00,       // €10 × 12 swaps
    marketplaceCommission: 1560.00,  // 12% de €13,000
    extraNightsCommission: 240.00    // Noches extras vendidas
  }
}
```

---

## 🚀 Endpoints Necesarios (Night Credits con Aprobación)

### **Owner Endpoints**

```
# Solicitudes de crédito
POST   /hotels/owner/night-credits/requests        # Crear solicitud
GET    /hotels/owner/night-credits/requests        # Mis solicitudes
GET    /hotels/owner/night-credits/requests/:id    # Detalle

# Pago (si hay noches adicionales)
POST   /hotels/owner/night-credits/requests/:id/pay  # Pagar noches extras

# Créditos
GET    /hotels/owner/night-credits                 # Ver mis créditos
```

### **Staff Endpoints**

```
# Revisar solicitudes
GET    /hotels/staff/night-credits/requests        # Solicitudes pendientes
GET    /hotels/staff/night-credits/requests/:id    # Detalle con disponibilidad

# Aprobar/Rechazar
PATCH  /hotels/staff/night-credits/requests/:id/approve   # Aprobar
PATCH  /hotels/staff/night-credits/requests/:id/reject    # Rechazar

# Disponibilidad
GET    /hotels/staff/availability                  # Vista unificada (weeks + bookings + locks)
```

---

## ✅ Resumen de Flujos Sin Conflictos

| Flujo | Usuario | Requiere Aprobación | Pago | Bloquea Habitación | Puede Extender |
|-------|---------|---------------------|------|-------------------|----------------|
| **Timeshare Swap** | Owner A ↔ B | ✅ Staff ayuda match | €10 fee (si exitoso) | ❌ No (son weeks) | ❌ |
| **Night Credits** | Owner | ✅ Staff aprueba | ❌ Gratis (ya pagó) | ✅ Sí | ✅ Puede comprar extras |
| **Marketplace** | Guest/Owner | ❌ Automático | ✅ Siempre (con comisión) | ✅ Sí | ✅ Puede extender |

---

## 🎯 Ventajas de Este Sistema Unificado

1. **Sin conflictos**: Cada flujo valida disponibilidad antes de ejecutar
2. **Flexible**: Owner puede combinar créditos + marketplace
3. **Transparente**: Owner sabe exactamente qué paga y qué no
4. **Revenue óptimo**: Plataforma monetiza swaps, extras y marketplace
5. **Staff control**: Staff aprueba solo lo que necesita revisión humana

---

**¿Implementamos este flujo de night credits con aprobación de staff y posibilidad de extensión vía marketplace?** 🚀

Es la mejor forma de evitar conflictos y maximizar la experiencia del owner.
