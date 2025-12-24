# Resumen de Limpieza y Sincronización PMS

## ✅ Tareas Completadas

### 1. Limpieza de Data de Prueba
- ✅ Eliminadas todas las habitaciones (rooms)
- ✅ Eliminados todos los bookings
- ✅ Eliminadas todas las semanas (weeks)
- ✅ Eliminadas todas las solicitudes de swap
- ✅ Eliminados todos los night credits
- ✅ Eliminadas todas las propiedades excepto el hotel del PMS

### 2. Propiedad Mantenida
**API Hotel (Gross Pricing) - Do not change**
- ID: 29
- PMS Provider: Mews
- PMS Property ID: `851df8c8-90f2-4c4a-8e01-a4fc46b25178`
- PMS Sync Enabled: ✅ Sí
- Nombre en Mews: Vienna Hotel

### 3. Corrección de Schema
- ✅ Modificada columna `room_type_id` en tabla `rooms` para aceptar NULL
- ✅ Creada migración: `20251224-fix-room-type-id-nullable.js`

### 4. Sincronización desde PMS
- ✅ **500 habitaciones** sincronizadas exitosamente desde Mews
- ✅ Todas las habitaciones tienen `is_marketplace_enabled = false` por defecto
- ✅ Staff debe activar manualmente las habitaciones que quiera mostrar en marketplace

## 📊 Estado Actual de la Base de Datos

```
┌─────────────────┬───────┐
│ Tabla           │ Total │
├─────────────────┼───────┤
│ ROOMS           │ 500   │
│ BOOKINGS        │ 0     │
│ WEEKS           │ 0     │
│ SWAP_REQUESTS   │ 0     │
│ NIGHT_CREDITS   │ 0     │
│ PROPERTIES      │ 1     │
└─────────────────┴───────┘
```

## 🔧 Scripts Creados

### 1. `scripts/clean-test-data.js`
Limpia toda la data de prueba manteniendo solo el hotel del PMS.

```bash
node scripts/clean-test-data.js
```

### 2. `scripts/test-pms-sync.js`
Prueba la conexión con el PMS y muestra recursos disponibles.

```bash
npx ts-node scripts/test-pms-sync.js <propertyId>
```

### 3. `scripts/sync-rooms-from-pms.ts`
Sincroniza habitaciones desde el PMS.

```bash
npx ts-node scripts/sync-rooms-from-pms.ts <propertyId>
```

### 4. `scripts/reset-rooms.js`
Elimina todas las habitaciones (útil para re-sincronizar).

```bash
node scripts/reset-rooms.js
```

## 🏗️ Arquitectura "Reference Only"

El sistema almacena **solo mapeos mínimos** en la base de datos local:

### Datos Almacenados Localmente (tabla `rooms`)
```typescript
{
  id: number,                      // PK local
  pmsResourceId: string,           // ID único en el PMS ⭐ CRÍTICO
  propertyId: number,              // FK a properties
  roomTypeId?: number,             // Categorización local (opcional)
  customPrice?: number,            // Override de precio (opcional)
  isMarketplaceEnabled: boolean,   // Control del staff
  images?: string[],               // URLs de imágenes para marketing
  pmsLastSync?: Date,              // Timestamp de última sync
}
```

### Datos Obtenidos del PMS en Tiempo Real
Cuando se consultan habitaciones, el sistema:
1. Lee los mapeos de la BD local
2. Consulta el PMS usando `pmsResourceId`
3. Enriquece con datos del PMS:
   - `name` - Nombre de la habitación
   - `type` - Tipo de habitación
   - `capacity` - Capacidad
   - `floor` - Piso
   - `status` - Estado actual
   - `basePrice` - Precio base
   - `amenities` - Amenidades

## 📝 Próximos Pasos

### 1. Activar Habitaciones en Marketplace
Las habitaciones están sincronizadas pero **no visibles en marketplace** (por defecto).
Staff debe activarlas manualmente:

```bash
# Via API (requiere autenticación Staff)
PATCH /api/hotel-staff/rooms/:roomId
{
  "isMarketplaceEnabled": true
}
```

### 2. Configurar Precios Personalizados (Opcional)
Si el staff quiere override del precio del PMS:

```bash
PATCH /api/hotel-staff/rooms/:roomId
{
  "customPrice": 250.00
}
```

### 3. Agregar Imágenes de Marketing (Opcional)
```bash
PATCH /api/hotel-staff/rooms/:roomId
{
  "images": [
    "https://example.com/room1.jpg",
    "https://example.com/room2.jpg"
  ]
}
```

### 4. Sincronización Periódica
El sistema tiene un worker que sincroniza automáticamente:
- Frecuencia configurable (por defecto cada hora)
- Solo actualiza `pmsLastSync`
- No sobrescribe datos locales (isMarketplaceEnabled, customPrice, images)

## 🔍 Verificación

### Ver habitaciones sincronizadas
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, pms_resource_id, is_marketplace_enabled, custom_price FROM rooms LIMIT 10;"
```

### Contar habitaciones por propiedad
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT property_id, COUNT(*) as total FROM rooms GROUP BY property_id;"
```

### Ver habitaciones activas en marketplace
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT COUNT(*) as marketplace_enabled FROM rooms WHERE is_marketplace_enabled = 1;"
```

## ⚠️ Notas Importantes

1. **No eliminar el hotel "API Hotel (Gross Pricing)"** - Es el único conectado al PMS real de Mews
2. **Las habitaciones sincronizadas NO están activas en marketplace por defecto** - Staff debe activarlas
3. **Los datos de habitaciones (nombre, tipo, etc.) vienen del PMS** - No se almacenan localmente
4. **Para re-sincronizar**: Ejecutar `node scripts/reset-rooms.js` y luego `npx ts-node scripts/sync-rooms-from-pms.ts 29`

## 📚 Documentación Adicional

- Ver: `backend/docs/PMS_DATA_SYNC_GUIDE.md` - Guía completa de sincronización
- Ver: `backend/docs/ROOMS_PMS_ARCHITECTURE.md` - Arquitectura del sistema
- Ver: `backend/docs/PMS_MOCK_README.md` - Comportamiento del mock PMS
