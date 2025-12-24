# Sincronización Automática desde la Aplicación

## ✅ Sistema Ya Implementado

La sincronización automática desde la aplicación **ya está completamente implementada** y funciona correctamente.

## 🎯 Funcionalidad Actual

### 1. **Endpoint API**
```
POST /api/hotel-staff/rooms/sync
Authorization: Bearer <token>
```

**Características:**
- ✅ Requiere autenticación (staff o admin)
- ✅ Sincroniza habitaciones desde el PMS
- ✅ Devuelve habitaciones enriquecidas con datos del PMS
- ✅ Registra la acción en logs

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "created": 500,
    "updated": 0,
    "rooms": [...]
  },
  "message": "Sync complete: 500 created, 0 updated, 0 errors"
}
```

### 2. **Frontend - Botón de Sincronización**

**Ubicación:** `/staff/rooms` (Panel de Staff)

El botón "Sync from PMS" / "Sincronizar desde PMS" se encuentra en la interfaz de gestión de habitaciones.

**Características:**
- ✅ Botón con ícono de refresh
- ✅ Muestra spinner mientras sincroniza
- ✅ Toast notification al completar
- ✅ Actualiza la lista automáticamente

### 3. **Sincronización Automática en Carga**

El sistema **sincroniza automáticamente** cuando:
- Staff accede a la página de habitaciones
- No hay habitaciones en la base de datos
- Es la primera vez que se carga la página

```typescript
useEffect(() => {
  if (!hasAutoSynced && roomsData) {
    const rooms = roomsData?.data?.rooms || [];
    if (rooms.length === 0) {
      syncRoomsMutation.mutate();
    }
  }
}, [roomsData, hasAutoSynced]);
```

## 🔄 Flujo de Sincronización

### Paso a Paso:

1. **Staff hace clic en botón "Sync from PMS"**
   ```
   Usuario → Frontend → POST /api/hotel-staff/rooms/sync
   ```

2. **Backend procesa la sincronización**
   ```typescript
   staffRoomController.syncRooms()
   ↓
   roomSyncService.syncRoomsFromPMS(propertyId)
   ↓
   PMSFactory.getAdapter(propertyId)
   ↓
   adapter.getAvailability()
   ↓
   Guardar mapeos en BD
   ```

3. **Respuesta enriquecida**
   ```typescript
   RoomEnrichmentService.enrichRooms(roomsLocal)
   ↓
   Combinar datos locales + datos PMS
   ↓
   Retornar habitaciones completas
   ```

4. **Frontend actualiza UI**
   ```
   toast.success() → queryClient.invalidateQueries() → Re-fetch rooms
   ```

## 📱 Cómo Usar

### Para Staff:

1. **Iniciar sesión** como usuario Staff
2. **Navegar** a "Rooms" / "Habitaciones"
3. **Click** en botón "Sync from PMS" (ícono refresh)
4. **Esperar** mientras se sincronizan (spinner visible)
5. **Confirmación** con toast notification
6. **Ver** habitaciones sincronizadas en la lista

### Para Administradores:

Admins pueden sincronizar habitaciones de cualquier propiedad:

```bash
POST /api/hotel-staff/rooms/sync
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "propertyId": 29
}
```

## 🧪 Prueba del Endpoint

### Usando curl:

```bash
# 1. Obtener token de autenticación (staff o admin)
TOKEN="your-jwt-token-here"

# 2. Sincronizar habitaciones
curl -X POST http://localhost:3000/api/hotel-staff/rooms/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Usando Thunder Client / Postman:

```
Method: POST
URL: http://localhost:3000/api/hotel-staff/rooms/sync
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
```

## 🔐 Autenticación Requerida

El endpoint requiere:
- ✅ Token JWT válido
- ✅ Rol: `staff` o `admin`
- ✅ Usuario staff debe estar asignado a una propiedad
- ✅ Propiedad debe tener PMS configurado

