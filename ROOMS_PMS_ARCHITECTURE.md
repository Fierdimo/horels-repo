# Arquitectura de Habitaciones: PMS vs BD Local

## 📋 Análisis Actual del Sistema

Actualmente, el sistema sincroniza las habitaciones desde el PMS (Mews) y almacena TODA la información en la base de datos local. Sin embargo, según el requisito de negocio, **solo deberían guardarse datos complementarios** que no existan en el PMS.

---

## 🔍 Datos que VIENEN del PMS

Los datos que obtiene el PMS y que actualmente se guardan en `rooms` table:

### De `getAvailability()` - Resource (Habitación)
| Campo | Tipo | Descripción | ¿Guardar? |
|-------|------|-------------|-----------|
| `Id` | String | ID único de la habitación en PMS | ✅ SÍ (como `pms_resource_id`) |
| `Name` | String | Nombre de la habitación (ej: "Room 101") | ❌ NO, consultar en tiempo real |
| `ServiceId` | String | ID del servicio asociado | ❌ NO, no necesario |
| `IsActive` | Boolean | Si está activa en PMS | ❌ NO, consultar en tiempo real |
| `FloorNumber` | String | Piso donde está (ej: "1", "2") | ❌ NO, consultar en tiempo real |
| `Capacity` | Number | Capacidad de huéspedes | ❌ NO, consultar en tiempo real |
| `Description` | String | Descripción | ❌ NO, consultar en tiempo real |

### De `getAvailability()` - Service (Tipo de Habitación)
| Campo | Tipo | Descripción | ¿Guardar? |
|-------|------|-------------|-----------|
| `Id` | String | ID del servicio | ❌ NO, no necesario |
| `Name` | String | Tipo (ej: "Standard Room", "Double") | ❌ NO, consultar en tiempo real |
| `DefaultPrice` | Decimal | Precio base | ❌ NO, consultar en tiempo real |

---

## 💾 Datos COMPLEMENTARIOS (guardar en BD local)

Datos que **NO** vienen del PMS y que son específicos de la plataforma:

| Campo | Tipo | Descripción | Propósito |
|-------|------|-------------|----------|
| `pms_resource_id` | String | Referencia a ID en PMS | Mapeo único entre sistemas |
| `is_marketplace_enabled` | Boolean | Si está visible en marketplace | Decisión del staff del hotel |
| `custom_price` | Decimal | Precio override local | Política de precios de la plataforma |
| `images` | JSON Array | URLs de imágenes | Contenido de marketing |
| `pms_last_sync` | DateTime | Timestamp última sincronización | Auditoría y debugging |
| `room_type_id` | Integer | FK a room_types | Categorización local |

---

## 🏗️ Propuesta de Arquitectura Mejorada

### Opción 1: CACHE - Guardar copia local de PMS (Actual)
**Ventajas:**
- Rápido, sin consultas a PMS en cada request
- Funciona si PMS está down temporalmente

**Desventajas:**
- Duplicación de datos
- Riesgo de inconsistencias
- Más almacenamiento
- Necesita sincronización periódica

### Opción 2: REFERENCE ONLY (Recomendado) ✅
**Solo guardar:**
- `pms_resource_id` (mapeo único)
- `is_marketplace_enabled` (decisión local)
- `custom_price` (override local)
- `images` (contenido marketing)
- `room_type_id` (categorización)

**Consultar en tiempo real del PMS:**
- name
- description
- capacity
- floor
- status
- type
- basePrice

**Cómo implementar:**
```typescript
// En lugar de: SELECT * FROM rooms WHERE id = ?
// Hacer: 
const roomData = await Room.findByPk(roomId); // Solo campos locales
const pmsData = await pmsService.getRoom(roomData.pms_resource_id); // Datos en tiempo real

// Combinar:
const room = {
  ...roomData,           // Campos locales
  ...pmsData,            // Datos PMS actualizados
  customPrice: roomData.custom_price || pmsData.basePrice // Override logic
};
```

---

## 📊 Comparativa: Datos Actuales vs Propuesta

### ACTUAL (Guardado en BD)
```
rooms table:
├── id (PK)
├── name ← PMS (redundante)
├── description ← PMS (redundante)
├── capacity ← PMS (redundante)
├── floor ← PMS (redundante)
├── type ← PMS (redundante)
├── status ← PMS (redundante)
├── basePrice ← PMS (redundante)
├── amenities ← PMS (redundante)
├── pms_resource_id ✅ (ÚNICO, mapeo)
├── custom_price ✅ (Complementario)
├── is_marketplace_enabled ✅ (Complementario)
├── images ✅ (Complementario)
├── room_type_id ✅ (Complementario)
├── property_id ✅ (FK)
├── pms_last_sync ✅ (Auditoría)
└── timestamps
```

### PROPUESTA (Optimizado)
```
rooms table (SOLO complementarios):
├── id (PK)
├── pms_resource_id ✅ (mapeo)
├── property_id ✅ (FK)
├── room_type_id ✅ (categorización)
├── custom_price ✅ (override)
├── is_marketplace_enabled ✅ (visible)
├── images ✅ (marketing)
├── pms_last_sync ✅ (auditoría)
└── timestamps

// Obtener datos PMS en runtime via API call
pms.getRoom(pms_resource_id) → {
  name, description, capacity, floor, type, status, basePrice, ...
}
```

