# Guía de Prueba - Sistema de Conversión de Créditos

## Objetivo
Validar el flujo completo desde la configuración administrativa hasta la creación de owners con créditos automáticos.

---

## Paso 1: Configuración Administrativa

### 1.1 Acceso al Panel de Créditos

1. **Iniciar sesión como Admin**
   - Usuario: admin@example.com
   - URL: `http://localhost:5173/login`

2. **Navegar a Configuración de Créditos**
   - En el menú lateral, hacer clic en **"Créditos"**
   - O ir directamente a: `http://localhost:5173/admin/credit-config`

### 1.2 Configurar Tiers de Propiedades

**Objetivo:** Asignar tier y multiplicador de ubicación a cada propiedad.

1. En la pestaña **"Propiedades & Tiers"**:
   
2. **Configurar Propiedad 1** (Ejemplo: Rimini):
   - Tier: `GOLD` (1.3x)
   - Multiplicador Ubicación: `1.20`
   - Clic en el ícono de editar ✏️
   - Guardar ✓

3. **Configurar Propiedad 2** (Ejemplo: Madonna):
   - Tier: `DIAMOND` (1.5x)
   - Multiplicador Ubicación: `1.10`
   - Guardar

4. **Configurar Propiedad 3** (Ejemplo: Alta Badia):
   - Tier: `STANDARD` (1.0x)
   - Multiplicador Ubicación: `1.00`
   - Guardar

### 1.3 Configurar Costos por Noche

**Objetivo:** Definir cuántos créditos cuesta cada tipo de habitación por temporada.

1. En la pestaña **"Costos por Noche"**:

2. **Crear Configuración para Rimini**:
   - Propiedad: `Rimini`
   - Tipo de Habitación: `SUPERIOR` (1bedroom)
   - Temporada: `RED` (Alta)
   - Créditos por Noche: `3`
   - Fecha Efectiva: Hoy
   - Clic en **"Crear Configuración"**

3. **Crear más configuraciones** (ejemplos):
   
   | Propiedad | Habitación | Temporada | Créditos/Noche |
   |-----------|------------|-----------|----------------|
   | Rimini    | SUPERIOR   | WHITE     | 2              |
   | Rimini    | SUPERIOR   | BLUE      | 1              |
   | Madonna   | SUITE      | RED       | 5              |
   | Madonna   | SUITE      | WHITE     | 3              |
   | Alta Badia| DELUXE     | RED       | 4              |

4. **Verificar** que las configuraciones aparecen en la tabla inferior.

### 1.4 Revisar Valores del Sistema

1. En la pestaña **"Valores Sistema"**:

2. **Verificar constantes**:
   - **Tiers**: DIAMOND=1.5x, GOLD=1.3x, SILVER_PLUS=1.1x, STANDARD=1.0x
   - **Room Types**: STANDARD=1.0x, SUPERIOR=1.2x, DELUXE=1.5x, SUITE=2.0x, PRESIDENTIAL=2.5x
   - **Temporadas**: RED=1000, WHITE=600, BLUE=300

---

## Paso 2: Staff - Crear Invitación de Owner

### 2.1 Acceso al Sistema de Invitaciones

1. **Iniciar sesión como Staff**
   - Usuario: staff@example.com
   - URL: `http://localhost:5173/login`

2. **Navegar a Invitar Propietario**
   - En el menú lateral, clic en **"Invitar Propietario"**
   - O ir a: `http://localhost:5173/staff/create-owner-invitation`

### 2.2 Crear Invitación

1. **Información del Propietario**:
   - Email: `owner1@test.com`
   - Nombre: `Juan Pérez`
   - Apellido: `García`

2. **Seleccionar Propiedad**:
   - Propiedad: `Rimini` (o la que hayas configurado)

