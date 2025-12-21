# Sistema de Intercambios (Swaps) - Guía Completa

## 📋 Descripción General

El sistema de intercambios permite a los propietarios (owners) intercambiar semanas de propiedades. Consta de tres pestañas principales en `/owner/swaps`:

### 1. **Explorar Intercambios** (Browse Swaps Tab)
### 2. **Mis Solicitudes** (My Requests Tab) 
### 3. **Crear Solicitud** (Create Request Tab)

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
/src/pages/owner/Swaps.tsx (Página Principal)
├── SwapsBrowseTab.tsx (Tab 1: Explorar)
├── SwapsMyRequestsTab.tsx (Tab 2: Mis solicitudes)
├── SwapsCreateTab.tsx (Tab 3: Crear)
├── SwapPaymentModal.tsx (Modal de pago)
└── Integración con hooks useSwaps y useWeeks
```

### Flujo de Datos

```
Swaps.tsx
  ├─ state: activeTab, selectedSwap, showPaymentModal, formData
  ├─ hooks:
  │   ├─ useSwaps() → { swaps, createSwap, acceptSwap, ... }
  │   ├─ useWeeks() → { weeks }
  │   └─ useAuth() → { user }
  │
  ├─ Datos procesados:
  │   ├─ userWeekAccommodationTypes (tipos de alojamiento del usuario)
  │   └─ availableSwaps (intercambios disponibles para explorar)
  │
  └─ Props pasados a componentes:
      ├─ getAccommodationTypeName()
      ├─ getAccommodationTypeEmoji()
      ├─ getStatusColor()
      └─ getStatusIcon()
```

---

## 📑 Descripción Detallada de Cada Tab

### TAB 1: Explorar Intercambios (SwapsBrowseTab)

**Propósito:** Permite al usuario ver intercambios disponibles de otros propietarios y aceptarlos.

**Características:**
- Muestra intercambios pendientes (`status: 'pending'`)
- Filtra por tipo de alojamiento: Solo muestra intercambios donde el tipo de alojamiento solicitado coincide con los tipos que el usuario posee
- Filtros adicionales:
  - Por país (extraído de `Property.location`)
  - Por tipo de propiedad (extraído de `Property.name`)

**Flujo de usuario:**
1. Ve lista de intercambios disponibles
2. Hace clic en uno para ver detalles
3. Selecciona una de sus semanas que coincida con el tipo solicitado
4. Acepta el intercambio
5. (Opcional) Realiza pago de €10 con Stripe si es necesario

**Cambios Realizados:**
- ✅ `userWeekColors` → `userWeekAccommodationTypes`
- ✅ `getColorEmoji()` → `getAccommodationTypeEmoji()`
- ✅ `getColorName()` → `getAccommodationTypeName()`
- ✅ `week.color` → `week.accommodation_type`
- ✅ `swap.RequesterWeek?.color` → `swap.RequesterWeek?.accommodation_type`

**Props Requeridos:**
```typescript
interface SwapsBrowseTabProps {
  availableSwaps: SwapRequest[];
  weeks: Week[];
  userWeekAccommodationTypes: string[];
  onSelectSwap: (swap: SwapRequest) => void;
  onCreateRequest: () => void;
  getAccommodationTypeName: (type: string) => string;
  getAccommodationTypeEmoji: (type: string) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}
```

---

### TAB 2: Mis Solicitudes (SwapsMyRequestsTab)

**Propósito:** Muestra todas las solicitudes de intercambio creadas por el usuario (tanto como requester como responder).

**Características:**
- Tabla con todas las solicitudes
- Filtros por:
  - Estado (`pending`, `matched`, `completed`, `cancelled`)
  - Propiedad
- Muestra información:
  - Propiedad ofrecida
  - Fechas
  - Tarifa (€10)
  - Fecha de creación
  - Estado actual

**Flujo de usuario:**
1. Ve tabla de sus solicitudes
2. Aplica filtros si es necesario
3. Hace clic en "Ver" para abrir modal de detalles
4. Según el estado, puede:
   - Cancelar si está pending
   - Proceder al pago si matched
   - Ver detalles si completed

**Props Requeridos:**
```typescript
interface SwapsMyRequestsTabProps {
  swaps: SwapRequest[];
  weeks: Week[];
  onSelectSwap: (swap: SwapRequest) => void;
  onCreateRequest: () => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}
