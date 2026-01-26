# Historias de Usuario Owner - Análisis Pragmático

**Fecha:** 25 de Enero, 2026  
**Enfoque:** ¿Qué necesitamos REALMENTE implementar ahora?  
**Estado del Sistema:** Post-simplificación frontend

---

## 🎯 Contexto: ¿Qué tenemos funcionando?

### ✅ Backend - 100% Completo
- ✅ Sistema de marketplace con inventario
- ✅ Servicio de liberación de semanas (WeekReleaseService)
- ✅ Servicio de booking con créditos (CreditBookingService)
- ✅ Cálculo de opciones de pago (credits_only, credits_plus_cash, cash_only)
- ✅ Reservas temporales (15 minutos)
- ✅ Cancelación de reservas
- ✅ 16 endpoints completos en marketplaceRoutes.ts

### ✅ Frontend - Marketplace Completo
- ✅ MarketplacePage.tsx - Búsqueda y liberación de semanas
- ✅ CreditCheckoutPage.tsx - Checkout con opciones de pago
- ✅ InventorySearchPage.tsx - Búsqueda avanzada
- ✅ API client completo (marketplace.ts)
- ✅ Componentes de release (ReleaseWeekModal.tsx)

### ✅ Frontend - Dashboard Owner
- ✅ UnifiedDashboard.tsx - Vista unificada con tabs
- ✅ MyAccount.tsx - Configuración completa
- ✅ Navegación simplificada (3 páginas vs 14)

### ⚠️ Páginas Legacy (Mantenidas pero no integradas)
- Swaps.tsx (sistema tradicional - a deprecar)
- Weeks.tsx (gestión detallada)
- Credits.tsx (vista detallada)
- MyBookings.tsx (lista completa)
- NightCreditRequests.tsx (conversión a créditos)

---

## 🔍 Análisis de Flujos del Owner

### Flujo 1: "No voy a usar esta semana" ✅ FUNCIONA

```
Owner con semana que no usa
    ↓
1. Va a /owner/marketplace                           ✅ Ruta existe
2. Ve sección "Libera tus Semanas"                  ✅ MarketplacePage
3. Ve lista de semanas elegibles                     ✅ getEligibleWeeks()
4. Click "Liberar por créditos"                     ✅ ReleaseWeekModal
5. Ve estimación de créditos                        ✅ estimateWeekValue()
6. Confirma liberación                               ✅ releaseWeek()
7. Recibe créditos en wallet                        ✅ WeekReleaseService
8. Semana entra a inventario                        ✅ InventoryService
```

**Estado:** ✅ **COMPLETO Y FUNCIONAL**

---

### Flujo 2: "Quiero usar mi semana en otro lugar/fecha" ✅ FUNCIONA

```
Owner con 1,000 créditos busca alternativa
    ↓
1. Va a /owner/marketplace                           ✅ Ruta existe
2. Usa filtros de búsqueda                          ✅ searchInventory()
3. Ve semanas disponibles con precios               ✅ Inventory cards
4. Encuentra semana de 1,000 créditos               ✅ Precio mostrado
5. Click "Reservar"                                  ✅ navigate to checkout
6. Ve checkout con opciones de pago                 ✅ CreditCheckoutPage
7. Selecciona "Credits Only" (tiene suficientes)   ✅ Payment options
8. Confirma reserva                                  ✅ bookWithCredits()
9. Créditos deducidos, booking creado               ✅ CreditBookingService
10. Redirección a confirmación                      ✅ navigate to booking
```

**Estado:** ✅ **COMPLETO Y FUNCIONAL**

---

### Flujo 3: "Quiero semana premium pero me faltan créditos" ⚠️ PARCIAL

