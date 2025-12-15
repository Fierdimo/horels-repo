# Sistema de Timeshare: Flujo Refinado (Basado en Idea Original)

## 🎯 Principio Fundamental

> **Owners tienen acceso GRATIS a la app. Solo pagan una pequeña tarifa cuando reciben valor real (swap exitoso).**

---

## 💰 Modelo de Monetización

### **1. Swap Fee (Owner → Plataforma)**
- **Solicitud de swap**: GRATIS
- **Cobro solo si swap exitoso**: Fee fijo (€10 configurable)
- **No hay costos ocultos**: Total transparencia

### **2. Extra Nights / Room Upsell (Hotel → Plataforma)**
- Owner compra noches extras antes/después de su semana
- **Hotel recibe el pago** del owner
- **Plataforma cobra comisión** al hotel (B2B)
- Ejemplo: Owner paga €100 → Hotel recibe €88 → Plataforma retiene €12

### **3. Servicios Extras (Modelo Mixto)**

**A. Servicios internos del hotel** (parking, spa, late checkout, breakfast):
- Owner/Guest paga precio del hotel
- Hotel paga fee a plataforma cuando la reserva viene de la app
- Comisión pequeña por transacción

**B. Servicios de terceros** (transfers, paquetes especiales):
- Usuario paga a través de la app
- Plataforma mantiene margen/comisión
- Revenue share con proveedor

---

## 🔄 Flujo de Swap Simplificado

### **Fase 1: Solicitud (Gratis)**

```
Owner A quiere intercambiar su Semana 20
    ↓
Busca en la app semanas disponibles
    ↓
Encuentra Semana 35 de Owner B que le interesa
    ↓
Crea solicitud de swap (SIN PAGO)
    ↓
Estado: 'pending'
```

**Campos de la solicitud:**
```javascript
{
  requester_id: ownerA.id,
  requester_week_id: 20,
  responder_week_id: 35,  // opcional: puede solo indicar fechas deseadas
  desired_start_date: '2025-08-01',
  desired_end_date: '2025-08-08',
  status: 'pending',
  notes: 'Prefiero semana en agosto...'
}
```

### **Fase 2: Matching (Staff/Sistema)**

**Opción A: Matching automático**
```
Sistema busca semanas disponibles que coincidan con:
  - Fechas deseadas
  - Mismo tipo de propiedad (color: red/blue/white)
  - Misma duración
    ↓
Si encuentra match exacto:
  - Notifica a ambos owners
  - Estado: 'matched'
```

**Opción B: Matching manual por staff**
```
Staff del hotel revisa solicitud
    ↓
Staff encuentra semana compatible
    ↓
Staff asigna responder_week_id manualmente
    ↓
Notifica a ambos owners
    ↓
Estado: 'matched'
```

### **Fase 3: Confirmación**

```
Ambos owners reciben notificación
    ↓
Tienen 48 horas para confirmar
    ↓
Si ambos ACEPTAN:
  - Se solicita pago del swap fee
  - Estado: 'awaiting_payment'
    ↓
Si alguno RECHAZA:
  - Estado: 'cancelled'
  - No se cobra nada
```

### **Fase 4: Pago (Solo si swap confirmado)**

```
Owner A paga swap fee (€10)
    ↓
Stripe procesa pago
    ↓
Webhook confirma: payment_intent.succeeded
    ↓
Sistema ejecuta swap:
  - weekA.owner_id = ownerB.id
  - weekB.owner_id = ownerA.id
    ↓
Estado: 'completed'
    ↓
Notificaciones a ambos owners
```

---

## 🏗️ Estructura de Base de Datos

### **Tabla: `swap_requests`**

