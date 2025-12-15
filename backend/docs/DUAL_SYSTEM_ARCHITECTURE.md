# Arquitectura Dual: Marketplace + Timeshare

## 🏨 Dos Modelos de Negocio en una Plataforma

La aplicación soporta **DOS servicios principales** que coexisten:

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATAFORMA SWORLD                        │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                       │
│   📦 MARKETPLACE    │      🔄 TIMESHARE                    │
│   (Rentals)         │      (Week Swaps)                     │
│                     │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

---

## 📦 MARKETPLACE (Renta de Habitaciones)

### **Concepto**
- Hoteles publican **habitaciones individuales** para renta directa
- **Guests** (huéspedes) las reservan por noches
- **Pago inmediato** al confirmar reserva

### **Flujo**
```
Guest busca habitación
    ↓
Selecciona fechas y habitación
    ↓
Ve precio (base + comisión transparente)
    ↓
Paga con Stripe (ej: €112)
    ↓
Hotel recibe payout (ej: €100)
    ↓
Plataforma retiene comisión (ej: €12)
```

### **Participantes**
- **Guest** (rol: guest): Usuario sin propiedad, solo renta
- **Staff** (rol: hotel_staff): Gestiona disponibilidad de habitaciones
- **Admin** (rol: admin): Configura comisión del marketplace

### **Tablas DB**
- `properties` → Hoteles
- `rooms` → Habitaciones (tiene campo `marketplace_visible`)
- `bookings` → Reservas con campos de pago
- `platform_settings` → Comisión del marketplace (`commission_rate`)

### **Comisión**
- **Tipo**: Porcentaje del precio base (ej: 12%)
- **Cálculo**: Precio Guest = Precio Hotel × (1 + rate)
- **Cobro**: En el momento de la reserva
- **Pago a Hotel**: Via Stripe Connect (transfer)

---

## 🔄 TIMESHARE (Intercambio de Semanas)

### **Concepto**
- **Owners** (propietarios) poseen semanas de tiempo compartido
- Pueden **intercambiar semanas** con otros owners
- Requiere **aprobación del staff** del hotel
- **Pago de comisión** solo si el intercambio se completa

### **Flujo**
```
Owner A busca semanas disponibles
    ↓
Solicita intercambio (su Semana 20 por Semana 35 de Owner B)
    ↓
Staff del hotel REVISA Y APRUEBA
    ↓
Owner B ACEPTA el intercambio
    ↓
Owner A PAGA COMISIÓN (ej: €35)
    ↓
Sistema INTERCAMBIA las semanas
    ↓
Ambos owners reciben confirmación
```

### **Participantes**
- **Owner** (rol: owner): Propietario de semanas
- **Staff** (rol: hotel_staff): Aprueba/rechaza intercambios
- **Admin** (rol: admin): Configura comisión de timeshare

### **Tablas DB**
- `weeks` → Semanas de tiempo compartido (pertenecen a owners)
- `swap_requests` → Solicitudes de intercambio
- `night_credits` → Créditos de noches (conversión de semanas)
- `platform_settings` → Comisión timeshare (`timeshare_commission_rate`, `timeshare_minimum_commission`)

### **Comisión**
- **Tipo**: Porcentaje del valor estimado de la semana (ej: 5%)
- **Cálculo**: Comisión = MAX(valor_semana × rate, mínimo €10)
- **Cobro**: Cuando Owner B acepta y Owner A paga
- **Destinatario**: 100% para la plataforma (no se paga al hotel)

---

## 🔀 Diferencias Clave

| Característica | Marketplace | Timeshare |
|----------------|-------------|-----------|
| **Usuarios** | Guests (sin propiedad) | Owners (con semanas) |
| **Objeto** | Habitaciones individuales | Semanas completas |
| **Duración** | Noches (flexible) | 7 días (semana completa) |
| **Aprobación** | Automática (si disponible) | Manual (staff aprueba) |
| **Pago** | Inmediato al reservar | Después de aprobación |
| **Comisión a** | Hotel (via Connect) | Plataforma 100% |
| **Disponibilidad** | Real-time | Sujeta a aprobación |
| **Cancelación** | Política de hotel | Staff puede rechazar |

---

## 🔗 Integración entre Sistemas

### **Problema: Conflictos de Disponibilidad**

Una **semana de timeshare** puede estar vinculada a **habitaciones del marketplace**. ¿Qué pasa si:
- Owner A tiene Semana 20 (habitación 101)
- Guest B quiere reservar habitación 101 en Semana 20
- Owner A intenta intercambiar Semana 20

**Solución Propuesta:**

