# Análisis de Historias de Usuario del Owner - Estado Actual

**Fecha:** 25 de Enero, 2026  
**Versión Sistema:** Post-Simplificación (3 páginas unificadas)  
**Estado:** Análisis de cumplimiento vs requisitos

---

## 📊 Resumen Ejecutivo

Este documento analiza las historias de usuario del Owner según los requisitos documentados en PROJECT_OVERVIEW.md, IMPLEMENTATION_PLAN.md y SIMPLIFICATION_STRATEGY.md, comparándolas con la implementación actual después de la simplificación frontend.

### Visión del Sistema

Según Antonio (SIMPLIFICATION_STRATEGY.md), el Owner tiene **solo 2 intenciones reales**:

```
1️⃣ NO voy a usar esta semana
   └─> Convertirla en valor/créditos
   └─> Liberarla al marketplace

2️⃣ QUIERO usarla, pero en otro tiempo/lugar
   └─> Buscar alternativa en marketplace
   └─> "Swapear" usando créditos
```

---

## ✅ Historias de Usuario Implementadas

### 🏠 **HU-1: Dashboard Unificado**

**Como** propietario  
**Quiero** ver todo mi estado en un solo lugar  
**Para** gestionar mis semanas, reservas y créditos sin navegar múltiples páginas

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver resumen de semanas disponibles | ✅ | UnifiedDashboard.tsx - Stats cards |
| Ver balance de créditos | ✅ | UnifiedDashboard.tsx - Credits card |
| Ver próximas reservas | ✅ | UnifiedDashboard.tsx - Bookings tab |
| Acciones rápidas (liberar, convertir) | ✅ | Action buttons en dashboard |
| Navegación por tabs (Semanas, Reservas, Créditos) | ✅ | Tab system implementado |

**Archivo:** [frontend/src/pages/owner/UnifiedDashboard.tsx](../frontend/src/pages/owner/UnifiedDashboard.tsx)

---

### 🛒 **HU-2: Marketplace Unificado**

**Como** propietario  
**Quiero** buscar y reservar semanas disponibles en una sola página  
**Para** encontrar alternativas a mi semana fácilmente

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver inventario disponible | ✅ | MarketplacePage.tsx - Search section |
| Filtrar por ubicación/fechas | ✅ | Search filters implementados |
| Ver costo en créditos | ✅ | Inventory items muestran créditos |
| Reservar con un click | ✅ | Modal de confirmación + booking |
| Ver mis semanas para liberar | ✅ | Release section en marketplace |

**Archivo:** [frontend/src/pages/owner/MarketplacePage.tsx](../frontend/src/pages/owner/MarketplacePage.tsx)

---

### 👤 **HU-3: Mi Cuenta Unificada**

**Como** propietario  
**Quiero** gestionar toda mi información personal y configuraciones en un lugar  
**Para** no perderme entre múltiples páginas

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Editar información personal | ✅ | MyAccount.tsx - Tab "Información Personal" |
| Cambiar contraseña | ✅ | ChangePasswordModal en MyAccount |
| Configurar notificaciones | ✅ | MyAccount.tsx - Tab "Notificaciones" |
| Gestionar método de pago | ✅ | MyAccount.tsx - Tab "Método de Pago" |
| Todo en tabs sin cambiar de página | ✅ | Tab navigation implementado |

**Archivo:** [frontend/src/pages/owner/MyAccount.tsx](../frontend/src/pages/owner/MyAccount.tsx)

---

### 📅 **HU-4: Gestión de Mis Semanas**

**Como** propietario  
**Quiero** ver y gestionar todas mis semanas  
**Para** decidir qué hacer con cada una (usar, liberar, convertir)

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver lista de mis semanas | ✅ | UnifiedDashboard.tsx - Tab "Semanas" |
| Ver estado de cada semana | ✅ | Status badges (available, confirmed, etc.) |
| Ver fechas y property | ✅ | Week cards con info completa |
| Acción: Confirmar uso | ✅ | Botón en cada week |
| Acción: Convertir a créditos | ⚠️ | Ver HU-6 (parcial) |
| Acción: Liberar al marketplace | ✅ | MarketplacePage - Release section |

**Archivo:** [frontend/src/pages/owner/UnifiedDashboard.tsx](../frontend/src/pages/owner/UnifiedDashboard.tsx)  
**Relacionado:** [frontend/src/pages/owner/Weeks.tsx](../frontend/src/pages/owner/Weeks.tsx) (página legacy mantenida)

