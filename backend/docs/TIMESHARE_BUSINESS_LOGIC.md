# Lógica de Negocios: Sistema de Timeshare (Tiempo Compartido)

## 📊 Visión General

El sistema de timeshare permite a los propietarios (owners) intercambiar semanas de tiempo compartido. Este proceso requiere **aprobación del staff** del hotel y genera una **comisión** para la plataforma.

---

## 🔄 Flujo Completo del Intercambio

### **Fase 1: Solicitud (Owner A - Requester)**

1. **Owner A** navega por las semanas disponibles de otros propietarios
2. Selecciona una semana de su propiedad que desea intercambiar
3. Selecciona una semana destino de **Owner B** (responder)
4. Crea una solicitud de intercambio:
   ```javascript
   {
     requester_id: ownerA.id,
     requester_week_id: weekA.id,
     responder_week_id: weekB.id,
     status: 'pending',
     staff_approval_status: 'pending_review',
     responder_acceptance: 'pending',
     property_id: weekA.property_id
   }
   ```

### **Fase 2: Revisión del Staff**

5. **Staff del hotel** recibe notificación de nueva solicitud
6. Staff revisa:
   - ✅ **Disponibilidad**: Ambas semanas están disponibles
   - ✅ **Sin conflictos**: No hay reservas del marketplace en esas fechas
   - ✅ **Derechos válidos**: Ambos owners tienen derechos activos
   - ✅ **Política del hotel**: Cumple reglas específicas del hotel

7. **Staff aprueba o rechaza:**
   - **Si APRUEBA**: 
     ```javascript
     staff_approval_status = 'approved'
     reviewed_by_staff_id = staff.id
     staff_review_date = new Date()
     // Se notifica a Owner B
     ```
   - **Si RECHAZA**: 
     ```javascript
     staff_approval_status = 'rejected'
     staff_notes = "Razón del rechazo..."
     status = 'cancelled'
     // Se notifica a Owner A
     ```

### **Fase 3: Aceptación del Propietario Destino (Owner B)**

8. **Owner B** recibe notificación si staff aprobó
9. Owner B puede **aceptar** o **rechazar**:
   - **Si ACEPTA**: 
     ```javascript
     responder_acceptance = 'accepted'
     responder_acceptance_date = new Date()
     status = 'matched'
     // Se procede al cobro de comisión
     ```
   - **Si RECHAZA**: 
     ```javascript
     responder_acceptance = 'rejected'
     status = 'cancelled'
     // Se notifica a Owner A
     ```

### **Fase 4: Cobro de Comisión**

10. **Sistema cobra comisión a Owner A** (quien solicitó):
    ```javascript
    // Calcular comisión (puede ser fija o porcentaje)
    commission_amount = await calculateSwapCommission(weekA, weekB);
    
    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: commission_amount * 100, // en centavos
      currency: 'eur',
      customer: ownerA.stripe_customer_id,
      description: `Comisión por intercambio de semana ${weekA.id} ↔ ${weekB.id}`,
      metadata: {
        swap_request_id: swapRequest.id,
        requester_id: ownerA.id,
        type: 'timeshare_commission'
      }
    });
    
    // Actualizar solicitud
    swap_request.payment_intent_id = paymentIntent.id;
    swap_request.payment_status = 'pending';
    ```

11. **Owner A completa el pago** (frontend con Stripe Elements)

12. **Webhook de Stripe** confirma pago:
    ```javascript
    // payment_intent.succeeded
    swap_request.payment_status = 'paid';
    swap_request.paid_at = new Date();
    // Se procede a ejecutar el intercambio
    ```

### **Fase 5: Ejecución del Intercambio**

13. **Sistema ejecuta el intercambio**:
    ```javascript
    // Transaction para asegurar integridad
    await sequelize.transaction(async (t) => {
      // Intercambiar propietarios
      const tempOwnerId = weekA.owner_id;
      weekA.owner_id = weekB.owner_id;
      weekB.owner_id = tempOwnerId;
      
      await weekA.save({ transaction: t });
      await weekB.save({ transaction: t });
      
      // Actualizar solicitud
      swapRequest.status = 'completed';
      await swapRequest.save({ transaction: t });
      
      // Registrar en action_logs
      await ActionLog.create({
        user_id: staff.id,
        action: 'TIMESHARE_SWAP_COMPLETED',
        details: JSON.stringify({
          swap_request_id: swapRequest.id,
          week_a: weekA.id,
          week_b: weekB.id,
          commission: commission_amount
        })
      }, { transaction: t });
    });
    ```

14. **Notificaciones finales**:
    - Owner A: "Tu intercambio se completó. Ahora posees la semana..."
    - Owner B: "El intercambio se completó. Ahora posees la semana..."
    - Staff: "Intercambio #123 completado exitosamente"

---

## 💰 Estructura de Comisión

### **Opción 1: Comisión Fija**
```javascript
// Tarifa fija por intercambio
const TIMESHARE_COMMISSION = 10.00; // €10 por intercambio
```

