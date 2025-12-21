# Base de Datos: Optimización para Búsqueda Rápida de Tipos de Habitaciones

## Problema Identificado
Con el crecimiento de la base de datos, las búsquedas por tipo de habitación usando strings directos (`type VARCHAR(255)`) se vuelven ineficientes. Es mejor implementar una tabla dedicada.

## Solución Implementada

### 1. Nueva Tabla: `room_types`
**Propósito:** Almacenar los tipos de habitaciones disponibles como registros reutilizables.

**Estructura:**
```sql
CREATE TABLE room_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

**Tipos Iniciales:**
- `standard` - Standard room with basic amenities
- `deluxe` - Deluxe room with premium amenities
- `suite` - Suite with living area and bedroom
- `single` - Single room for one guest
- `double` - Double room for two guests

### 2. Cambios en Tabla `rooms`
**De:** `type VARCHAR(255)` (string)
**A:** `room_type_id INT` (FK a room_types.id)

**Beneficios:**
- ✅ Búsquedas más rápidas (int comparison vs string comparison)
- ✅ Menor almacenamiento (4 bytes vs múltiples bytes por string)
- ✅ Integridad referencial (solo tipos válidos)
- ✅ Fácil mantenimiento (cambiar tipo afecta todas las rooms automáticamente)
- ✅ Índice en FK optimiza JOINs

### 3. Modelo TypeScript: `RoomType`
```typescript
interface RoomTypeAttributes {
  id: number;
  name: string;          // standard, deluxe, suite, etc.
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 4. Relación en Modelo `Room`
```typescript
Room.belongsTo(RoomType, { 
  foreignKey: 'room_type_id', 
  as: 'RoomType' 
});
```

Acceso: `room.RoomType.name`

## Migraciones Creadas

### 20251221110000-create-room-types.js
- Crea tabla `room_types`
- Inserta tipos iniciales (standard, deluxe, suite, single, double)

### 20251221110001-add-room-type-id-to-rooms.js
- Agrega columna `room_type_id` como FK
- Migra datos: mapea strings existentes a IDs
- Elimina columna `type` antigua
- Rol-back disponible para reversión

## Arquitectura Resultante

```
room_types (lookup table)
├── id: 1
├── name: "standard"
└── ...

rooms (fact table)
├── id: 100
├── name: "Room 101"
├── room_type_id: 1 (FK → room_types.id)
└── ...

weeks (inherits accommodation_type from room)
├── id: 5000
├── accommodation_type: "standard" (matches RoomType.name)
└── ...
```

## Performance Impact

**Búsqueda de habitaciones por tipo:**
```sql
-- Antes: String comparison
SELECT * FROM rooms WHERE type = 'deluxe';  -- O(n) con string search

-- Después: Integer comparison con índice
SELECT * FROM rooms WHERE room_type_id = 2;  -- O(log n) con índice B-tree
```

**JOIN con room_types:**
```sql
SELECT r.*, rt.description 
FROM rooms r
JOIN room_types rt ON r.room_type_id = rt.id
WHERE rt.name = 'deluxe';  -- Indexed lookup
```

## Próximos Pasos
1. Ejecutar migraciones: `npx sequelize-cli db:migrate`
2. Verificar datos migrados correctamente
3. Ejecutar seeder: `npx sequelize-cli db:seed --seed 20251219120000-seed-test-weeks.js`
4. Actualizar cualquier código que acceda a `room.type` → usar `room.RoomType.name`

## Archivos Modificados
- ✅ `migrations/20251221110000-create-room-types.js` (NEW)
- ✅ `migrations/20251221110001-add-room-type-id-to-rooms.js` (NEW)
- ✅ `src/models/RoomType.ts` (NEW)
- ✅ `src/models/Room.ts` (UPDATED - type → room_type_id)
- ✅ `src/models/index.ts` (UPDATED - add RoomType export)
- ✅ `seeders/20251219120000-seed-test-weeks.js` (UPDATED - use room_type_id)