---

### 💳 **HU-5: Ver Balance de Créditos**

**Como** propietario  
**Quiero** ver mi balance de créditos y transacciones  
**Para** saber cuántos créditos tengo disponibles para bookings

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver balance actual | ✅ | UnifiedDashboard.tsx - Credits card |
| Ver créditos por expirar | ✅ | Expiration warning en dashboard |
| Ver historial de transacciones | ✅ | Credits tab con tabla de historial |
| Filtrar transacciones | ⚠️ | Pendiente (ver HU-Missing-2) |

**Archivo:** [frontend/src/pages/owner/UnifiedDashboard.tsx](../frontend/src/pages/owner/UnifiedDashboard.tsx)  
**Página Completa:** [frontend/src/pages/owner/Credits.tsx](../frontend/src/pages/owner/Credits.tsx) (legacy mantenida)

---

### 🔄 **HU-6: Convertir Semana a Créditos (Night Credits)**

**Como** propietario  
**Quiero** convertir una semana que no voy a usar en créditos nocturnos  
**Para** tener flexibilidad de uso en diferentes fechas

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Seleccionar semana a convertir | ⚠️ | Disponible en Weeks.tsx legacy |
| Ver cuántos créditos recibiré | ⚠️ | Cálculo según color (Red=6, Blue=5, White=4) |
| Solicitar conversión | ⚠️ | `POST /owner/night-credits/requests` |
| Ver estado de solicitud | ⚠️ | NightCreditRequests.tsx |
| Staff aprueba conversión | ✅ | Backend implementado |

**Archivos:**
- [frontend/src/pages/owner/NightCreditRequests.tsx](../frontend/src/pages/owner/NightCreditRequests.tsx)
- [frontend/src/pages/owner/MyNightCreditRequests.tsx](../frontend/src/pages/owner/MyNightCreditRequests.tsx)
- [backend/src/routes/ownerNightCreditRoutes.ts](../backend/src/routes/ownerNightCreditRoutes.ts)

**⚠️ NOTA:** Flujo funcional pero NO integrado en UnifiedDashboard aún.

---

### 🔍 **HU-7: Buscar Semanas en Marketplace**

**Como** propietario  
**Quiero** buscar semanas disponibles como en Booking.com  
**Para** encontrar alternativas a mi semana rápidamente

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Buscar por ubicación | ✅ | MarketplacePage - Location filter |
| Buscar por fechas | ✅ | Date range picker |
| Filtrar por tipo de acomodación | ✅ | Accommodation type filter |
| Ver precio en créditos | ✅ | Cada item muestra costo |
| Ver disponibilidad en tiempo real | ✅ | API: `GET /marketplace/inventory` |

**Archivo:** [frontend/src/pages/owner/MarketplacePage.tsx](../frontend/src/pages/owner/MarketplacePage.tsx)  
**Backend:** [backend/src/routes/marketplaceRoutes.ts](../backend/src/routes/marketplaceRoutes.ts)

---

### 📖 **HU-8: Reservar con Créditos**

**Como** propietario  
**Quiero** reservar una semana usando mis créditos  
**Para** "intercambiar" mi semana por otra automáticamente

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Seleccionar semana del marketplace | ✅ | Click en "Reservar" |
| Ver mi balance vs costo | ✅ | Modal muestra ambos |
| Ver diferencia a pagar (si aplica) | ⚠️ | Ver HU-Missing-3 |
| Confirmar con créditos suficientes | ✅ | `POST /marketplace/bookings` |
| Pagar diferencia si falta | ❌ | NO implementado (ver HU-Missing-3) |
| Confirmación inmediata | ✅ | Modal de éxito |

**Archivo:** [frontend/src/pages/owner/MarketplacePage.tsx](../frontend/src/pages/owner/MarketplacePage.tsx)  
**Backend:** [backend/src/services/CreditBookingService.ts](../backend/src/services/CreditBookingService.ts)

---

### 📋 **HU-9: Ver Mis Reservas**

**Como** propietario  
**Quiero** ver todas mis reservas (normales y con créditos)  
**Para** gestionar mis próximos viajes

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver reservas activas | ✅ | UnifiedDashboard - Tab "Reservas" |
| Ver reservas pasadas | ✅ | Filtrado por estado |
| Ver detalles de reserva | ✅ | Click → Modal con detalles |
| Ver si fue con créditos | ⚠️ | Pendiente indicador visual |
| Cancelar reserva | ⚠️ | Ver HU-Missing-4 |