```
Owner con 1,000 créditos busca semana de 1,200
    ↓
1. Va a /owner/marketplace                           ✅ Funciona
2. Encuentra semana de 1,200 créditos               ✅ Funciona
3. Click "Reservar"                                  ✅ Funciona
4. Ve checkout con opciones:                        ✅ CreditCheckoutPage
   - Credits Only: NO disponible (insuficientes)    ✅ canAfford: false
   - Credits + Cash: 1,000 créditos + €XX          ✅ Opción mostrada
   - Cash Only: €YY                                 ✅ Opción mostrada
5. Selecciona "Credits + Cash"                      ✅ UI existe
6. Ve desglose: 1,000 créditos + €XX               ✅ Mostrado
7. Click "Confirmar Reserva"                        ⚠️ FALTA STRIPE
8. Procesa pago con Stripe                          ❌ NO IMPLEMENTADO
9. Créditos + pago deducidos                        ❌ BACKEND PARCIAL
10. Booking confirmado                               ❌ BLOQUEADO
```

**Estado:** ⚠️ **80% COMPLETO** - Falta integración real de Stripe

**Problema específico:**
```typescript
// CreditCheckoutPage.tsx línea ~86
const request = {
  stripePaymentMethodId: selectedOption.type !== 'credits_only' 
    ? 'pm_card_visa'  // ⚠️ HARDCODED - NO ES REAL
    : undefined
};
```

**Backend existe pero necesita:**
- Frontend: Integrar Stripe Elements
- Frontend: Capturar payment method real
- Backend: Procesar pago real en CreditBookingService
- Testing: Flujo completo con pago

---

## 📋 Historias de Usuario - Priorización Real

### 🔴 PRIORIDAD CRÍTICA (Bloqueantes del MVP)

#### **HU-1: Pago Mixto con Stripe Real**

**Como** propietario con créditos insuficientes  
**Quiero** pagar la diferencia con tarjeta  
**Para** poder reservar semanas premium sin liberar más semanas

**Estado Actual:** ⚠️ UI existe, backend parcial, Stripe mock

**Tareas:**
1. ✅ UI de checkout - YA EXISTE (CreditCheckoutPage)
2. ✅ Backend cálculo de opciones - YA EXISTE (CreditBookingService)
3. ❌ Frontend: Integrar Stripe Elements
4. ❌ Frontend: Capturar payment method real
5. ❌ Backend: Procesar pago Stripe en bookWithCredits()
6. ❌ Testing: Flujo E2E con pago real

**Estimación:** 3-4 días  
**Complejidad:** Media  
**Archivos:**
- `frontend/src/pages/marketplace/CreditCheckoutPage.tsx`
- `frontend/src/components/stripe/PaymentMethodSelector.tsx` (nuevo)
- `backend/src/services/CreditBookingService.ts`
- `backend/src/services/stripeService.ts` (ya existe)

**Criterios de Aceptación:**
```
DADO un owner con 1,000 créditos
Y una semana que cuesta 1,200 créditos
CUANDO selecciona "Credits + Cash"
Y ingresa datos de tarjeta válida
Y confirma
ENTONCES:
  - Se procesan 200 créditos = €XX con Stripe
  - Se deducen 1,000 créditos del wallet
  - Se crea booking confirmado
  - Se envía confirmación por email
```

---

### ⚠️ PRIORIDAD ALTA (Funcionalidad esperada)

#### **HU-2: Ver Mis Reservas en Dashboard**

**Como** propietario  
**Quiero** ver todas mis reservas en el dashboard  
**Para** gestionar mis próximos viajes sin salir del dashboard

**Estado Actual:** ⚠️ Existe en MyBookings.tsx pero no integrado

**Tareas:**
1. ✅ Backend: `GET /marketplace/my-bookings` - YA EXISTE
2. ✅ Componente legacy: MyBookings.tsx - YA EXISTE
3. ❌ Integrar en UnifiedDashboard tab "Reservas"
4. ❌ Mostrar indicador si fue con créditos
5. ❌ Link a detalles de booking

**Estimación:** 1 día  
**Complejidad:** Baja

**Solución:**
```tsx
// UnifiedDashboard.tsx - Tab "Reservas"
const { data: bookings } = useQuery({
  queryKey: ['my-marketplace-bookings'],
  queryFn: () => marketplaceApi.getMyBookings()
});

// Mostrar en tabla similar a bookings normales pero:
// - Badge "Con Créditos" si creditsUsed > 0
// - Link a marketplace booking details
```

---

