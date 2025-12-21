# Análisis Visual - Tres Tabs de Intercambios

## 🎯 Flujo Visual del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                   PÁGINA PRINCIPAL: /owner/swaps                │
│                                                                   │
│  Usuario autenticado (role: 'owner')                            │
│  Datos: useSwaps() + useWeeks()                                 │
└─────────────────────────────────────────────────────────────────┘
                               ↓
        ┌──────────────────────┬──────────────────────┐
        ↓                      ↓                      ↓
   ┌─────────────┐    ┌──────────────────┐   ┌──────────────────┐
   │  TAB 1      │    │     TAB 2        │   │     TAB 3        │
   │ 🔍 Explorar │    │  📋 Mis Solicitud│   │  ➕ Crear Solicit│
   │ Intercambios│    │  es              │   │  ud              │
   └─────────────┘    └──────────────────┘   └──────────────────┘
        ↓                      ↓                      ↓
  [Lee intercambios    [Lee intercambios    [Crea nuevo
   de otros owners]     creados por user]    intercambio]
```

---

## 📊 TAB 1: Explorar Intercambios

```
┌──────────────────────────────────────────────────────────┐
│           EXPLORAR INTERCAMBIOS (SwapsBrowseTab)          │
└──────────────────────────────────────────────────────────┘

INPUT DATOS:
  • availableSwaps: [] (filtrados de swaps globales)
  • weeks: [] (semanas del usuario)
  • userWeekAccommodationTypes: ['sencilla', 'suite']

PROCESOS INTERNOS:
  1. Filtro Inicial
     └─ Solo status: 'pending'
  
  2. Filtro por Tipo de Alojamiento
     └─ swap.RequesterWeek?.accommodation_type 
        DEBE estar en userWeekAccommodationTypes
  
  3. Filtros de Usuario (opcional)
     ├─ Por país (Property.location)
     └─ Por propiedad (Property.name)

OUTPUT:
  ├─ Tabla de intercambios disponibles
  ├─ Modal de detalles cuando hace click
  ├─ Selector de semana para responder
  └─ Botón de aceptar intercambio


EJEMPLO DE LÓGICA:

// Usuario tiene estas semanas:
const weeks = [
  { id: 1, accommodation_type: 'sencilla', ... },
  { id: 2, accommodation_type: 'suite', ... }
]
// userWeekAccommodationTypes = ['sencilla', 'suite']

// Intercambio disponible:
const swap = {
  id: 100,
  status: 'pending',
  RequesterWeek: {
    accommodation_type: 'sencilla'  // ✓ Usuario tiene este tipo
  }
}

// El intercambio SI aparece porque:
// 'sencilla' ∈ ['sencilla', 'suite']

// Intercambio NO disponible:
const swap2 = {
  id: 101,
  status: 'pending',
  RequesterWeek: {
    accommodation_type: 'duplex'  // ✗ Usuario NO tiene este tipo
  }
}

// NO aparece porque:
// 'duplex' ∉ ['sencilla', 'suite']
```

### Flujo de Usuario en TAB 1:

```
1. EXPLORAR
   └─ Ve lista de intercambios filtrados
   └─ Puede filtrar por país/propiedad

2. HACER CLICK EN UNO
   └─ Se abre modal con detalles
   └─ Muestra: propiedad, fechas, fee, estado

3. SELECCIONAR SEMANA
   └─ Dropdown con sus semanas disponibles
   └─ Filtra por mismo tipo de alojamiento
   └─ Ejemplo: Si ofrecen "suite", solo muestra sus "suites"

4. ACEPTAR
   └─ POST /owner/swaps/:id/accept
   └─ Envía responderWeekId
   └─ Backend actualiza estado a 'matched'

5. PAGO (si aplica)
   └─ Modal de pago con Stripe
   └─ €10 flat fee
```

---

## 📋 TAB 2: Mis Solicitudes

```
┌──────────────────────────────────────────────────────────┐
│         MIS SOLICITUDES (SwapsMyRequestsTab)              │
└──────────────────────────────────────────────────────────┘

INPUT DATOS:
  • swaps: [] (TODOS los swaps donde user es requester O responder)
  • weeks: [] (semanas del usuario)
  • getStatusColor: function
  • getStatusIcon: function