## 📊 Datos Sincronizados

### Lo que SE sincroniza (almacena en BD):
- `pmsResourceId` - ID único en el PMS
- `propertyId` - Propiedad asociada
- `pmsLastSync` - Timestamp de sincronización
- `isMarketplaceEnabled` - Control del staff (default: false)
- `customPrice` - Override de precio (opcional)
- `images` - Imágenes de marketing (opcional)

### Lo que NO se sincroniza (viene del PMS en tiempo real):
- `name` - Nombre de la habitación
- `type` - Tipo de habitación
- `capacity` - Capacidad
- `floor` - Piso
- `status` - Estado actual (available, occupied, etc.)
- `basePrice` - Precio base del PMS
- `amenities` - Amenidades

## ⚡ Sincronización Periódica (Worker)

El sistema también tiene un worker que sincroniza automáticamente:

**Archivo:** `src/workers/pmsSyncWorker.ts`

**Frecuencia:** Configurable (default: cada hora)

**Activa cuando:**
- Worker está corriendo
- Propiedad tiene `pms_sync_enabled = true`
- Propiedad tiene PMS configurado

**Iniciar worker:**
```bash
cd backend
npm run start:worker
```

## 🎨 UI/UX

### Botón de Sincronización:
```tsx
<button className="btn-primary">
  <RefreshCw className={syncRoomsMutation.isPending ? 'animate-spin' : ''} />
  <span>
    {syncRoomsMutation.isPending ? 'Syncing...' : 'Sync from PMS'}
  </span>
</button>
```

### Estados:
- **Normal:** Botón disponible
- **Loading:** Spinner animado + "Syncing..."
- **Success:** Toast verde + lista actualizada
- **Error:** Toast rojo con mensaje de error

## 🐛 Troubleshooting

### "No PMS configured for this property"
**Solución:** Verificar que la propiedad tenga `pms_provider != 'none'` y credenciales configuradas.

### "Property not found"
**Solución:** Usuario staff debe estar asignado a una propiedad válida.

### "Connection failed"
**Solución:** Verificar credenciales PMS en `.env`:
```bash
MEWS_CLIENT_ID=...
MEWS_CLIENT_SECRET=...
MEWS_BASE_URL=https://api.mews-demo.com
```

### Habitaciones no aparecen después de sincronizar
**Solución:** Verificar que:
1. La sincronización fue exitosa (check logs)
2. Las habitaciones tienen `IsActive = true` en el PMS
3. Refrescar la página

## 📝 Logs

### Backend logs:
```bash
cd backend
# Ver logs en tiempo real
npm run dev

# Buscar logs de sincronización
[RoomEnrichment] ...
[PMSSyncWorker] ...
```

### Base de datos:
```sql
-- Ver última sincronización
SELECT id, pms_resource_id, pms_last_sync 
FROM rooms 
ORDER BY pms_last_sync DESC 
LIMIT 10;

-- Ver logs de acciones
SELECT * FROM action_logs 
WHERE action = 'staff_sync_rooms' 
ORDER BY createdAt DESC 
LIMIT 10;
```

## ✅ Verificación

Para verificar que todo está funcionando:

1. ✅ Backend corriendo en puerto 3000
2. ✅ Frontend corriendo en puerto 5173
3. ✅ Usuario staff autenticado
4. ✅ Propiedad tiene PMS configurado
5. ✅ Botón "Sync from PMS" visible
6. ✅ Click en botón ejecuta sincronización
7. ✅ Habitaciones aparecen en la lista

## 🚀 Estado Actual

- ✅ **500 habitaciones** sincronizadas
- ✅ **Propiedad:** API Hotel (ID: 29)
- ✅ **PMS:** Mews (Vienna Hotel)
- ✅ **Endpoint:** Funcionando
- ✅ **Frontend:** Implementado
- ✅ **Auto-sync:** Activado

**El sistema está listo para usar desde la aplicación web. No se requieren scripts externos.**
