# Guía de Sincronización de Datos del PMS

## 📋 Resumen

Este sistema utiliza una arquitectura **"Reference Only"** para habitaciones:
- Solo almacena **mapeos mínimos** en la base de datos local
- Los **datos reales** (nombre, capacidad, precio, etc.) se obtienen del PMS en tiempo real
- Esto evita inconsistencias entre el PMS y la BD local

## 🏗️ Arquitectura

### Datos Almacenados Localmente

La tabla `rooms` solo almacena:

```typescript
{
  id: number,                      // PK local
  pmsResourceId: string,           // ID único del recurso en el PMS (CRITICAL)
  propertyId: number,              // FK a properties
  roomTypeId?: number,             // Categorización local opcional
  customPrice?: number,            // Override de precio (solo si es diferente al PMS)
  isMarketplaceEnabled: boolean,   // Decisión del staff (visible en marketplace)
  images?: string[],               // URLs de imágenes para marketing
  pmsLastSync?: Date,              // Timestamp de última sincronización
}
```

### Datos Obtenidos del PMS en Tiempo Real

Al consultar habitaciones, el sistema:
1. Lee los mapeos de la BD local
2. Consulta el PMS usando `pmsResourceId`
3. Enriquece los datos con información del PMS:
   - `name` - Nombre de la habitación (ej: "Room 101")
   - `type` - Tipo de habitación (ej: "Deluxe")
   - `capacity` - Capacidad de personas
   - `floor` - Piso
   - `status` - Estado actual (available, occupied, maintenance)
   - `basePrice` - Precio base del PMS
   - `amenities` - Amenidades

## 🔄 Flujo de Sincronización

### 1. Primera Sincronización

```bash
# Via API (requiere autenticación Staff/Admin)
POST /api/hotel-staff/rooms/sync
Authorization: Bearer <token>
```

**Proceso:**
1. ✅ Verifica que la propiedad tenga PMS configurado
2. ✅ Obtiene lista de recursos (habitaciones) del PMS
3. ✅ Para cada recurso:
   - Verifica si ya existe mapeo por `pmsResourceId`
   - Si no existe: crea nuevo registro con `isMarketplaceEnabled: false`
   - Si existe: actualiza solo `pmsLastSync`
4. ✅ Retorna resumen: creadas, actualizadas, errores

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "created": 12,
    "updated": 0,
    "rooms": [...]
  },
  "message": "Sync complete: 12 created, 0 updated, 0 errors"
}
```

### 2. Consulta de Habitaciones (con Enriquecimiento)

```bash
GET /api/hotel-staff/rooms
```

**Proceso:**
1. ✅ Obtiene mapeos de la BD local
2. ✅ Para cada mapeo, consulta datos en tiempo real del PMS
3. ✅ Combina datos locales + datos del PMS
4. ✅ Aplica `customPrice` si está definido (override)

**Resultado:**
```json
{
  "id": 1,
  "pmsResourceId": "mews-res-101",
  // Datos del PMS (en tiempo real):
  "name": "Room 101",
  "type": "Deluxe",
  "capacity": 2,
  "floor": "1",
  "status": "available",
  "basePrice": 150.00,
  // Datos locales:
  "customPrice": 180.00,           // Override del precio
  "isMarketplaceEnabled": true,
  "images": ["url1", "url2"]
}
```

## 🧹 Limpieza y Recarga de Datos

### Script de Limpieza

Hemos creado un script completo para limpiar y resincronizar:

```bash
# Ver estado actual
npm run clean-resync

# Ver estado de una propiedad específica
npm run clean-resync -- status 1

# Limpiar y resincronizar propiedad 1
npm run clean-resync -- clean 1 --yes

# Limpiar todo incluyendo bookings
npm run clean-resync -- clean --clean-bookings --yes

# Solo limpiar sin resincronizar
npm run clean-resync -- clean 1 --no-resync --yes
```

### Proceso Manual (sin script)

#### Paso 1: Verificar Estado Actual

```sql
-- Ver todas las habitaciones
SELECT 
  r.id,
  r.pms_resource_id,
  r.property_id,
  r.is_marketplace_enabled,
  r.pms_last_sync,
  p.name as property_name
FROM rooms r
JOIN properties p ON r.property_id = p.id;

-- Ver bookings relacionados
SELECT COUNT(*) as total_bookings FROM bookings WHERE property_id = 1;
```

#### Paso 2: Limpiar Datos

```sql
-- Opción A: Limpiar solo una propiedad
DELETE FROM rooms WHERE property_id = 1;

-- Opción B: Limpiar todo
DELETE FROM rooms;

-- Opcional: También limpiar bookings (¡CUIDADO!)
DELETE FROM bookings WHERE property_id = 1;
```

#### Paso 3: Resincronizar

```bash
# Via API
curl -X POST http://localhost:3000/api/hotel-staff/rooms/sync \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json"
```

## 🎯 Casos de Uso Comunes

### Caso 1: Actualizar Datos desde el PMS

Cuando cambias algo en el PMS (nombre, capacidad, precio), NO necesitas hacer nada:
- Los datos se obtienen automáticamente en tiempo real
- Solo el mapeo se mantiene en la BD local

### Caso 2: Activar Habitación en Marketplace

```bash
PATCH /api/hotel-staff/rooms/:id/marketplace
{
  "enabled": true
}
```

Esto actualiza solo `isMarketplaceEnabled` en la BD local.

### Caso 3: Establecer Precio Personalizado

```bash
PUT /api/hotel-staff/rooms/:id
{
  "customPrice": 200.00
}
```

Este precio tiene precedencia sobre el `basePrice` del PMS.

### Caso 4: Agregar Imágenes de Marketing

```bash
PUT /api/hotel-staff/rooms/:id
{
  "images": [
    "https://example.com/room1.jpg",
    "https://example.com/room2.jpg"
  ]
}
```

Las imágenes son contenido local de marketing.

### Caso 5: Resincronizar Después de Cambios en el PMS

Si agregaste nuevas habitaciones en el PMS:

```bash
# Sincronizar
POST /api/hotel-staff/rooms/sync