PROCESOS INTERNOS:
  1. No hay filtro de status en backend
     └─ Muestra TODOS los estados
  
  2. Filtros de Usuario (opcional)
     ├─ Por estado (pending, matched, completed, cancelled)
     └─ Por propiedad (RequesterWeek o ResponderWeek)

OUTPUT:
  ├─ Tabla con columnas:
  │   ├─ Status (badge de color)
  │   ├─ Propiedad
  │   ├─ Fechas
  │   ├─ Fee
  │   ├─ Creado
  │   └─ Ver (botón)
  └─ Modal de detalles cuando hace click


TABLA DE EJEMPLO:

┌─────────────────────────────────────────────────────────┐
│ Status  │ Propiedad │ Fechas      │ Fee │ Creado  │ ... │
├─────────────────────────────────────────────────────────┤
│ ⏳ Pending│ Resort A  │ 15-22 Dec   │ €10 │ 20 Dec  │ Ver │
│ ✓ Matched│ Hotel B   │ 1-8 Jan     │ €10 │ 19 Dec  │ Ver │
│ ✓✓ Complt│ Villa C   │ 25 Dec-1 En │ €10 │ 18 Dec  │ Ver │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Usuario en TAB 2:

```
1. VER TABLA
   └─ Muestra todos sus intercambios
   └─ Con filtros por estado/propiedad

2. HACER CLICK EN "VER"
   └─ Abre modal con detalles completos
   
3. SEGÚN ESTADO:
   ├─ pending
   │   └─ Puede cancelar
   ├─ matched
   │   └─ Muestra info de pago
   │   └─ Si no pagado: modal pago
   └─ completed
       └─ Muestra confirmación
```

---

## ➕ TAB 3: Crear Solicitud

```
┌──────────────────────────────────────────────────────────┐
│        CREAR SOLICITUD (SwapsCreateTab)                   │
└──────────────────────────────────────────────────────────┘

INPUT DATOS:
  • formData: { requester_week_id, desired_start_date, desired_property_id }
  • weeks: [] (semanas disponibles del usuario)
  • isCreating: boolean

PROCESOS INTERNOS:
  1. Extrae propiedades únicas del usuario
     └─ Para el select de "propiedad deseada"
  
  2. Renderiza selector de semanas
     └─ Con emojis de tipo de alojamiento
     └─ Muestra fechas y duración
  
  3. Formulario con criterios opcionales
     ├─ Propiedad deseada (dropdown)
     └─ Fecha deseada (date input)

OUTPUT:
  ├─ Selector de radio buttons (cual semana ofrecer)
  ├─ Filtros opcionales
  └─ Botones: Crear / Cancelar


FORMULARIO EJEMPLO:

┌─────────────────────────────────────────────────┐
│ CREAR SOLICITUD DE INTERCAMBIO                  │
├─────────────────────────────────────────────────┤
│ ¿Qué semana quieres intercambiar?               │
│ ( ) 🛏️ Sencilla - Resort A - 15-22 Dec        │
│ (X) 👑 Suite - Hotel B - 1-8 Jan - 7 noches   │
│ ( ) 🏠 Duplex - Villa C - 25 Dec-1 Jan        │
├─────────────────────────────────────────────────┤
│ ¿Qué buscas?                                    │
│ Propiedad: [Any property  ▼]                   │
│ Fecha:     [____________  ]                    │
│ 💡 Deja en blanco si eres flexible              │
├─────────────────────────────────────────────────┤
│ ✅ Crear solicitud es GRATIS                   │
│ Fee (€10) solo si alguien acepta                │
├─────────────────────────────────────────────────┤
│ [Crear Solicitud] [Cancelar]                   │
└─────────────────────────────────────────────────┘
```

### Flujo de Usuario en TAB 3:

```
1. SELECCIONAR SEMANA
   └─ Elige una de radio buttons
   └─ Ve emojis de tipo: 🛏️ 👑 🏠
   └─ Muestra fechas y duración

2. ESPECIFICAR CRITERIOS (opcional)
   ├─ Propiedad deseada
   └─ Fecha deseada
   (Ambos: dejar en blanco si flexible)

3. CREAR
   └─ POST /owner/swaps
   └─ Backend: status = 'pending'
   └─ Redirige a TAB 2 para ver

4. VER ESTADO
   └─ Va a TAB 2
   └─ Ve su nueva solicitud
   └─ Estado: ⏳ Pending
```