---

## 🔄 Impacto en Procesos

### Sincronización (syncRoomsFromPMS)
**ACTUAL:**
```typescript
// Trae TODOS los datos de PMS, guarda TODO en BD
const roomData = {
  name, description, capacity, floor, type, status, basePrice, amenities,
  pms_resource_id, isMarketplaceEnabled, customPrice, ...
};
await Room.create(roomData); // INSERT todo
```

**PROPUESTA:**
```typescript
// Solo guarda mapeo + datos locales
const roomData = {
  pms_resource_id,  // Crucial
  property_id,
  is_marketplace_enabled: false,  // Default
  pms_last_sync: new Date(),
};
await Room.create(roomData); // INSERT solo lo complementario
```

### Obtener Habitación para Marketplace
**ACTUAL:**
```typescript
// Usar datos guardados (potencialmente desactualizados)
const room = await Room.findByPk(roomId);
const price = room.customPrice || room.basePrice;
```

**PROPUESTA:**
```typescript
// Combinar datos locales + PMS en tiempo real
const roomLocal = await Room.findByPk(roomId);
const pmsFresh = await pmsService.getRoom(roomLocal.pms_resource_id);

const room = {
  ...pmsFresh,  // Datos frescos: name, capacity, etc
  customPrice: roomLocal.customPrice,
  images: roomLocal.images,
  isMarketplaceEnabled: roomLocal.is_marketplace_enabled,
  price: roomLocal.customPrice || pmsFresh.basePrice,
};
```

---

## 🎯 Cambios Necesarios

### 1. Modificar `Room` Model
```typescript
// ELIMINAR: name, description, capacity, floor, type, status, basePrice, amenities
// MANTENER: pms_resource_id, custom_price, is_marketplace_enabled, images, room_type_id

interface RoomAttributes {
  id: number;
  pms_resource_id: string;        // ✅ mapeo único
  property_id: number;
  room_type_id?: number;          // ✅ categorización
  custom_price?: number;          // ✅ override
  is_marketplace_enabled: boolean;// ✅ visibilidad
  images?: string[];              // ✅ marketing
  pms_last_sync?: Date;           // ✅ auditoría
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 2. Crear Migration para Limpieza
```javascript
// 20251221-remove-pms-data-from-rooms.js
await queryInterface.removeColumn('rooms', 'name');
await queryInterface.removeColumn('rooms', 'description');
await queryInterface.removeColumn('rooms', 'capacity');
await queryInterface.removeColumn('rooms', 'floor');
await queryInterface.removeColumn('rooms', 'type');
await queryInterface.removeColumn('rooms', 'status');
await queryInterface.removeColumn('rooms', 'basePrice');
await queryInterface.removeColumn('rooms', 'amenities');
// ... etc
```

### 3. Modificar `roomSyncService.ts`
Solo guardar mapeo y marcar timestamp de sincronización.

### 4. Crear Helper para Enriquecimiento
```typescript
// services/roomEnrichmentService.ts
async enrichRoomWithPMSData(roomLocal: Room): Promise<EnrichedRoom> {
  const pmsData = await pmsService.getRoom(roomLocal.pms_resource_id);
  return {
    ...pmsData,
    customPrice: roomLocal.custom_price,
    images: roomLocal.images,
    isMarketplaceEnabled: roomLocal.is_marketplace_enabled,
  };
}
```

### 5. Actualizar Endpoints
Todos los endpoints que retornen habitaciones deben:
1. Obtener datos locales: `Room.findAll()`
2. Enriquecer con PMS: `await pmsService.getRooms(...)`
3. Combinar datos

---

## 📈 Beneficios

| Aspecto | Beneficio |
|--------|-----------|
| **Almacenamiento** | Reducción ~60-70% de datos redundantes |
| **Consistencia** | Siempre información actualizada del PMS |
| **Mantenimiento** | No requiere sincronización periódica |
| **Escalabilidad** | Menos datos = más rápido |
| **Integridad** | Fuente única de verdad (PMS) |
| **Auditoría** | Cambios en PMS se reflejan inmediatamente |

---

## ⚠️ Consideraciones

1. **Disponibilidad PMS**: Si PMS cae, no se pueden ver habitaciones
   - **Solución**: Cache de corta duración (5-15 min)
   
2. **Performance**: Más llamadas a PMS API
   - **Solución**: Batch queries, caching inteligente
   
3. **Cambios Rápidos**: Si PMS actualiza datos frecuentemente
   - **Solución**: Webhooks del PMS para notificaciones en tiempo real

---

## ✅ Recomendación

**Implementar arquitectura REFERENCE ONLY (Opción 2)** porque:
- ✅ Elimina redundancia de datos
- ✅ Garantiza datos siempre actualizados
- ✅ Simplifica sincronización
- ✅ Alineado con requisito: "solo guardar info complementaria"
- ✅ PMS es autoridad única

**Fase de implementación:**
1. Crear migration limpiadora
2. Actualizar Room model
3. Implementar roomEnrichmentService
4. Actualizar todos los endpoints que retornan habitaciones
5. Pruebas E2E
6. Deprecate syncRoomsFromPMS gradualmente