### **Opción 2: Comisión Porcentual** (Recomendado)
```javascript
// Basado en valor estimado de las semanas
async function calculateSwapCommission(weekA, weekB) {
  // Obtener configuración de plataforma
  const settings = await PlatformSettings.findOne();
  const commissionRate = settings.timeshare_commission_rate || 0.05; // 5%
  
  // Valor base de la semana (precio promedio de noches en esa propiedad)
  const weekValue = await getWeekValue(weekA);
  
  // Comisión = % del valor de la semana
  const commission = weekValue * commissionRate;
  
  return Math.max(commission, 10.00); // Mínimo €10
}

async function getWeekValue(week) {
  // Calcular valor promedio basado en precio de habitaciones
  const property = await week.getProperty();
  const avgRoomPrice = await Room.findOne({
    where: { property_id: property.id },
    attributes: [[sequelize.fn('AVG', sequelize.col('base_price')), 'avg_price']]
  });
  
  const nightsInWeek = 7;
  return (avgRoomPrice?.avg_price || 100) * nightsInWeek; // Ej: €700
}
```

---

## 🎯 Estados del Sistema

### **Estados de `swap_requests`**

| Estado | Descripción |
|--------|-------------|
| `pending` | Solicitud creada, esperando revisión del staff |
| `matched` | Staff aprobó y Owner B aceptó, pendiente de pago |
| `completed` | Pago realizado e intercambio ejecutado |
| `cancelled` | Rechazado por staff o Owner B |

### **Estados de `staff_approval_status`**

| Estado | Descripción |
|--------|-------------|
| `pending_review` | Esperando revisión del staff |
| `approved` | Staff aprobó la solicitud |
| `rejected` | Staff rechazó la solicitud |

### **Estados de `responder_acceptance`**

| Estado | Descripción |
|--------|-------------|
| `pending` | Esperando respuesta del Owner B |
| `accepted` | Owner B aceptó el intercambio |
| `rejected` | Owner B rechazó el intercambio |

### **Estados de `payment_status`**

| Estado | Descripción |
|--------|-------------|
| `pending` | Pago no realizado |
| `paid` | Comisión pagada exitosamente |
| `failed` | Pago falló |
| `refunded` | Comisión reembolsada (si se cancela) |

---

## 🔐 Permisos y Roles

### **Owner (Propietario)**
- ✅ Ver sus propias semanas
- ✅ Ver semanas disponibles de otros
- ✅ Crear solicitudes de intercambio
- ✅ Aceptar/rechazar solicitudes recibidas
- ✅ Ver historial de sus intercambios
- ❌ NO puede aprobar solicitudes

### **Staff (Personal del Hotel)**
- ✅ Ver solicitudes pendientes de su hotel
- ✅ Aprobar/rechazar solicitudes
- ✅ Agregar notas a solicitudes
- ✅ Ver historial de intercambios del hotel
- ❌ NO puede crear solicitudes

### **Admin (Administrador)**
- ✅ Todo lo anterior
- ✅ Configurar tasa de comisión de timeshare
- ✅ Ver reportes de ingresos por comisiones
- ✅ Gestionar reembolsos

---

## 📋 Reglas de Negocio

### **Validaciones Antes de Aprobar**

1. **Disponibilidad de Semanas**:
   ```javascript
   // Ambas semanas deben estar en estado 'available'
   weekA.status === 'available' && weekB.status === 'available'
   ```

2. **Sin Conflictos con Marketplace**:
   ```javascript
   // No puede haber bookings activos en esas fechas
   const conflictingBookings = await Booking.count({
     where: {
       property_id: [weekA.property_id, weekB.property_id],
       check_in: { [Op.lte]: weekA.end_date },
       check_out: { [Op.gte]: weekA.start_date },
       status: { [Op.in]: ['confirmed', 'pending'] }
     }
   });
   
   if (conflictingBookings > 0) {
     throw new Error('Hay reservas activas en las fechas solicitadas');
   }
   ```

3. **Mismo Período de Tiempo**:
   ```javascript
   // Las semanas deben tener la misma duración
   const durationA = weekA.end_date - weekA.start_date;
   const durationB = weekB.end_date - weekB.start_date;
   
   if (durationA !== durationB) {
     throw new Error('Las semanas deben tener la misma duración');
   }
   ```

4. **Propietarios Diferentes**:
   ```javascript
   // No puedes intercambiar contigo mismo
   if (weekA.owner_id === weekB.owner_id) {
     throw new Error('No puedes intercambiar semanas contigo mismo');
   }
   ```

5. **No Intercambios Duplicados**:
   ```javascript
   // No puede haber otra solicitud activa para estas semanas
   const existingRequest = await SwapRequest.findOne({
     where: {
       [Op.or]: [
         { requester_week_id: weekA.id },
         { responder_week_id: weekA.id }
       ],
       status: { [Op.in]: ['pending', 'matched'] }
     }
   });
   
   if (existingRequest) {
     throw new Error('Ya existe una solicitud activa para esta semana');
   }
   ```