```javascript
// Al crear booking del marketplace
async function createBooking(roomId, checkIn, checkOut) {
  // 1. Verificar si la habitación pertenece a una semana de timeshare
  const week = await Week.findOne({
    where: {
      property_id: room.property_id,
      start_date: { [Op.lte]: checkIn },
      end_date: { [Op.gte]: checkOut },
      status: 'available'
    }
  });
  
  if (week) {
    // 2. Si existe semana, bloquearla temporalmente
    week.status = 'used'; // o crear nuevo estado 'marketplace_booked'
    await week.save();
  }
  
  // 3. Crear booking normalmente
  const booking = await Booking.create({...});
  
  return booking;
}

// Al aprobar swap request
async function approveSwapRequest(swapRequestId) {
  // 1. Verificar que no haya bookings activos en las fechas
  const conflictingBookings = await Booking.count({
    where: {
      property_id: weekA.property_id,
      check_in: { [Op.lte]: weekA.end_date },
      check_out: { [Op.gte]: weekA.start_date },
      status: { [Op.in]: ['confirmed', 'pending'] }
    }
  });
  
  if (conflictingBookings > 0) {
    throw new Error('No se puede aprobar: hay reservas activas del marketplace');
  }
  
  // 2. Aprobar normalmente
  swapRequest.staff_approval_status = 'approved';
  await swapRequest.save();
}
```

### **Estados de Semana (Week)**

| Estado | Descripción | Marketplace | Timeshare |
|--------|-------------|-------------|-----------|
| `available` | Libre para usar | ✅ Puede reservarse | ✅ Puede intercambiarse |
| `confirmed` | Owner la usará | ❌ Bloqueada | ❌ No intercambiable |
| `used` | Ya fue usada | ❌ No disponible | ❌ No intercambiable |
| `converted` | Convertida a créditos | ❌ No disponible | ❌ No intercambiable |
| `marketplace_booked` | Reservada por guest | ❌ Ocupada | ❌ No intercambiable |

---

## 🎯 Roles y Permisos

### **Guest** (Usuario sin propiedad)
```javascript
// Marketplace
✅ Buscar habitaciones
✅ Ver precios con comisión
✅ Reservar habitaciones
✅ Ver sus reservas
✅ Pagar con Stripe

// Timeshare
❌ No tiene acceso
```

### **Owner** (Propietario de semanas)
```javascript
// Marketplace
✅ Buscar habitaciones
✅ Reservar habitaciones (como guest)

// Timeshare
✅ Ver sus semanas
✅ Solicitar intercambios
✅ Aceptar/rechazar solicitudes
✅ Ver historial de swaps
✅ Convertir semanas a créditos
✅ Pagar comisión de swap
```

### **Staff** (Personal del Hotel)
```javascript
// Marketplace
✅ Gestionar habitaciones
✅ Ver reservas del hotel
✅ Modificar disponibilidad
✅ Ver historial de pagos

// Timeshare
✅ Ver solicitudes de swap del hotel
✅ Aprobar/rechazar swaps
✅ Agregar notas a solicitudes
✅ Ver historial de swaps
```

### **Admin** (Administrador)
```javascript
// Marketplace
✅ Configurar comisión marketplace
✅ Ver reportes de ingresos
✅ Gestionar todos los hoteles
✅ Ver todas las reservas

// Timeshare
✅ Configurar comisión timeshare
✅ Ver reportes de swaps
✅ Gestionar reembolsos
✅ Ver todas las solicitudes
```

---

## 📊 Reportes y Métricas

### **Dashboard Admin - Vista Dual**

```javascript
// Ingresos Totales
{
  marketplace: {
    total_bookings: 150,
    total_revenue: 18000, // €18,000 (comisiones de reservas)
    avg_commission: 120,
    this_month: 3500
  },
  timeshare: {
    total_swaps: 45,
    total_revenue: 1575, // €1,575 (comisiones de swaps)
    avg_commission: 35,
    this_month: 280
  },
  combined: {
    total_revenue: 19575, // €19,575
    this_month: 3780
  }
}
```

### **Métricas Importantes**

1. **Ocupación del Marketplace**:
   ```sql
   SELECT 
     COUNT(DISTINCT b.room_id) * 100.0 / (SELECT COUNT(*) FROM rooms WHERE marketplace_visible = true)
   FROM bookings b
   WHERE b.status = 'confirmed' 
     AND b.check_in <= NOW() 
     AND b.check_out >= NOW()
   ```

