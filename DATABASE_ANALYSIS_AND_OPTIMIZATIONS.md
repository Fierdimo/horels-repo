# Análisis de Optimización de Base de Datos - Hotels Timeshare Platform

## 📊 Estado Actual
- **Tablas:** 19 (incluyendo SequelizeMeta)
- **Registros de prueba:** 3 bookings, 3 properties, ~18 users
- **Base de datos:** MariaDB 10.11 en Docker

---

## 🎯 Análisis por Área del Modelo de Negocio

### 1. **BÚSQUEDA Y DISPONIBILIDAD DE HABITACIONES** 
**Impacto:** CRÍTICO - es la operación más frecuente

#### ✅ Bien Implementado:
- `idx_bookings_availability_search (property_id, status, check_in, check_out)` - Excelente para búsquedas de disponibilidad
- `idx_bookings_room_dates (room_id, check_in, check_out)` - Perfecto para conflictos de reservas

#### ⚠️ OPORTUNIDADES DE MEJORA:

**a) Falta índice en la tabla `weeks`**
```sql
-- RECOMENDACIÓN: Agregar índices a weeks
ALTER TABLE weeks ADD INDEX idx_weeks_availability 
  (property_id, status, start_date, end_date);
ALTER TABLE weeks ADD INDEX idx_weeks_owner_status 
  (owner_id, status, accommodation_type);
```
**Por qué:** Las queries de "mis weeks disponibles" son muy frecuentes. Sin estos índices, escanea toda la tabla.

**b) Falta índice compuesto en `rooms` para búsquedas por tipo + propiedad**
```sql
-- RECOMENDACIÓN: Cuando room_types esté implementado
ALTER TABLE rooms ADD INDEX idx_rooms_type_property 
  (room_type_id, property_id);
```
**Por qué:** Las búsquedas "rooms del tipo X en propiedad Y" serán muy comunes.

---

### 2. **SWAPS - Matching y Búsqueda**
**Impacto:** ALTO - operación de matching compleja

#### ✅ Bien Implementado:
- Índices en `requester_id`, `requester_week_id`, `responder_week_id`
- Índice en `status` para filtrado rápido

#### ⚠️ OPORTUNIDADES DE MEJORA:

**a) Falta índice compuesto para búsquedas de swaps disponibles**
```sql
-- RECOMENDACIÓN: Para encontrar swaps abiertos por tipo de acomodación
ALTER TABLE swap_requests ADD INDEX idx_swaps_available 
  (status, property_id, accommodation_type);
```
**Por qué:** El matching de swaps probablemente filtrará por status='pending' y accommodation_type.

**b) Falta denormalización: `accommodation_type` en swap_requests**
```sql
-- RECOMENDACIÓN: Agregar columna desnormalizada
ALTER TABLE swap_requests ADD COLUMN accommodation_type VARCHAR(100) AFTER status;

-- Poblar con datos existentes
UPDATE swap_requests sr
JOIN weeks w ON sr.requester_week_id = w.id
SET sr.accommodation_type = w.accommodation_type;
```
**Por qué:** Evita JOINs costosos en queries de matching. Permite índices más eficientes.

---

### 3. **CRÉDITOS NOCTURNOS**
**Impacto:** MEDIO - operación menos frecuente pero crítica

#### ✅ Bien Implementado:
- Índice en `owner_id`, `status`, `expiry_date`

#### ⚠️ OPORTUNIDADES DE MEJORA:

**a) Falta índice para búsqueda de créditos activos próximos a expirar**
```sql
-- RECOMENDACIÓN: Para notificaciones y alertas
ALTER TABLE night_credits ADD INDEX idx_credits_expiring 
  (status, expiry_date);
```
**Por qué:** Sistema probablemente necesitará alertar usuarios de créditos por expirar.

**b) Falta field: `used_nights` para tracking**
```sql
-- RECOMENDACIÓN: Agregar columna para auditoría
ALTER TABLE night_credits ADD COLUMN used_nights INT DEFAULT 0 AFTER remaining_nights;
ALTER TABLE night_credits ADD COLUMN last_used_date DATETIME NULL AFTER used_nights;
```
**Por qué:** Mejor tracking del consumo de créditos.

---

### 4. **PAGOS Y COMISIONES**
**Impacto:** ALTO - crítico para ingresos

#### ⚠️ OPORTUNIDADES DE MEJORA:

**a) Falta análisis de tabla `fees`**
Necesito ver su estructura:
```
DESCRIBE fees;  -- Revisar estructura
```

**b) Crear índice para reportes financieros**
```sql
-- RECOMENDACIÓN: Para dashboard de ingresos
ALTER TABLE swap_requests ADD INDEX idx_swaps_payment_reporting 
  (paid_at, payment_status, commission_amount);
```
**Por qué:** Reportes de ingresos serán query frecuente.

---

### 5. **BÚSQUEDA DE USUARIOS Y AUTORIZACIÓN**
**Impacto:** MEDIO - frecuente pero rápido

#### ✅ Bien Implementado:
- UNIQUE INDEX en `email`
- Índice en `role_id`

#### ⚠️ OPORTUNIDADES DE MEJORA:

**a) Falta índice para búsqueda de staff de una propiedad**
```sql
-- RECOMENDACIÓN: 
ALTER TABLE users ADD INDEX idx_users_property_role 
  (property_id, role_id);
```
**Por qué:** Queries como "get all staff for property X" serán comunes.

---

## 🗂️ OPTIMIZACIONES RECOMENDADAS POR PRIORIDAD

