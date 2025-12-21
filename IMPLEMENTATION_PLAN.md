# Plan de Implementación: Intercambio de Noches (Night Swaps)

## 📋 Resumen de la Documentación Existente

### Sistema de Tres Flujos Principales

La plataforma SW2 maneja tres sistemas diferentes de reservas y intercambios:

#### 1. **🔄 TIMESHARE SWAPS (Intercambio de Semanas Completas)**
- Dos owners intercambian sus semanas de timeshare completas (7 días)
- Fee: €10 por intercambio exitoso
- Flujo documentado en: [TIMESHARE_REFINED_FLOW.md](backend/docs/TIMESHARE_REFINED_FLOW.md)
- Requiere:
  - Solicitud por owner A
  - Matching automático o manual por staff
  - Confirmación de ambos owners
  - Pago del fee
  - Ejecución del intercambio

#### 2. **🌙 NIGHT CREDITS (Créditos de Noches)**
- Owner convierte una semana en créditos nocturnos flexibles
- Conversión fija:
  - Red Week: 7 días → 6 noches
  - Blue Week: 7 días → 5 noches
  - White Week: 7 días → 4 noches
- Créditos válidos 18-24 meses
- NO transferibles, NO vendibles
- Restricciones: No usables en fechas pico (Navidad, Semana Santa, verano)
- Documentado en: [NIGHT_CREDITS_EXPLAINED.md](NIGHT_CREDITS_EXPLAINED.md)

#### 3. **📦 MARKETPLACE (Compra de Habitaciones)**
- Huéspedes o propietarios compran habitaciones individuales por noche
- Comisión: 12% para la plataforma
- Puede combinarse con night credits

---

## 🎯 Estado Actual de la Implementación

### Backend ✅ (Parcialmente Implementado)

**Modelos Existentes:**
- ✅ `SwapRequest.ts` - Modelo para solicitudes de intercambio
- ✅ `NightCredit.ts` - Modelo para créditos de noches
- ✅ `NightCreditRequest.ts` - Modelo para solicitudes de uso de créditos
- ✅ `Week.ts` - Modelo para semanas de timeshare
- ✅ `Booking.ts` - Modelo para reservas

**Rutas Implementadas:**
- ✅ `timeshareRoutes.ts` - Rutas para weeks y swaps
- ✅ `ownerNightCreditRoutes.ts` - Rutas para solicitudes de créditos (owner)
- ✅ `staffNightCreditRoutes.ts` - Rutas para aprobación de créditos (staff)

**Servicios Existentes:**
- ✅ `nightCreditService.ts` - Lógica de night credits
- ✅ `conversionService.ts` - Conversión de weeks a credits
- ✅ `pmsService.ts` - Integración con PMS

### Frontend ✅ (Parcialmente Implementado)

**Componentes/Páginas Existentes:**
- ✅ Night credit hooks: `useNightCredits.ts`
- ✅ API client: `api/nightCredits.ts`
- ✅ Pages: Owner credits dashboard, night credit requests
- ✅ Types: `NightCreditRequest`, `SwapRequest`

**Traducciones:**
- ✅ Spanish (es)
- ✅ English (en)
- 🔄 German (de) - Parcial
- 🔄 French (fr) - Parcial

---

## ❌ ¿Qué Falta Implementar?

### Backend - Funcionalidades Faltantes

1. **Validación de Availability en Swaps**
   - ✅ Modelo existe pero necesita validación completa
   - Verificar que ambas semanas sean del mismo tipo de acomodación
   - Bloquear durante las fechas pico

2. **Matching Automático de Swaps**
   - Lógica para encontrar matches automáticamente
   - Notificaciones cuando hay match disponible

3. **Payment Integration para Swap Fees**
   - Integración con Stripe para cobrar €10
   - Webhook handling para confirmación de pago

4. **Operaciones de Intercambio**
   - Endpoint para ejecutar el intercambio (transferir ownership)
   - Rollback si algo falla a mitad del proceso
   - Auditoría completa