#### **HU-3: Convertir Semana a Night Credits desde Dashboard**

**Como** propietario  
**Quiero** convertir mi semana a night credits desde el dashboard  
**Para** tener más flexibilidad sin salir del dashboard

**Estado Actual:** ⚠️ Existe en NightCreditRequests.tsx pero no integrado

**Tareas:**
1. ✅ Backend: ownerNightCreditRoutes - YA EXISTE
2. ✅ Componente legacy: NightCreditRequests.tsx - YA EXISTE
3. ❌ Agregar botón "Convertir a Night Credits" en cards de semanas
4. ❌ Modal simple de conversión en UnifiedDashboard
5. ❌ Mostrar solicitudes pendientes en tab Credits

**Estimación:** 2 días  
**Complejidad:** Media

**Flujo propuesto:**
```
En UnifiedDashboard - Tab "Semanas"
  └─> Week card tiene 3 botones:
      1. "Usar" (confirmar)
      2. "Liberar" (al marketplace)
      3. "Convertir" (a night credits) ← NUEVO

Click "Convertir"
  └─> Modal muestra:
      - Cálculo: Red=6, Blue=5, White=4 noches
      - Restricciones: No en fechas pico
      - Validez: 18-24 meses
      - Botón: "Solicitar Conversión"
  
  └─> POST /owner/night-credits/requests
  └─> Tab "Créditos" muestra solicitud pendiente
```

---

#### **HU-4: Cancelar Reserva de Marketplace**

**Como** propietario  
**Quiero** cancelar una reserva de marketplace  
**Para** liberar la semana si cambio de planes

**Estado Actual:** ⚠️ Backend existe, frontend no integrado

**Tareas:**
1. ✅ Backend: `POST /marketplace/bookings/:id/cancel` - YA EXISTE
2. ❌ Botón "Cancelar" en booking details
3. ❌ Modal de confirmación con política
4. ❌ Definir política de reembolso (decisión de negocio)
5. ❌ Reembolso de créditos según política

**Estimación:** 2 días  
**Complejidad:** Media  
**Decisión necesaria:** Política de cancelación

**Opciones de política:**
```
OPCIÓN A - Liberal:
- Cancelación hasta 48h antes: reembolso 100% créditos
- Cancelación 24-48h antes: reembolso 50% créditos
- Menos de 24h: sin reembolso

OPCIÓN B - Estricta:
- Cancelación hasta 7 días antes: reembolso 100%
- 3-7 días: 50%
- Menos de 3 días: sin reembolso

OPCIÓN C - Flexible:
- Cualquier momento: reembolso 100% créditos
- Semana vuelve a inventario automáticamente
```

---

### 🟡 PRIORIDAD MEDIA (Mejoras de UX)

#### **HU-5: Notificación de Créditos por Expirar**

**Como** propietario  
**Quiero** recibir alerta cuando mis créditos están por expirar  
**Para** no perder valor acumulado

**Tareas:**
1. Backend: Scheduled job diario
2. Backend: Detectar créditos expirando en 30 días
3. Backend: Enviar email de alerta
4. Frontend: Badge en dashboard con warning
5. Frontend: Modal de recordatorio al login

**Estimación:** 3 días  
**Complejidad:** Media

---

#### **HU-6: Filtros Avanzados en Historial de Créditos**

**Como** propietario con mucha actividad  
**Quiero** filtrar mi historial de créditos  
**Para** entender mejor mi uso

**Tareas:**
1. Filtro por tipo (earned, spent, expired)
2. Filtro por rango de fechas
3. Búsqueda por descripción
4. Paginación

**Estimación:** 2 días  
**Complejidad:** Baja

---

### 🟢 PRIORIDAD BAJA (Nice-to-have)

#### **HU-7: Estadísticas de Uso**

**Como** propietario  
**Quiero** ver estadísticas de mis semanas  
**Para** optimizar mi inversión

**Tareas:**
1. Gráfico de uso anual
2. Tasa de utilización
3. Valor generado vs invertido
4. Comparativa con otros propietarios

**Estimación:** 1 semana  
**Complejidad:** Alta

---

