# 🧹 Guía Rápida: Limpieza y Recarga de Datos del PMS

## ¿Qué hace el script?

El script `clean-and-resync.ts` te permite:

1. ✅ **Ver el estado** actual de habitaciones sincronizadas
2. 🧹 **Limpiar** todas las habitaciones de la base de datos
3. 🔄 **Resincronizar** automáticamente desde el PMS
4. 📊 **Verificar** que todo quedó bien

## Comandos Rápidos

### 1. Ver Estado Actual

```bash
npm run clean-resync
```

Muestra:
- Propiedades en el sistema
- Número de habitaciones por propiedad
- Cuántas están habilitadas en marketplace
- Configuración del PMS

### 2. Ver Estado de Una Propiedad Específica

```bash
npm run clean-resync -- status 1
```

Muestra detalles de la propiedad 1:
- Nombre y PMS configurado
- Lista de todas las habitaciones
- Estado de cada habitación (enabled/disabled)
- Última sincronización

### 3. Limpiar y Resincronizar (Recomendado)

```bash
# Para propiedad 1
npm run clean-resync -- clean 1 --yes

# Para todas las propiedades
npm run clean-resync -- clean --yes
```

Esto:
1. Elimina todas las habitaciones de la BD local
2. Consulta el PMS para obtener la lista actualizada
3. Crea nuevos registros de mapeo
4. Muestra resumen de la operación

### 4. Limpieza Completa (incluyendo bookings)

```bash
npm run clean-resync -- clean 1 --clean-bookings --yes
```

⚠️ **CUIDADO:** Esto también elimina los bookings. Úsalo solo en desarrollo o si sabes lo que haces.

## Flujo Recomendado para Testing

### Escenario 1: Limpiar y Empezar de Cero

```bash
# 1. Ver qué tienes ahora
npm run clean-resync

# 2. Limpiar todo y resincronizar
npm run clean-resync -- clean 1 --yes

# 3. Verificar resultado
npm run clean-resync -- status 1
```

### Escenario 2: Verificar Sincronización sin Cambios

```bash
# Solo ver el estado, sin hacer cambios
npm run clean-resync -- status 1
```

### Escenario 3: Limpieza Total en Desarrollo

```bash
# Limpiar todo incluyendo bookings
npm run clean-resync -- clean --clean-bookings --yes
```

## Opciones del Script

| Opción | Descripción |
|--------|-------------|
| `--yes` o `-y` | Confirma la operación sin preguntar |
| `--clean-bookings` | También elimina bookings relacionados |
| `--no-resync` | Solo limpia, no resincroniza después |
| `--help` o `-h` | Muestra ayuda completa |

## Qué Pasa Durante la Sincronización

1. **Conexión al PMS**
   - Verifica credenciales de la propiedad
   - Se conecta al PMS (ej: Mews)

2. **Obtención de Datos**
   - Consulta todos los recursos (habitaciones) del PMS
   - Filtra solo los activos

3. **Creación de Mapeos**
   - Para cada habitación del PMS:
     - Si no existe: crea nuevo registro
     - Si existe: actualiza timestamp de sincronización
   - Por defecto: `isMarketplaceEnabled: false`

4. **Resultado**
   - Muestra cuántas habitaciones se crearon
   - Muestra cuántas se actualizaron
   - Lista errores si los hay

## Después de la Sincronización

### Activar Habitaciones en el Marketplace

Las habitaciones sincronizadas NO están visibles en el marketplace automáticamente. Debes activarlas:

**Via Frontend:**
1. Login como Staff
2. Ir a "Habitaciones"
3. Toggle "Marketplace" para cada habitación

**Via API:**
```bash
curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/1/marketplace \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Verificar Datos del PMS

Los datos como nombre, capacidad, precio, etc. se obtienen en tiempo real del PMS:

```bash
curl http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <token>"
```

## Ejemplos de Salida

### Estado Normal

```
╔═══════════════════════════════════════════════════╗
║   🧹 Limpieza y Resincronización de Habitaciones  ║
╚═══════════════════════════════════════════════════╝
✅ Conexión a base de datos establecida