# Verificar nuevas habitaciones
GET /api/hotel-staff/rooms
```

Las habitaciones nuevas aparecerán con `isMarketplaceEnabled: false` por defecto.

## 🔍 Verificación de Integridad

### Verificar Configuración del PMS

```sql
SELECT 
  id,
  name,
  pms_provider,
  pms_credentials IS NOT NULL as has_credentials
FROM properties;
```

### Verificar Habitaciones Sincronizadas

```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN is_marketplace_enabled = 1 THEN 1 END) as enabled,
  MIN(pms_last_sync) as oldest_sync,
  MAX(pms_last_sync) as newest_sync
FROM rooms
WHERE property_id = 1;
```

### Verificar Habitaciones No Sincronizadas Recientemente

```sql
SELECT 
  id,
  pms_resource_id,
  pms_last_sync,
  TIMESTAMPDIFF(MINUTE, pms_last_sync, NOW()) as minutes_since_sync
FROM rooms
WHERE property_id = 1
  AND pms_last_sync < DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY pms_last_sync ASC;
```

## 📊 Monitoreo

### Logs del Servicio de Sincronización

El servicio `RoomSyncService` registra:
- ✅ Habitaciones creadas
- ✅ Habitaciones actualizadas
- ❌ Errores de sincronización
- ⏱️ Timestamp de cada operación

### Endpoint de Estado

```bash
# Ver todas las habitaciones con detalles
GET /api/hotel-staff/rooms
```

Respuesta incluye:
- Estado de cada habitación
- Última sincronización
- Si está habilitada en marketplace
- Datos en tiempo real del PMS

## 🚨 Solución de Problemas

### Problema: "No resources found in PMS"

**Causa:** El PMS no retorna habitaciones o credenciales incorrectas

**Solución:**
1. Verificar credenciales: `SELECT pms_credentials FROM properties WHERE id = 1;`
2. Test de conexión: `npm run check:mews`
3. Revisar logs del PMS

### Problema: "PMS not configured for this property"

**Causa:** La propiedad no tiene `pms_provider` configurado

**Solución:**
```sql
UPDATE properties 
SET pms_provider = 'mews', 
    pms_credentials = '{"accessToken": "...", "clientToken": "..."}'
WHERE id = 1;
```

### Problema: Datos desactualizados o inconsistentes

**Causa:** Posibles issues en el adapter del PMS

**Solución:**
1. Limpiar cache: `npm run clean-resync -- clean 1 --yes`
2. Verificar adapter: revisar [roomEnrichmentService.ts](../src/services/roomEnrichmentService.ts)
3. Logs del PMS: revisar responses de la API

### Problema: Habitaciones duplicadas

**Causa:** El `pmsResourceId` cambió en el PMS

**Solución:**
```sql
-- Encontrar duplicados
SELECT pms_resource_id, COUNT(*) 
FROM rooms 
WHERE property_id = 1
GROUP BY pms_resource_id 
HAVING COUNT(*) > 1;

-- Eliminar duplicados antiguos manualmente
DELETE FROM rooms WHERE id IN (...);

-- Resincronizar
```

## 🔐 Seguridad

### Credenciales del PMS

Las credenciales se almacenan encriptadas en `properties.pms_credentials`:

```typescript
// Encriptar
import { encryptPmsCredentials } from '../utils/pmsEncryption';
const encrypted = encryptPmsCredentials(credentials);

// Desencriptar (automático en PMSFactory)
const decrypted = decryptPmsCredentials(encrypted);
```

### Permisos de API

Solo usuarios con roles `staff` o `admin` pueden:
- ✅ Sincronizar habitaciones
- ✅ Modificar configuración de marketplace
- ✅ Establecer precios personalizados

## 📚 Referencias

- **Código Principal:**
  - [RoomSyncService](../src/services/roomSyncService.ts) - Lógica de sincronización
  - [RoomEnrichmentService](../src/services/roomEnrichmentService.ts) - Enriquecimiento con datos del PMS
  - [PMSFactory](../src/services/pms/PMSFactory.ts) - Factory para adapters del PMS
  - [MewsAdapter](../src/services/adapters/mewsAdapter.ts) - Implementación para Mews

- **Documentación:**
  - [ROOM_SYNC_README.md](./ROOM_SYNC_README.md) - Detalles técnicos
  - [ROOMS_PMS_ARCHITECTURE.md](../../ROOMS_PMS_ARCHITECTURE.md) - Decisiones de arquitectura
  - [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) - Endpoints disponibles

- **Scripts:**
  - [clean-and-resync.ts](../scripts/clean-and-resync.ts) - Limpieza y resincronización
  - [check_mews_connection.ts](../src/scripts/check_mews_connection.ts) - Test de conexión