3. **Agregar Semanas**:

   **Semana 1:**
   - Fecha Inicio: `2025-07-01` (verano - temporada RED)
   - Fecha Fin: `2025-07-08`
   - Tipo de Alojamiento: `1bedroom` (SUPERIOR)
   - Temporada: `RED` (Alta)

   **Semana 2:**
   - Fecha Inicio: `2025-09-15` (otoño - temporada WHITE)
   - Fecha Fin: `2025-09-22`
   - Tipo de Alojamiento: `1bedroom` (SUPERIOR)
   - Temporada: `WHITE` (Media)

   Clic en **"+ Agregar otra semana"** si necesitas más.

4. **Revisar Resumen**:
   - Total de semanas: 2
   - Total de noches: 14
   - Créditos estimados: Se calcula automáticamente

5. **Crear Invitación**:
   - Clic en **"Crear Invitación"**
   - Sistema muestra el código QR y enlace de invitación

6. **Copiar enlace** o **escanear QR** para enviar al owner.

---

## Paso 3: Owner - Aceptar Invitación y Crear Cuenta

### 3.1 Acceso a la Invitación

1. **Abrir enlace de invitación**:
   - Formato: `http://localhost:5173/staff/invitation/{token}`
   - O escanear QR code

2. **Revisar información**:
   - Propiedad asignada
   - Lista de semanas incluidas
   - Créditos estimados

### 3.2 Crear Cuenta de Owner

1. **Completar formulario de registro**:
   - Email: (pre-llenado)
   - Contraseña: `Password123!`
   - Confirmar contraseña
   - Aceptar términos y condiciones

2. **Clic en "Aceptar Invitación"**

3. **Sistema procesa**:
   - ✅ Crea usuario con rol "owner"
   - ✅ Crea semanas en la base de datos
   - ✅ **Calcula créditos usando Master Formula**
   - ✅ Crea registros de Night Credits
   - ✅ Marca invitación como aceptada

4. **Redirección automática** al dashboard del owner.

---

## Paso 4: Verificar Cálculo de Créditos

### 4.1 Dashboard del Owner

1. **Ver créditos asignados**:
   - Panel "Mis Créditos"
   - Debería mostrar el total calculado

### 4.2 Ejemplo de Cálculo

**Semana 1 - Rimini, SUPERIOR, RED, 7 noches:**

```
Base_Season_Value = 1000 (RED)
Tier_Multiplier = 1.3 (GOLD)
Location_Multiplier = 1.20
Room_Type_Multiplier = 1.2 (SUPERIOR)

Créditos = 1000 × 1.3 × 1.20 × 1.2 = 1,872 créditos

Si hay configuración en CreditBookingCost:
Créditos = 3 créditos/noche × 7 noches = 21 créditos
```

**Semana 2 - Rimini, SUPERIOR, WHITE, 7 noches:**

```
Base = 600 (WHITE)
Créditos = 600 × 1.3 × 1.20 × 1.2 = 1,123 créditos

O con configuración:
Créditos = 2 créditos/noche × 7 noches = 14 créditos
```

**Total: 1,872 + 1,123 = 2,995 créditos** (Master Formula)
**O: 21 + 14 = 35 créditos** (Configuración Admin)

### 4.3 Verificar en Base de Datos

```sql
-- Ver créditos creados
SELECT 
  nc.id,
  nc.owner_id,
  nc.total_nights as credits,
  nc.remaining_nights,
  nc.expiry_date,
  w.accommodation_type,
  w.season_type,
  w.nights,
  p.name as property_name,
  p.tier,
  p.location_multiplier
FROM night_credits nc
JOIN weeks w ON nc.original_week_id = w.id
JOIN properties p ON w.property_id = p.id
WHERE nc.owner_id = (SELECT id FROM users WHERE email = 'owner1@test.com');
```

---

## Paso 5: Casos de Prueba Adicionales

### Test 1: Sin Configuración de CreditBookingCost

1. **Crear invitación** para propiedad sin configuraciones en "Costos por Noche"
2. **Verificar** que usa Master Formula como fallback
3. **Logs del backend** deben mostrar:
   ```
   Credits calculated for week X:
   credits: 1872
   property: Rimini
   tier: GOLD
   season: RED
   roomType: SUPERIOR
   breakdown: { ... }
   ```