📊 Estado actual de habitaciones:

📍 Propiedad: Hotel Example (ID: 1)
🔌 PMS: mews
🏠 Habitaciones totales: 12
✅ Habilitadas en marketplace: 5
❌ Deshabilitadas: 7

Detalles:
  • ID: 1 | PMS: res-001 | ✓ Enabled | Last sync: 24/12/2025 10:30:00
  • ID: 2 | PMS: res-002 | ✗ Disabled | Last sync: 24/12/2025 10:30:00
  ...
```

### Limpieza y Resincronización

```
📊 Estado actual de habitaciones:
...

🧹 Iniciando limpieza de habitaciones...

📍 Propiedad: 1
📊 Habitaciones a eliminar: 12
✅ Eliminadas 12 habitaciones

🔄 Resincronizando habitaciones para propiedad 1...

📍 Propiedad: Hotel Example
🔌 PMS: mews
⏳ Obteniendo habitaciones del PMS...

✅ Sincronización completada:
   • Habitaciones creadas: 12
   • Habitaciones actualizadas: 0

📋 Total de habitaciones en BD: 12

🏠 Habitaciones sincronizadas:
   • ID: 13 | PMS Resource ID: res-001 | Marketplace: ✗
   • ID: 14 | PMS Resource ID: res-002 | Marketplace: ✗
   ...

✨ Operación completada
```

## Solución de Problemas

### Error: "PMS not configured"

**Problema:** La propiedad no tiene PMS configurado

**Solución:**
```sql
-- Verificar configuración
SELECT id, name, pms_provider FROM properties;

-- Configurar PMS si falta
UPDATE properties 
SET pms_provider = 'mews',
    pms_credentials = '{"accessToken": "...", "clientToken": "..."}'
WHERE id = 1;
```

### Error: "No resources found in PMS"

**Problema:** El PMS no retorna habitaciones

**Solución:**
1. Verificar credenciales del PMS
2. Test de conexión: `npm run check:mews`
3. Revisar en el dashboard del PMS que existan habitaciones

### Error: "Sync failed"

**Problema:** Error de conexión o credenciales inválidas

**Solución:**
1. Verificar que el PMS esté accesible
2. Regenerar tokens/credenciales en el PMS
3. Actualizar credenciales en la base de datos

## Base de Datos Manual (Alternativa)

Si prefieres usar SQL directamente:

```sql
-- Ver habitaciones actuales
SELECT * FROM rooms WHERE property_id = 1;

-- Eliminar habitaciones
DELETE FROM rooms WHERE property_id = 1;

-- Verificar que se eliminaron
SELECT COUNT(*) FROM rooms WHERE property_id = 1;
```

Luego sincroniza via API:
```bash
curl -X POST http://localhost:3000/api/hotel-staff/rooms/sync \
  -H "Authorization: Bearer <token>"
```

## Documentación Completa

Para más detalles, consulta:
- [PMS_DATA_SYNC_GUIDE.md](./PMS_DATA_SYNC_GUIDE.md) - Guía completa de sincronización
- [ROOM_SYNC_README.md](./ROOM_SYNC_README.md) - Arquitectura técnica

## Comandos Útiles Adicionales

```bash
# Verificar conexión con Mews
npm run check:mews

# Ver logs del backend
# (en otra terminal mientras corre el servidor)
npm run dev

# Ejecutar migraciones si hace falta
npm run migrate
```

## Resumen de Arquitectura

🔑 **Puntos Clave:**

1. **Mapeos Mínimos:** La BD local solo guarda `pmsResourceId` + metadata
2. **Datos en Tiempo Real:** Nombre, capacidad, precio, etc. vienen del PMS
3. **Sin Redundancia:** Evita inconsistencias entre PMS y BD local
4. **Staff Control:** Habitaciones sincronizadas vienen deshabilitadas por defecto

Esta arquitectura "Reference Only" asegura que el PMS sea siempre la fuente de verdad. 🎯