2. **Actividad de Timeshare**:
   ```sql
   SELECT 
     COUNT(*) as total_swaps,
     AVG(commission_amount) as avg_commission
   FROM swap_requests
   WHERE status = 'completed'
     AND YEAR(created_at) = YEAR(NOW())
   ```

3. **Ingresos por Hotel**:
   ```sql
   SELECT 
     p.name,
     SUM(b.total_platform_commission) as marketplace_revenue,
     SUM(sr.commission_amount) as timeshare_revenue
   FROM properties p
   LEFT JOIN bookings b ON b.property_id = p.id AND b.status = 'confirmed'
   LEFT JOIN swap_requests sr ON sr.property_id = p.id AND sr.status = 'completed'
   GROUP BY p.id
   ```

---

## 🚀 Endpoints - Resumen Completo

### **Marketplace Endpoints**

```
# Public (sin auth)
GET    /hotels/public/properties                  # Listar hoteles
GET    /hotels/public/properties/:id/rooms        # Habitaciones disponibles

# Guest (con auth)
POST   /hotels/guest/bookings                     # Crear reserva
POST   /hotels/guest/bookings/:id/payment         # Pagar reserva
GET    /hotels/guest/bookings                     # Mis reservas

# Staff
GET    /hotels/staff/rooms                        # Habitaciones del hotel
PATCH  /hotels/staff/rooms/:id                    # Actualizar disponibilidad
GET    /hotels/staff/bookings                     # Reservas del hotel

# Admin
GET    /hotels/admin/settings/commission          # Ver comisión marketplace
PATCH  /hotels/admin/settings/commission          # Actualizar comisión
GET    /hotels/admin/bookings                     # Todas las reservas
```

### **Timeshare Endpoints**

```
# Owner
GET    /hotels/owner/weeks                        # Mis semanas
GET    /hotels/owner/timeshare/available-weeks    # Semanas para intercambio
POST   /hotels/owner/timeshare/swap-requests      # Solicitar intercambio
GET    /hotels/owner/timeshare/swap-requests      # Mis solicitudes
PATCH  /hotels/owner/timeshare/swap-requests/:id/accept   # Aceptar swap
PATCH  /hotels/owner/timeshare/swap-requests/:id/reject   # Rechazar swap
POST   /hotels/owner/timeshare/swap-requests/:id/payment  # Pagar comisión

# Staff
GET    /hotels/staff/timeshare/swap-requests      # Solicitudes pendientes
PATCH  /hotels/staff/timeshare/swap-requests/:id/approve  # Aprobar
PATCH  /hotels/staff/timeshare/swap-requests/:id/reject   # Rechazar

# Admin
GET    /hotels/admin/timeshare/settings           # Ver comisión timeshare
PATCH  /hotels/admin/timeshare/settings           # Actualizar comisión
GET    /hotels/admin/timeshare/reports            # Reportes de swaps
```

---

## ✅ Estado Actual de Implementación

### **Marketplace** ✅ 80% Completo
- ✅ Base de datos lista (rooms, bookings, pagos)
- ✅ Pricing service con comisión configurable
- ✅ Endpoints públicos para listar habitaciones
- ✅ Admin puede configurar comisión
- ⏳ Falta: Endpoints de booking, integración Stripe Connect
- ⏳ Falta: Frontend completo

### **Timeshare** ⏳ 40% Completo
- ✅ Base de datos extendida (approval workflow, payment tracking)
- ✅ Configuración de comisión en platform_settings
- ✅ Documentación completa de lógica de negocios
- ⏳ Falta: Modelo y servicio de timeshare
- ⏳ Falta: Endpoints owner/staff/admin
- ⏳ Falta: Integración de pagos
- ⏳ Falta: Sistema de notificaciones
- ⏳ Falta: Frontend (ya existe estructura base)

---

## 🎯 Próximos Pasos Sugeridos

1. **Completar Backend de Timeshare** (2-3 días)
   - Actualizar modelo SwapRequest
   - Crear TimeshareService con lógica de aprobación
   - Implementar endpoints owner/staff/admin
   - Integrar pagos de comisión con Stripe

2. **Sistema de Notificaciones** (1 día)
   - Email notifications para eventos clave
   - In-app notifications (tabla + websockets opcional)

3. **Frontend Integration** (3-4 días)
   - Marketplace: Páginas de búsqueda, detalle, booking
   - Timeshare: Mejorar UI existente con workflow de aprobación
   - Componentes compartidos: PricingBreakdown, PaymentForm

4. **Testing y QA** (2 días)
   - Tests de integración para ambos flujos
   - Validar conflictos de disponibilidad
   - Test de pagos en Stripe sandbox

---

**¿Listo para continuar con la implementación?** 🚀