5. **Notificaciones**
   - Email/Push cuando hay nuevo match
   - Notificación de vencimiento de créditos (30 días antes)
   - Confirmación de intercambio completado

### Frontend - Funcionalidades Faltantes

1. **Dashboard de Weeks (Owner)**
   - Listar todas las semanas del owner
   - Mostrar opciones: confirmar, convertir a créditos, solicitar swap
   - Status badges (available, confirmed, converted, used)

2. **Solicitar Swap (Owner)**
   - Seleccionar semana del owner
   - Buscar/filtrar semanas disponibles de otros owners
   - Crear solicitud con fechas deseadas (opcional)
   - Ver estado de la solicitud

3. **Aprobar/Rechazar Swaps (Staff)**
   - Dashboard con solicitudes pendientes
   - Visualizar ambas semanas
   - Botones para aprobar/rechazar con notas
   - Notificación a ambos owners

4. **Confirmación de Swap por Owner**
   - Notificación cuando hay match
   - Pantalla de confirmación con detalles
   - Botón para confirmar/rechazar con tiempo límite (48h)

5. **Payment Modal para Swap Fee**
   - Stripe Elements para cobrar €10
   - Mostrar detalles del swap y fee
   - Confirmación después de pago exitoso

---

## 📊 Tablas de Base de Datos Necesarias

**SwapRequest** - ✅ YA EXISTE
```typescript
{
  id: INT PRIMARY KEY
  requester_id: INT (FK users)
  requester_week_id: INT (FK weeks)
  responder_week_id: INT (FK weeks) - opcional hasta matched
  desired_start_date: DATE
  desired_end_date: DATE
  status: ENUM (pending, matched, awaiting_payment, completed, cancelled)
  accommodation_type: VARCHAR (denormalized)
  swap_fee: DECIMAL
  
  // Aprobación de staff
  reviewed_by_staff_id: INT
  staff_approval_status: ENUM (pending_review, approved, rejected)
  staff_review_date: TIMESTAMP
  staff_notes: TEXT
  
  // Aceptación del responder
  responder_acceptance: ENUM (pending, accepted, rejected)
  responder_acceptance_date: TIMESTAMP
  
  // Pago
  payment_intent_id: VARCHAR (Stripe)
  payment_status: ENUM (pending, paid, refunded, failed)
  paid_at: TIMESTAMP
  commission_amount: DECIMAL
  property_id: INT
  
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

---

## 🔄 Flujo Completo de Intercambio de Noches

### Fase 1: Solicitud (Gratis)
```
Owner A selecciona su Semana 20 (roja)
    ↓
Busca semanas disponibles de otros owners del mismo tipo
    ↓
Encuentra Semana 35 de Owner B (roja también)
    ↓
Crea solicitud de swap: 
  - requester_week_id: 20 (suya)
  - responder_week_id: 35 (de B)
  - status: pending
    ↓
Sistema notifica a Staff del property
```

### Fase 2: Revisión por Staff
```
Staff ve solicitud pendiente
    ↓
Verifica:
  - ¿Ambas semanas son del mismo tipo? ✓
  - ¿No están en fechas pico? ✓
  - ¿Usuarios activos? ✓
    ↓
Staff aprueba → status: matched
    ↓
Sistema notifica a Owner B
```

### Fase 3: Confirmación del Responder
```
Owner B recibe notificación
    ↓
Revisa detalles del swap
    ↓
Tiene 48 horas para confirmar/rechazar
    ↓
Si CONFIRMA → responder_acceptance: accepted
    ↓
Status cambia a: awaiting_payment
```

### Fase 4: Pago
```
Sistema solicita pago del swap fee (€10)
    ↓
Owner B paga con Stripe (o ambos comparten?)
    ↓
Pago confirmado → payment_status: paid
    ↓
Status cambia a: completed
```

### Fase 5: Ejecución del Intercambio
```
Sistema ejecuta:
  1. week 20 → owner cambia de A a B
  2. week 35 → owner cambia de B a A
  3. Ambas semanas status: "confirmed"
  4. Crear entry en action logs
    ↓