---

## 🔄 Transiciones entre Tabs

```
TAB 1 (Explorar)
  ├─ "Aceptar intercambio"
  │  └─ Abre modal de pago
  │
  └─ "Crear nuevo"
     └─ → TAB 3

TAB 2 (Mis Solicitudes)
  ├─ "Crear solicitud"
  │  └─ → TAB 3
  │
  └─ "Ver detalles"
     └─ Abre modal

TAB 3 (Crear)
  ├─ "Crear solicitud"
  │  └─ → TAB 2 (auto redirect)
  │
  └─ "Cancelar"
     └─ → TAB 1
```

---

## 🧪 Testing Checklist

### Setup
- [ ] Usuario creado con role: 'owner'
- [ ] Al menos 3 semanas creadas con tipos diferentes
- [ ] Otro usuario owner con semanas
- [ ] Usuario staff para pruebas de aprobación

### TAB 1 - Explorar
- [ ] Carga lista de intercambios disponibles
- [ ] Filtros funcionan correctamente
- [ ] Modal de detalles se abre/cierra
- [ ] Selector de semana solo muestra tipos válidos
- [ ] Botón aceptar funciona
- [ ] Modal de pago aparece cuando aplica

### TAB 2 - Mis Solicitudes  
- [ ] Muestra todas las solicitudes
- [ ] Filtros por estado funcionan
- [ ] Filtros por propiedad funcionan
- [ ] Modal de detalles se abre/cierra
- [ ] Ver detalles muestra información correcta

### TAB 3 - Crear
- [ ] Selector de semanas muestra todos los tipos
- [ ] Emojis se muestran correctamente
- [ ] Dropdown de propiedad funciona
- [ ] Date picker funciona
- [ ] Crear solicitud funciona
- [ ] Redirige a TAB 2 después de crear

### General
- [ ] Sin errores en consola
- [ ] Traducción i18n funciona
- [ ] Responsive en mobile
- [ ] Estados de loading/error muestran correctamente

---

## 🐛 Cambios Implementados

| Archivo | Cambio | Estado |
|---------|--------|--------|
| SwapsBrowseTab.tsx | userWeekColors → userWeekAccommodationTypes | ✅ |
| SwapsBrowseTab.tsx | getColorEmoji/Name → getAccommodationTypeEmoji/Name | ✅ |
| SwapsBrowseTab.tsx | w.color → w.accommodation_type | ✅ |
| SwapsCreateTab.tsx | getColorEmoji/Name → getAccommodationTypeEmoji/Name | ✅ |
| SwapsCreateTab.tsx | week.color → week.accommodation_type | ✅ |
| swapService.ts | full_name → firstName, lastName | ✅ |

---

## 📊 Datos de Ejemplo (para testing)

### Usuario Owner A:
```json
{
  "id": 1,
  "email": "owner.a@example.com",
  "role": "owner",
  "weeks": [
    {
      "id": 10,
      "property_id": 100,
      "accommodation_type": "sencilla",
      "start_date": "2025-12-15",
      "end_date": "2025-12-22"
    },
    {
      "id": 11,
      "property_id": 101,
      "accommodation_type": "suite",
      "start_date": "2026-01-01",
      "end_date": "2026-01-08"
    }
  ]
}
```

### Usuario Owner B (para crear intercambios):
```json
{
  "id": 2,
  "email": "owner.b@example.com",
  "role": "owner",
  "weeks": [
    {
      "id": 20,
      "property_id": 200,
      "accommodation_type": "sencilla",
      "start_date": "2025-12-23",
      "end_date": "2025-12-30"
    }
  ]
}
```

### Intercambio en DB:
```json
{
  "id": 1000,
  "requester_id": 2,
  "requester_week_id": 20,
  "responder_week_id": null,
  "status": "pending",
  "swap_fee": 10,
  "payment_status": "pending",
  "created_at": "2025-12-20T10:00:00Z"
}
```