**Archivo:** [frontend/src/pages/owner/UnifiedDashboard.tsx](../frontend/src/pages/owner/UnifiedDashboard.tsx)  
**Página Completa:** [frontend/src/pages/owner/MyBookings.tsx](../frontend/src/pages/owner/MyBookings.tsx) (legacy)

---

### 🆓 **HU-10: Liberar Semana al Marketplace**

**Como** propietario  
**Quiero** liberar una semana que no voy a usar al marketplace  
**Para** recibir créditos y que otros puedan reservarla

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver mis semanas disponibles | ✅ | MarketplacePage - Release section |
| Ver cuántos créditos recibiré | ✅ | Preview del cálculo |
| Liberar semana con un click | ✅ | `POST /marketplace/weeks/:id/release` |
| Semana entra a inventario automáticamente | ✅ | InventoryService backend |
| Recibir créditos inmediatamente | ✅ | WeekReleaseService |

**Archivo:** [frontend/src/pages/owner/MarketplacePage.tsx](../frontend/src/pages/owner/MarketplacePage.tsx)  
**Backend:** [backend/src/services/WeekReleaseService.ts](../backend/src/services/WeekReleaseService.ts)

---

## ❌ Historias de Usuario FALTANTES (Críticas)

### 🚨 **HU-Missing-1: Swaps Tradicionales**

**Problema:** El sistema actual de swaps tradicionales (peer-to-peer) está implementado pero:
- ❌ NO está integrado en las páginas simplificadas
- ❌ Requiere navegación a página legacy [Swaps.tsx](../frontend/src/pages/owner/Swaps.tsx)
- ❌ Flujo complejo que contradice visión de Antonio

**Decisión Estratégica:**
Según SIMPLIFICATION_STRATEGY.md, Antonio quiere **deprecar swaps tradicionales** y converger todo a modelo de créditos.

**Recomendación:**
- ✅ Mantener código backend legacy para swaps existentes
- ❌ NO integrar en UnifiedDashboard
- ✅ Promover flujo: Liberar → Créditos → Buscar → Reservar

---

### ⚠️ **HU-Missing-2: Filtros Avanzados de Créditos**

**Como** propietario  
**Quiero** filtrar mi historial de créditos por tipo de transacción  
**Para** entender mejor mi uso de créditos

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Filtrar por tipo (earned, spent, expired) | ❌ | NO implementado |
| Filtrar por rango de fechas | ❌ | NO implementado |
| Exportar historial | ❌ | NO implementado |
| Ver gráfico de uso | ❌ | NO implementado |

**Prioridad:** Media  
**Estimación:** 2-3 días  
**Archivo Afectado:** Credits.tsx o UnifiedDashboard.tsx

---

### 🔴 **HU-Missing-3: Pago de Diferencia (Créditos + Cash)**

**Como** propietario  
**Quiero** pagar la diferencia con dinero cuando no tengo suficientes créditos  
**Para** poder reservar semanas premium sin liberar más semanas

**Ejemplo:**
```
Tengo: 1,000 créditos
Quiero: Semana que cuesta 1,200 créditos
Diferencia: 200 créditos = €XX

Sistema debe:
1. Mostrar: "Te faltan 200 créditos (€XX)"
2. Opciones:
   - Comprar 200 créditos
   - Pagar €XX directamente
3. Procesar pago con Stripe
4. Completar booking
```

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Calcular diferencia automáticamente | ❌ | NO implementado |
| Mostrar opciones de pago | ❌ | NO implementado |
| Integración Stripe para diferencia | ❌ | NO implementado |
| Booking mixto (créditos + cash) | ❌ | NO implementado |

**Prioridad:** 🔴 ALTA  
**Estimación:** 1 semana  
**Impacto:** CRÍTICO para flujo completo según visión de Antonio  
**Archivos Afectados:**
- Frontend: MarketplacePage.tsx - Modal de reserva
- Backend: CreditBookingService.ts - Lógica de pago mixto
- Backend: Stripe integration

---

### ⚠️ **HU-Missing-4: Cancelación de Reservas**

**Como** propietario  
**Quiero** cancelar una reserva  
**Para** liberar la semana si cambio de planes

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Ver opción de cancelar en reserva | ❌ | NO implementado |
| Política de cancelación clara | ❌ | NO definida |
| Reembolso de créditos | ❌ | NO implementado |
| Penalización por cancelación | ❌ | NO implementado |