---

## 🔔 Sistema de Notificaciones

### **Eventos que Generan Notificaciones**

1. **Nueva Solicitud** → Notificar a Staff del hotel
2. **Staff Aprueba** → Notificar a Owner B
3. **Staff Rechaza** → Notificar a Owner A
4. **Owner B Acepta** → Notificar a Owner A (solicitar pago)
5. **Owner B Rechaza** → Notificar a Owner A
6. **Pago Completado** → Notificar a ambos owners y staff
7. **Intercambio Completado** → Notificar a ambos owners

---

## 📊 Reporting para Admin

### **Métricas Importantes**

1. **Total de Intercambios**:
   ```sql
   SELECT COUNT(*) FROM swap_requests WHERE status = 'completed'
   ```

2. **Ingresos por Comisiones**:
   ```sql
   SELECT SUM(commission_amount) FROM swap_requests 
   WHERE status = 'completed' AND payment_status = 'paid'
   ```

3. **Tasa de Aprobación**:
   ```sql
   SELECT 
     COUNT(CASE WHEN staff_approval_status = 'approved' THEN 1 END) * 100.0 / COUNT(*) 
   FROM swap_requests 
   WHERE staff_approval_status != 'pending_review'
   ```

4. **Tasa de Aceptación (Owner B)**:
   ```sql
   SELECT 
     COUNT(CASE WHEN responder_acceptance = 'accepted' THEN 1 END) * 100.0 / COUNT(*) 
   FROM swap_requests 
   WHERE responder_acceptance != 'pending'
   ```

---

## 🚀 Endpoints Necesarios

### **Owner Endpoints**

```
POST   /hotels/owner/timeshare/swap-requests        # Crear solicitud
GET    /hotels/owner/timeshare/swap-requests        # Mis solicitudes
GET    /hotels/owner/timeshare/swap-requests/:id    # Detalle de solicitud
PATCH  /hotels/owner/timeshare/swap-requests/:id/accept   # Aceptar (si soy responder)
PATCH  /hotels/owner/timeshare/swap-requests/:id/reject   # Rechazar (si soy responder)
DELETE /hotels/owner/timeshare/swap-requests/:id    # Cancelar (si soy requester)

GET    /hotels/owner/timeshare/available-weeks      # Semanas disponibles para intercambio
POST   /hotels/owner/timeshare/swap-requests/:id/payment  # Pagar comisión
```

### **Staff Endpoints**

```
GET    /hotels/staff/timeshare/swap-requests        # Solicitudes pendientes del hotel
GET    /hotels/staff/timeshare/swap-requests/:id    # Detalle
PATCH  /hotels/staff/timeshare/swap-requests/:id/approve  # Aprobar
PATCH  /hotels/staff/timeshare/swap-requests/:id/reject   # Rechazar
```

### **Admin Endpoints**

```
GET    /hotels/admin/timeshare/settings             # Ver configuración de comisión
PATCH  /hotels/admin/timeshare/settings             # Actualizar comisión
GET    /hotels/admin/timeshare/reports              # Reportes de intercambios
```

---

## 🎨 Consideraciones de UX

### **Para Owners**
- Dashboard mostrando:
  - Solicitudes pendientes de mi aprobación
  - Mis solicitudes en proceso
  - Historial de intercambios completados
- Calendario visual de semanas disponibles
- Preview del costo de comisión antes de solicitar

### **Para Staff**
- Lista de solicitudes pendientes ordenadas por fecha
- Filtros: por propiedad, por estado, por fecha
- Información clara sobre disponibilidad y conflictos
- Historial de decisiones tomadas

### **Para Admin**
- Dashboard con métricas clave
- Gráficos de tendencias de intercambios
- Configuración fácil de tasas de comisión

---

## ✅ Próximos Pasos de Implementación

1. ✅ **Migración de base de datos** (agregar campos de aprobación)
2. ⏳ **Actualizar modelo SwapRequest** con nuevos campos
3. ⏳ **Crear servicio TimeshareService** con lógica de negocio
4. ⏳ **Implementar endpoints para owners**
5. ⏳ **Implementar endpoints para staff**
6. ⏳ **Integrar pagos con Stripe**
7. ⏳ **Sistema de notificaciones**
8. ⏳ **Frontend para gestión de intercambios**

---

## 🤔 Preguntas para el Cliente

Antes de continuar, necesito confirmar:

1. **Comisión**: ¿Prefieres comisión fija (€10) o porcentual (5% del valor estimado)?
2. **Aprobación automática**: ¿El staff SIEMPRE debe revisar, o puede haber auto-aprobación en ciertos casos?
3. **Cancelación**: ¿Qué pasa si Owner A paga y luego quiere cancelar? ¿Reembolso completo?
4. **Multiple solicitudes**: ¿Un owner puede tener múltiples solicitudes activas al mismo tiempo?
5. **Notificaciones**: ¿Por email, in-app, o ambas?