Notificar a ambos owners
  "¡Intercambio completado! Tus semanas han sido intercambiadas."
```

---

## 🛠️ Tareas de Implementación por Prioridad

### ✅ ALTA PRIORIDAD (MVP) - COMPLETADO

1. **Backend - Validación de Swaps** ✅
   - [x] Completar validación de accommodation_type
   - [x] Validar dates (no overlapping)
   - [x] Validar que weeks no estén en fechas pico
   - [x] Conflict detection (bookings & swaps)

2. **Backend - Payment Integration** ✅
   - [x] Crear endpoint para procesar pago de €10
   - [x] Integración con Stripe Payment Intents
   - [x] Confirmación de pago y finalización del swap

3. **Backend - Ejecución de Intercambio** ✅
   - [x] Endpoint para ejecutar intercambio post-pago
   - [x] Transacción atómica (rollback si falla)
   - [x] Transfer de ownership entre owners

### MEDIA PRIORIDAD

4. **Frontend - Dashboard de Weeks**
   - [ ] Componente para listar weeks del owner
   - [ ] Status badges
   - [ ] Botones de acción (confirm, convert, swap)

5. **Frontend - Solicitar Swap**
   - [ ] Formulario para crear swap request
   - [ ] Búsqueda de semanas disponibles
   - [ ] Mostrar matches sugeridos

6. **Frontend - Aprobar Swaps (Staff)**
   - [ ] Dashboard para staff
   - [ ] Botones aprobar/rechazar
   - [ ] Envío de notificaciones

7. **Frontend - Confirmación por Owner**
   - [ ] Notificación de match disponible
   - [ ] Pantalla de confirmación 
   - [ ] Conteo de tiempo (48h)

8. **Frontend - Payment Modal**
   - [ ] Stripe Elements para €10
   - [ ] Estados de carga/error

### BAJA PRIORIDAD

9. **Backend - Notificaciones**
   - [ ] Email cuando hay match
   - [ ] Push notifications (opcional)
   - [ ] In-app notifications

10. **Backend - Matching Automático**
    - [ ] Algoritmo para encontrar matches
    - [ ] Scheduled job (cron)

11. **Backend - Análisis y Reportes**
    - [ ] Dashboard de swaps completados
    - [ ] Revenue tracking (€10 × swaps)
    - [ ] Estadísticas de uso

12. **Traducciones**
    - [ ] Completar alemán (de)
    - [ ] Completar francés (fr)

---

## � Estado de Implementación por Fecha

**Diciembre 21, 2025**:
- ✅ **Backend MVP COMPLETO**
  - SwapService con búsqueda compatible de habitaciones
  - Validación de peak dates y accommodation types
  - Workflow staff approval + responder acceptance
  - Integración Stripe para €10 fee
  - Transacción atómica de transferencia de ownership
  - 14 endpoints implementados
  - 1200+ líneas de código nuevo
  
- ⏳ **Frontend EN PROGRESO**
  - Componentes UI pendientes
  - Integración con API backend
  - Payment modal con Stripe Elements
  - Notificaciones en tiempo real

---

1. **Accommodation Type**: Las semanas solo pueden intercambiarse con semanas del MISMO tipo de acomodación (sencilla ↔ sencilla, duplex ↔ duplex, suite ↔ suite)

2. **Fechas Pico**: No permitir swaps durante:
   - Navidad: 15 Dec - 5 Jan
   - Semana Santa
   - Verano: 15 Jul - 25 Aug

3. **Responsabilidad del Pago**: El documento no especifica claramente quién paga. Opciones:
   - Owner A paga (requester)
   - Owner B paga (responder)
   - Ambos comparten (€5 cada uno)
   - El que beneficia más (según demanda)

4. **Viabilidad Técnica**: 
   - ✅ Modelo de datos: Listo
   - ✅ Rutas básicas: Existen
   - ⚠️ Validación: Parcial
   - ❌ Payment flow: Falta
   - ❌ UI completa: Falta

---

**Última actualización**: 21 Dic 2025
**Responsable**: Equipo de desarrollo