#### **HU-8: Guardados / Favoritos**

**Como** propietario  
**Quiero** guardar semanas que me interesan  
**Para** reservarlas más tarde

**Tareas:**
1. Botón "Guardar" en inventory items
2. Tabla de favoritos
3. Notificación si cambia disponibilidad

**Estimación:** 3 días  
**Complejidad:** Media

---

## 🎯 Plan de Acción Recomendado

### Sprint 1 - MVP Owner Completo (1 semana)

**Objetivo:** Owner puede usar TODO el flujo de marketplace con créditos + cash

**Tareas:**
1. 🔴 HU-1: Pago mixto con Stripe (3-4 días)
2. ⚠️ HU-2: Ver reservas en dashboard (1 día)
3. ⚠️ HU-3: Convertir a night credits desde dashboard (2 días)

**Resultado:** Sistema 95% completo para owner

---

### Sprint 2 - Pulir Experiencia (1 semana)

**Objetivo:** Mejorar UX y cerrar edge cases

**Tareas:**
1. ⚠️ HU-4: Cancelaciones con política definida (2 días)
2. 🟡 HU-5: Notificaciones de expiración (3 días)
3. 🟡 HU-6: Filtros avanzados (2 días)

**Resultado:** Sistema 100% completo y pulido

---

### Sprint 3+ - Opcional (Futuro)

**Tareas:**
1. 🟢 HU-7: Estadísticas (1 semana)
2. 🟢 HU-8: Favoritos (3 días)
3. Otros nice-to-have según feedback

---

## ✅ Decisiones Pragmáticas

### 1. ¿Qué NO implementar?

❌ **Swaps tradicionales** - Deprecar según visión de Antonio
- Código legacy existe pero no promover
- Ruta funciona pero sin integración en dashboard
- Converger todo a modelo de créditos

❌ **Páginas separadas redundantes**
- Weeks.tsx, Credits.tsx, MyBookings.tsx
- Mantener como legacy pero promover UnifiedDashboard

### 2. ¿Qué priorizar?

✅ **Pago mixto (Stripe)** - Es el único bloqueante real
✅ **Integración en dashboard** - Todo accesible desde una página
✅ **Cancelaciones** - Funcionalidad esperada por usuarios

### 3. ¿Qué puede esperar?

⏳ **Notificaciones** - Nice-to-have, no crítico
⏳ **Estadísticas** - Valor agregado pero no urgente
⏳ **Filtros avanzados** - Para power users, no MVP

---

## 📊 Métricas de Éxito

### Después de Sprint 1:

```
✅ Owner puede:
  1. Liberar semana → Recibir créditos (100%)
  2. Buscar alternativa → Reservar con créditos (100%)
  3. Reservar semana premium → Pagar diferencia con tarjeta (100%)
  4. Ver todas sus reservas en dashboard (100%)
  5. Convertir semana a night credits desde dashboard (100%)

✅ Flujos críticos:
  - Liberar → Buscar → Reservar (100%)
  - Créditos insuficientes → Pagar diferencia (100%)
  - Conversión a night credits (100%)

✅ Experiencia:
  - 3 páginas principales vs 14 originales (79% reducción)
  - Todo accesible en <3 clicks
  - Cero confusión de navegación
```

### Después de Sprint 2:

```
✅ Además:
  6. Cancelar reserva con política clara (100%)
  7. Recibir alertas de créditos por expirar (100%)
  8. Filtrar historial de créditos (100%)

✅ Sistema 100% completo para owner
```

---

## 🎯 Conclusión

**Estado Real:** 75-80% completo

**Bloqueantes reales:** Solo 1 - Integración Stripe para pago mixto

**Estimación realista:** 
- Sprint 1 (MVP): 1 semana
- Sprint 2 (Pulido): 1 semana
- **Total: 2 semanas para sistema 100% completo**

**Recomendación:** Enfocarse en Sprint 1 primero. Con eso, el owner puede usar TODO el sistema completo.

---

**Documento generado:** 25 de Enero, 2026  
**Autor:** Análisis Pragmático del Sistema  
**Versión:** 1.0 - Plan de Acción