**Prioridad:** Media-Alta  
**Estimación:** 3-4 días  
**Decisión Necesaria:** Política de cancelación y reembolsos

---

### ⚠️ **HU-Missing-5: Notificaciones y Alertas**

**Como** propietario  
**Quiero** recibir notificaciones de eventos importantes  
**Para** no perder oportunidades o vencimientos

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Alerta: Créditos por expirar (30 días antes) | ❌ | NO implementado |
| Alerta: Nueva semana disponible en marketplace | ❌ | NO implementado |
| Notificación: Reserva confirmada | ❌ | NO implementado |
| Email: Resumen semanal de actividad | ❌ | NO implementado |

**Prioridad:** Media  
**Estimación:** 1 semana  
**Archivos:**
- Backend: Notification service + Scheduled jobs
- Frontend: Notification center en Sidebar

---

### 📊 **HU-Missing-6: Reportes y Analíticas**

**Como** propietario  
**Quiero** ver estadísticas de uso de mis semanas y créditos  
**Para** optimizar mi inversión

| Criterio de Aceptación | Estado | Implementación |
|------------------------|--------|----------------|
| Gráfico: Uso anual de semanas | ❌ | NO implementado |
| Métrica: Tasa de utilización | ❌ | NO implementado |
| Métrica: Créditos ganados vs gastados | ❌ | NO implementado |
| Comparativa: Valor recibido vs invertido | ❌ | NO implementado |

**Prioridad:** Baja-Media  
**Estimación:** 1-2 semanas  
**Decisión:** ¿Dashboard o página separada?

---

## 🔄 Funcionalidades Legacy Mantenidas (No en Dashboard)

Estas páginas existen pero NO están integradas en el nuevo dashboard unificado:

1. **Swaps.tsx** - ⚠️ Sistema de swaps tradicionales
   - Funcional pero fuera del flujo simplificado
   - Accesible vía ruta directa `/owner/swaps`
   - Decisión: Deprecar según visión de Antonio

2. **Weeks.tsx** - ⚠️ Gestión detallada de semanas
   - Vista completa de semanas con acciones
   - Duplica funcionalidad del tab en UnifiedDashboard
   - Decisión: Migrar funcionalidades faltantes al dashboard

3. **Credits.tsx** - ⚠️ Vista detallada de créditos
   - Historial completo y estadísticas
   - Más completo que el tab en UnifiedDashboard
   - Decisión: Mantener como "vista detallada" opcional

4. **ConvertWeek.tsx** - ⚠️ Conversión de semanas
   - Flujo de conversión a night credits
   - NO accesible desde UnifiedDashboard
   - Decisión: Integrar en dashboard o deprecar

---

## 📊 Matriz de Cumplimiento

| Historia de Usuario | Estado | Prioridad | Ubicación |
|---------------------|--------|-----------|-----------|
| HU-1: Dashboard Unificado | ✅ 100% | ALTA | UnifiedDashboard.tsx |
| HU-2: Marketplace Unificado | ✅ 100% | ALTA | MarketplacePage.tsx |
| HU-3: Mi Cuenta | ✅ 100% | ALTA | MyAccount.tsx |
| HU-4: Gestión Semanas | ✅ 90% | ALTA | UnifiedDashboard + Weeks.tsx |
| HU-5: Balance Créditos | ✅ 85% | ALTA | UnifiedDashboard + Credits.tsx |
| HU-6: Convertir a Créditos | ⚠️ 70% | MEDIA | NightCreditRequests.tsx (no integrado) |
| HU-7: Buscar Marketplace | ✅ 100% | ALTA | MarketplacePage.tsx |
| HU-8: Reservar con Créditos | ⚠️ 80% | ALTA | MarketplacePage.tsx (falta pago mixto) |
| HU-9: Ver Reservas | ✅ 85% | ALTA | UnifiedDashboard + MyBookings.tsx |
| HU-10: Liberar Semana | ✅ 100% | ALTA | MarketplacePage.tsx |
| HU-Missing-1: Swaps Tradicionales | ⚠️ Legacy | BAJA | Swaps.tsx (deprecar) |
| HU-Missing-2: Filtros Créditos | ❌ 0% | MEDIA | Credits.tsx |
| HU-Missing-3: Pago Mixto | ❌ 0% | 🔴 ALTA | MarketplacePage + Backend |
| HU-Missing-4: Cancelaciones | ❌ 0% | MEDIA-ALTA | MyBookings + Backend |
| HU-Missing-5: Notificaciones | ❌ 0% | MEDIA | Backend + Notification center |
| HU-Missing-6: Reportes | ❌ 0% | BAJA-MEDIA | Dashboard o nueva página |