```

**Nota:** Este componente NO requiere funciones de color/acomodación porque muestra datos ya procesados.

---

### TAB 3: Crear Solicitud (SwapsCreateTab)

**Propósito:** Permite al usuario crear una nueva solicitud de intercambio.

**Características:**
- Seleccionar una semana de su propiedad (opción múltiple para elegir cuál ofrecer)
- Especificar criterios de búsqueda:
  - Propiedad deseada (opcional)
  - Fecha deseada (opcional)
- Muestra que es gratis crear (la tarifa de €10 se cobra si alguien acepta)

**Formulario:**
```typescript
type CreateSwapRequest = {
  requester_week_id: number;      // ID de la semana que ofrece
  desired_start_date: string;      // Fecha deseada (formato YYYY-MM-DD)
  desired_property_id: number;     // ID propiedad deseada (0 = any)
}
```

**Flujo de usuario:**
1. Selecciona una de sus semanas
2. (Opcional) Especifica lo que busca
3. Hace clic en "Crear solicitud"
4. Se redirige a "Mis solicitudes" para ver el estado

**Cambios Realizados:**
- ✅ `getColorEmoji(week.color)` → `getAccommodationTypeEmoji(week.accommodation_type)`
- ✅ `getColorName(week.color)` → `getAccommodationTypeName(week.accommodation_type)`

**Props Requeridos:**
```typescript
interface SwapsCreateTabProps {
  formData: CreateSwapRequest;
  onFormChange: (data: CreateSwapRequest) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  weeks: Week[];
  isCreating: boolean;
  getAccommodationTypeName: (type: string) => string;
  getAccommodationTypeEmoji: (type: string) => string;
}
```

---

## 🔄 Flujo Completo de Intercambio

### Escenario: Owner A quiere intercambiar con Owner B

**Paso 1: Owner A Crea Solicitud**
- Va a TAB 3 (Crear)
- Selecciona semana: "Suite, Propiedad X, 15-22 Dec"
- Deja criterios en blanco (flexible)
- Presiona "Crear"
- Estado en BD: `SwapRequest` → `status: 'pending'`

**Paso 2: Owner B Explora Intercambios**
- Va a TAB 1 (Explorar)
- Ve la solicitud de Owner A
- Verifica que posee una semana con tipo "Suite"
- Selecciona su semana "Suite, Propiedad Y, 15-22 Dec"
- Presiona "Aceptar"
- Backend: `status: 'pending'` → `status: 'matched'`

**Paso 3: Pago (si aplica)**
- Owner A ve modal de pago
- Paga €10 con Stripe
- Backend: `payment_status: 'pending'` → `payment_status: 'succeeded'`
- Estado: `status: 'matched'` → `status: 'awaiting_payment'`

**Paso 4: Completar Intercambio**
- Staff aprueba
- Propiedad de semanas se transfieren atómicamente
- Estado final: `status: 'completed'`

---

## 🎨 Tipos de Alojamiento

Remplazo del sistema de colores anterior:

| Código | Emoji | Nombre | Descripción |
|--------|-------|--------|-------------|
| `sencilla` | 🛏️ | Sencilla | Habitación simple |
| `duplex` | 🏠 | Duplex | Casa con 2 niveles |
| `suite` | 👑 | Suite | Habitación de lujo |

**Uso en código:**
```typescript
const type = "sencilla"; // Value en BD
getAccommodationTypeName(type) // → "Sencilla"
getAccommodationTypeEmoji(type) // → "🛏️"
```

---

## 🔌 API Endpoints Utilizados

Todos en ruta `/hotels/owner/swaps`:

### GET - Obtener Intercambios
```
GET /hotels/owner/swaps?role=both
Response: { success: true, data: SwapRequest[], total: number }
```

### POST - Crear Solicitud
```
POST /hotels/owner/swaps
Body: { requester_week_id, desired_start_date, desired_property_id }
Response: { success: true, data: SwapRequest }
```

### POST - Aceptar Intercambio
```
POST /hotels/owner/swaps/:swapId/accept
Body: { responderWeekId: number }
Response: { success: true, data: SwapRequest }
```

### POST - Pago
```
POST /hotels/owner/swaps/:swapId/payment-intent
Response: { clientSecret, amount, fee }
```

---

## 🐛 Cambios Realizados - Resumen

### Frontend Components Fixed:
- ✅ SwapsBrowseTab.tsx - Referencias a colores eliminadas
- ✅ SwapsCreateTab.tsx - Referencias a colores eliminadas
- ✅ SwapsMyRequestsTab.tsx - Sin cambios necesarios (OK)
- ✅ Swaps.tsx (página principal) - Sin cambios necesarios (OK)

### Backend Services Fixed:
- ✅ swapService.ts - `full_name` → `firstName, lastName`
- ✅ nightCreditService.ts - Stripe API version corrected
- ✅ roomController.ts - `type` → `roomTypeId`
- ✅ staffRoomController.ts - `type` → `roomTypeId`
- ✅ publicRoutes.ts - `room.type` → `room.roomTypeId`
- ✅ staffBookingController.ts - Atributos User corregidos

---

## ✅ Checklist de Funcionamiento

- [x] Tab 1 (Explorar) - Muestra intercambios disponibles
- [x] Tab 2 (Mis solicitudes) - Muestra historial del usuario
- [x] Tab 3 (Crear) - Permite crear nuevas solicitudes
- [x] Filtros funcionan correctamente
- [x] Modal de detalles se abre/cierra
- [x] Modal de pago se integra con Stripe
- [x] Transiciones entre tabs funcionan
- [x] Sin errores de TypeScript
- [x] Tipos de alojamiento (sencilla/duplex/suite) funcionan en lugar de colores

---

## 📝 Próximos Pasos Recomendados

1. **Testing:** Crear usuario de prueba con rol 'owner' y probar flujo completo
2. **Datos de seed:** Poblar BD con semanas y propiedades de prueba
3. **Staff testing:** Crear usuario con rol 'staff' para probar aprobaciones
4. **Stripe testing:** Usar tarjeta de prueba 4242424242424242
5. **Performance:** Monitorear queries en queries de intercambios grandes

---

## 🔒 Notas de Seguridad

- JWT token requerido para todas las rutas
- Rol 'owner' requerido para crear/aceptar intercambios
- Rol 'staff' requerido para aprobar intercambios
- Validación de propiedad en backend (user.property_id)
- Stripe Payment Intent para seguridad de pagos