### Test 2: Diferentes Tiers

1. Crear owners en propiedades **DIAMOND**, **GOLD**, **SILVER_PLUS**, **STANDARD**
2. Con **misma temporada y tipo de habitación**
3. **Comparar créditos** - deben ser proporcionales a los multiplicadores

### Test 3: Diferentes Temporadas

1. Crear 3 semanas para el mismo owner:
   - Una RED (verano)
   - Una WHITE (primavera/otoño)
   - Una BLUE (invierno)
2. **Verificar** que RED otorga más créditos que WHITE que BLUE

---

## Endpoints para Testing Manual

### Estimar Créditos (antes de crear)

```bash
POST http://localhost:3000/api/credits/estimate/estimate-deposit
Authorization: Bearer {token}
Content-Type: application/json

{
  "property_id": 1,
  "accommodation_type": "1bedroom",
  "season_type": "RED"
}
```

### Obtener Constantes del Sistema

```bash
GET http://localhost:3000/api/credits/estimate/system-constants
Authorization: Bearer {token}
```

---

## Checklist de Validación

- [ ] Admin puede acceder a `/admin/credit-config`
- [ ] Admin puede editar tier y location_multiplier de propiedades
- [ ] Admin puede crear configuraciones de CreditBookingCost
- [ ] Staff puede acceder a `/staff/create-owner-invitation`
- [ ] Staff puede crear invitación con múltiples semanas
- [ ] Owner puede acceder al enlace de invitación
- [ ] Owner puede registrarse aceptando la invitación
- [ ] Sistema calcula créditos automáticamente usando Master Formula
- [ ] Sistema usa CreditBookingCost cuando existe configuración
- [ ] Sistema hace fallback a Master Formula cuando no hay configuración
- [ ] Créditos aparecen en dashboard del owner
- [ ] Los cálculos son correctos según los multiplicadores configurados
- [ ] Logs del backend muestran el breakdown del cálculo

---

## Problemas Comunes

### 1. "No encuentro el menú de Créditos"
- **Solución**: Verificar que estás logueado como `admin`
- El menú solo aparece para rol admin

### 2. "Los créditos calculados son incorrectos"
- **Verificar**: Configuración de tier y location_multiplier de la propiedad
- **Verificar**: Si existe configuración en CreditBookingCost, usa esa
- **Revisar**: Logs del backend para ver el breakdown

### 3. "Error al aceptar invitación"
- **Verificar**: Backend está corriendo en puerto 3000
- **Verificar**: Token de invitación es válido (no expirado)
- **Revisar**: Logs del backend para ver error específico

### 4. "Semanas creadas pero sin créditos"
- **Verificar**: Week tiene `season_type` configurado
- **Verificar**: Week está asociado a una propiedad válida
- **Revisar**: Tabla `night_credits` para ver si se creó el registro

---

## SQL Útil para Debugging

```sql
-- Ver invitaciones pendientes
SELECT * FROM owner_invitations WHERE status = 'pending';

-- Ver owners creados recientemente
SELECT u.id, u.email, u.created_at, r.name as role
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'owner'
ORDER BY u.created_at DESC;

-- Ver semanas con temporada
SELECT 
  w.id,
  w.owner_id,
  w.accommodation_type,
  w.season_type,
  w.nights,
  w.status,
  p.name as property
FROM weeks w
JOIN properties p ON w.property_id = p.id;

-- Ver configuraciones de créditos
SELECT 
  cbc.id,
  p.name as property,
  cbc.room_type,
  cbc.season_type,
  cbc.credits_per_night,
  cbc.is_active
FROM credit_booking_costs cbc
JOIN properties p ON cbc.property_id = p.id
WHERE cbc.is_active = true;
```

---

## Próximos Pasos

Después de validar este flujo:
1. ✅ Implementar sistema de pagos híbridos (créditos + Stripe)
2. ✅ Crear sistema de swaps con cálculo de diferencias
3. ✅ Implementar multi-property ledger
4. ✅ Dashboard con simulador de conversiones