---

## 🎯 Recomendaciones Prioritarias

### 1. 🔴 CRÍTICO - Implementar HU-Missing-3: Pago Mixto

**Por qué:**
- Es el eslabón faltante del flujo core según visión de Antonio
- Sin esto, owners no pueden reservar semanas premium
- Bloquea casos de uso reales y monetización

**Tareas:**
1. Backend: Modificar `CreditBookingService` para pagos mixtos
2. Backend: Endpoint para calcular diferencia y opciones de pago
3. Backend: Integración Stripe para diferencia
4. Frontend: Modal en MarketplacePage con opciones de pago
5. Testing: Casos edge (créditos exactos, faltantes, sobrantes)

**Estimación:** 5-7 días  
**Impacto:** 🔴 ALTO

---

### 2. ⚠️ MEDIA - Integrar Night Credits en UnifiedDashboard

**Por qué:**
- Funcionalidad existe pero no es accesible desde dashboard
- Owners deben navegar a páginas legacy
- Rompe experiencia unificada

**Tareas:**
1. Agregar botón "Convertir a Créditos" en Week cards
2. Modal de conversión en UnifiedDashboard
3. Integrar vista de solicitudes en tab Credits
4. Deprecar páginas legacy NightCreditRequests.tsx

**Estimación:** 2-3 días  
**Impacto:** ⚠️ MEDIO

---

### 3. ⚠️ MEDIA - Implementar HU-Missing-4: Cancelaciones

**Por qué:**
- Funcionalidad esperada por usuarios
- Casos de uso reales (cambio de planes)
- Falta política de reembolso definida

**Decisiones Necesarias:**
1. ¿Política de cancelación? (plazo, penalización)
2. ¿Reembolso total o parcial de créditos?
3. ¿Semana vuelve a inventario?

**Tareas:**
1. Definir política de cancelación
2. Backend: Lógica de cancelación y reembolso
3. Frontend: Botón de cancelar en MyBookings
4. Testing: Reembolsos, inventario, créditos

**Estimación:** 3-4 días  
**Impacto:** ⚠️ MEDIO

---

### 4. ⚠️ BAJA - Implementar HU-Missing-2: Filtros de Créditos

**Por qué:**
- Mejora UX para owners con mucha actividad
- No es bloqueante pero agrega valor

**Tareas:**
1. Agregar filtros en Credits.tsx o tab Credits
2. Backend: Modificar endpoint para filtrado
3. UI: Date range picker + tipo de transacción

**Estimación:** 2 días  
**Impacto:** 🟢 BAJO

---

### 5. 🟢 OPCIONAL - Implementar HU-Missing-5: Notificaciones

**Por qué:**
- Aumenta engagement
- Previene pérdida de créditos por expiración
- No es bloqueante para MVP

**Tareas:**
1. Backend: Notification service
2. Backend: Scheduled jobs para alertas
3. Frontend: Notification center
4. Email: Templates y envío

**Estimación:** 1 semana  
**Impacto:** 🟢 BAJO-MEDIO

---

### 6. 🟢 FUTURO - Implementar HU-Missing-6: Reportes

**Por qué:**
- Nice-to-have
- Valor agregado para power users
- No urgente

**Estimación:** 1-2 semanas  
**Impacto:** 🟢 BAJO

---

## ✅ Conclusión

### Estado General: 75% Completo

**Fortalezas:**
- ✅ Experiencia unificada en 3 páginas principales
- ✅ Flujo core de liberar → buscar → reservar funcional
- ✅ Marketplace tipo Booking.com implementado
- ✅ Backend robusto con servicios core completos

**Debilidades:**
- ❌ **CRÍTICO:** Falta pago mixto (créditos + cash)
- ⚠️ Funcionalidades legacy no integradas en dashboard
- ⚠️ Notificaciones y alertas ausentes
- ⚠️ Cancelaciones sin implementar

**Próximos Pasos:**
1. **Inmediato:** Implementar pago mixto (HU-Missing-3)
2. **Corto plazo:** Integrar night credits en dashboard
3. **Medio plazo:** Cancelaciones y notificaciones
4. **Largo plazo:** Reportes y analíticas

---

**Documento generado:** 25 de Enero, 2026  
**Autor:** Sistema de Análisis  
**Versión:** 1.0