```sql
CREATE TABLE swap_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Quién solicita
  requester_id INT NOT NULL,  -- Owner A
  requester_week_id INT NOT NULL,  -- Semana que ofrece
  
  -- Qué busca
  responder_week_id INT NULL,  -- Semana específica (opcional)
  desired_start_date DATE NOT NULL,  -- O solo fechas deseadas
  desired_end_date DATE NOT NULL,
  
  -- Estado del swap
  status ENUM('pending', 'matched', 'awaiting_payment', 'completed', 'cancelled'),
  
  -- Confirmaciones
  requester_confirmed BOOLEAN DEFAULT FALSE,
  responder_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_deadline TIMESTAMP NULL,
  
  -- Pago
  swap_fee DECIMAL(10,2) DEFAULT 10.00,  -- Fee fijo
  payment_intent_id VARCHAR(255) NULL,
  payment_status ENUM('pending', 'paid', 'failed', 'refunded'),
  paid_at TIMESTAMP NULL,
  
  -- Metadatos
  matched_by_staff_id INT NULL,  -- Staff que hizo el matching
  matched_at TIMESTAMP NULL,
  notes TEXT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Tabla: `weeks`** (existente)

```sql
CREATE TABLE weeks (
  id INT PRIMARY KEY,
  owner_id INT NOT NULL,
  property_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color ENUM('red', 'blue', 'white'),  -- Tipo de semana
  status ENUM('available', 'confirmed', 'converted', 'used'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🎮 Estados del Swap

| Estado | Descripción | Owner puede... | Se cobra fee? |
|--------|-------------|----------------|---------------|
| `pending` | Solicitud creada, buscando match | Cancelar gratis | ❌ No |
| `matched` | Match encontrado, esperando confirmación | Confirmar o rechazar | ❌ No |
| `awaiting_payment` | Ambos confirmaron, esperando pago | Pagar fee | ✅ Ahora sí |
| `completed` | Pago exitoso, swap ejecutado | Ver detalles | ✅ Ya pagado |
| `cancelled` | Alguien rechazó o timeout | Crear nueva solicitud | ❌ No |

---

## 📱 Endpoints Necesarios

### **Owner Endpoints**

```
# Solicitudes de swap
POST   /hotels/owner/timeshare/swap-requests      # Crear solicitud (gratis)
GET    /hotels/owner/timeshare/swap-requests      # Ver mis solicitudes
GET    /hotels/owner/timeshare/swap-requests/:id  # Detalle
DELETE /hotels/owner/timeshare/swap-requests/:id  # Cancelar (solo si pending)

# Confirmación
POST   /hotels/owner/timeshare/swap-requests/:id/confirm   # Confirmar match
POST   /hotels/owner/timeshare/swap-requests/:id/reject    # Rechazar match

# Pago
POST   /hotels/owner/timeshare/swap-requests/:id/pay       # Pagar fee (Stripe)

# Búsqueda
GET    /hotels/owner/timeshare/available-weeks    # Semanas disponibles para swap
GET    /hotels/owner/timeshare/my-weeks           # Mis semanas
```

### **Staff Endpoints**

```
# Gestión de swaps
GET    /hotels/staff/timeshare/swap-requests      # Solicitudes del hotel
POST   /hotels/staff/timeshare/swap-requests/:id/match  # Asignar match manual
GET    /hotels/staff/timeshare/swap-history       # Historial de swaps

# Matching automático
POST   /hotels/staff/timeshare/find-matches       # Buscar matches automáticos
```

### **Admin Endpoints**

```
# Configuración
GET    /hotels/admin/timeshare/settings           # Ver configuración
PATCH  /hotels/admin/timeshare/settings           # Actualizar swap fee

# Reportes
GET    /hotels/admin/timeshare/revenue            # Ingresos por swaps
GET    /hotels/admin/timeshare/stats              # Estadísticas
```

---

## 💳 Integración de Pagos (Stripe)

### **Cuando Owner paga swap fee:**

```javascript
// 1. Crear Payment Intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: swapFee * 100,  // €10.00 = 1000 centavos
  currency: 'eur',
  customer: owner.stripe_customer_id,
  description: `Swap fee - Semana ${weekA.id} ↔ Semana ${weekB.id}`,
  metadata: {
    swap_request_id: swapRequest.id,
    type: 'timeshare_swap_fee'
  }
});

// 2. Owner paga en frontend (Stripe Elements)

// 3. Webhook confirma pago
if (event.type === 'payment_intent.succeeded') {
  const swapRequest = await SwapRequest.findOne({
    where: { payment_intent_id: paymentIntent.id }
  });
  
  // Ejecutar swap
  await executeSwap(swapRequest.id);
}
```

### **Cuando Owner compra noches extras (B2B con hotel):**

```javascript
// Owner paga por noches extras
const paymentIntent = await stripe.paymentIntents.create({
  amount: totalPrice * 100,
  currency: 'eur',
  customer: owner.stripe_customer_id,
  application_fee_amount: commission * 100,  // Comisión para plataforma
  transfer_data: {
    destination: hotel.stripe_connect_account_id  // Pago directo al hotel
  },
  metadata: {
    type: 'extra_nights',
    nights: 3,
    property_id: property.id
  }
});
```

---

## 🚀 Diferencias Clave vs. Marketplace

| Característica | Timeshare Swap | Marketplace |
|----------------|----------------|-------------|
| **Usuario** | Owner (con semana) | Guest (sin propiedad) |
| **Objeto** | Intercambio de semanas | Reserva de habitación |
| **Costo inicial** | GRATIS (solicitud) | Paga al reservar |
| **Cuándo cobra plataforma** | Solo si swap exitoso | Siempre (comisión) |
| **Tipo de fee** | Fijo (€10) | Porcentaje (12%) |
| **Aprobación** | Staff puede ayudar | Automático si disponible |
| **Pago va a** | 100% Plataforma | Hotel + Comisión |
| **Stripe** | Payment Intent simple | Connect + destination charge |

---

## 📊 Ejemplos de Flujo Completo

### **Ejemplo 1: Swap exitoso**

1. Owner A solicita swap (Semana 20 → Semana 35) **→ GRATIS**
2. Sistema encuentra match automático **→ GRATIS**
3. Ambos owners confirman en 24h **→ GRATIS**
4. Owner A paga €10 **→ COBRA**
5. Swap se ejecuta, ambos reciben nuevas semanas

**Total cobrado**: €10 (una sola vez)

### **Ejemplo 2: Swap cancelado**

1. Owner A solicita swap **→ GRATIS**
2. Sistema encuentra match **→ GRATIS**
3. Owner B rechaza **→ GRATIS**

**Total cobrado**: €0

### **Ejemplo 3: Owner compra noches extras**

1. Owner A tiene Semana 20 (7 noches)
2. Quiere 3 noches extras antes
3. Hotel cobra €300 (€100/noche)
4. Plataforma retiene 12% = €36
5. Hotel recibe €264

**Total cobrado a Owner**: €300
**Total a plataforma**: €36
**Total a hotel**: €264

---

## ✅ Ventajas de Este Enfoque

1. **Barrera de entrada baja**: Owners pueden usar app gratis
2. **Monetización alineada con valor**: Solo cobramos cuando owner obtiene beneficio real
3. **Transparencia total**: Fee fijo y visible desde el inicio
4. **Tracción inicial**: Más fácil atraer owners sin subscripciones
5. **Escalable**: Revenue crece con volumen de swaps exitosos

---

## 🎯 KPIs Importantes

1. **Tasa de conversión de swaps**: `completed / pending`
2. **Tiempo promedio de matching**: Desde `pending` hasta `matched`
3. **Tasa de confirmación**: `awaiting_payment / matched`
4. **Revenue por owner por año**: `total_swap_fees / active_owners`
5. **Tasa de cancelación**: `cancelled / (matched + cancelled)`

---

## 🔄 Próximos Pasos de Implementación

### **Backend (prioridad alta):**
1. Simplificar flujo de swaps en `timeshareRoutes.ts`
2. Agregar estados de confirmación a tabla
3. Implementar lógica de matching automático
4. Integrar pago de swap fee con Stripe
5. Webhooks para `payment_intent.succeeded`

### **Frontend (prioridad media):**
1. Interfaz de búsqueda de semanas disponibles
2. Creación de solicitud de swap (sin pago)
3. Confirmación de matches encontrados
4. Pago con Stripe Elements (solo si confirmado)
5. Dashboard de mis swaps

### **Admin (prioridad baja):**
1. Panel de configuración de swap fee
2. Reportes de revenue por swaps
3. Matching manual por staff

---

**¿Listo para implementar este flujo simplificado?** 🚀

El código base ya está bien estructurado, solo necesitamos ajustar la lógica de estados y cobro.