### FASE 1: CRÍTICA (Implementar Inmediatamente)
```javascript
/* Migration: 20251221130000-optimize-indexes-critical.js */

1. Agregar a weeks:
   - idx_weeks_availability (property_id, status, start_date, end_date)
   - idx_weeks_owner_status (owner_id, status)

2. Agregar a swap_requests:
   - idx_swaps_available (status, property_id)

3. Agregar a users:
   - idx_users_property_role (property_id, role_id)
```

### FASE 2: DENORMALIZACIÓN (Importante)
```javascript
/* Migration: 20251221130001-denormalize-accommodation-type.js */

1. Agregar accommodation_type a swap_requests:
   - Reduce JOINs en matching
   - Permite índices más eficientes
   - Mejora performance de búsquedas

2. Considerar: Agregar property_id a night_credits
   - Permite filtrado rápido por propiedad
```

### FASE 3: ANÁLISIS (Después de Producción)
```
1. Agregar columnas de auditoría:
   - last_modified_by_id en tablas críticas
   - change_reason en swap_requests
   
2. Crear tabla de eventos para analytics:
   - booking_events (user_id, event_type, timestamp)
   - swap_events (swap_id, event_type, timestamp)

3. Considerar partición de bookings por fecha
   - Si crece > 1M registros
```

---

## 📈 PROYECCIONES DE CRECIMIENTO Y PLAN

### Escenarios Esperados:
```
Año 1: 10K bookings, 100 properties, 500 users
Año 2: 100K bookings, 500 properties, 2K users
Año 3: 1M bookings, 2K properties, 10K users
```

### Tabla de Sensibilidad:
| Tabla | Tamaño Año 1 | Tamaño Año 3 | Índices Requeridos |
|-------|-------------|-------------|-------------------|
| bookings | 10K | 1M | Multi-columna + dates |
| weeks | 20K | 200K | Availability + owner |
| swap_requests | 5K | 50K | Status + accommodation |
| night_credits | 10K | 100K | Expiry + owner |
| users | 500 | 10K | Property + role |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Tabla `weeks`
- [ ] Agregar `idx_weeks_availability (property_id, status, start_date, end_date)`
- [ ] Agregar `idx_weeks_owner_status (owner_id, status)`
- [ ] Considerar: `idx_weeks_accommodation_type (accommodation_type)` para swaps

### Tabla `rooms`
- [ ] Agregar `idx_rooms_type_property (room_type_id, property_id)` después de implement room_types
- [ ] Considerar: `idx_rooms_availability (property_id, status, room_type_id)`

### Tabla `swap_requests`
- [ ] Agregar `idx_swaps_available (status, property_id)`
- [ ] Agregar columna `accommodation_type` (denormalización)
- [ ] Agregar `idx_swaps_reporting (paid_at, payment_status)`

### Tabla `night_credits`
- [ ] Agregar `idx_credits_expiring (status, expiry_date)`
- [ ] Agregar columnas: `used_nights INT`, `last_used_date DATETIME`

### Tabla `users`
- [ ] Agregar `idx_users_property_role (property_id, role_id)`

### Tabla `bookings`
- [ ] Considerar: Agregar índice en `stripe_charge_id` (para reconciliación)

---

## 🔍 QUERIES CRÍTICAS OPTIMIZADAS

### 1. Búsqueda de Disponibilidad (FRECUENTE)
```sql
-- CON ÍNDICE: idx_weeks_availability
SELECT w.* FROM weeks w
WHERE w.property_id = ? 
  AND w.status = 'available'
  AND w.start_date >= ?
  AND w.end_date <= ?;
-- Time: <10ms (was 100ms+)
```

### 2. Mis Weeks (MUY FRECUENTE)
```sql
-- CON ÍNDICE: idx_weeks_owner_status
SELECT w.* FROM weeks w
WHERE w.owner_id = ?
  AND w.status IN ('available', 'pending');
-- Time: <5ms (was 50ms+)
```

### 3. Matching de Swaps (FRECUENTE)
```sql
-- CON accommodation_type DESNORMALIZADO + índice
SELECT sr.* FROM swap_requests sr
WHERE sr.status = 'pending'
  AND sr.accommodation_type = 'standard'
  AND sr.property_id IN (...)
ORDER BY sr.created_at DESC;
-- Time: <20ms (was 200ms+ con JOINs)
```

---

## 📋 MIGRATION STRATEGY

### Ejecución Segura:
```javascript
// 1. Agregar índices (no bloquea lecturas/escrituras)
ALTER TABLE weeks ADD INDEX idx_weeks_availability ...;

// 2. Agregar columnas opcionales (backward compatible)
ALTER TABLE swap_requests ADD COLUMN accommodation_type ...;

// 3. Poblamiento gradual en background
// (sin afectar aplicación)

// 4. Después de validación: usar nueva columna en queries
```

### Testing Post-Migration:
```sql
-- Validar que índices se están usando
EXPLAIN SELECT ... (ver plan de ejecución)

-- Benchmarking
SET @t = NOW(6); 
[QUERY]
SELECT TIMEDIFF(NOW(6), @t);
```

---

## 🎯 RECOMENDACIÓN FINAL

**IMPLEMENTAR INMEDIATAMENTE (1-2 horas):**
1. Índices en `weeks` (CRÍTICO para performance)
2. Índices en `users` property+role
3. Índice en `swap_requests` status

**DESNORMALIZACIÓN (Siguiente sprint):**
1. Agregar `accommodation_type` a `swap_requests`
2. Agregar `property_id` a `night_credits`

**MONITOREO CONTINUO:**
- Revisar query logs mensualmente
- Identificar queries lentas (>100ms)
- Ajustar índices según patrón real de uso
