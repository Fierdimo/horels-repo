# Flujo de Asignación de Semanas - V2 Timeshare Platform

**Date:** 2026-02-03  
**Status:** Implemented  
**Purpose:** Definir el flujo lógico completo de asignación de semanas a propietarios

---

## 📋 Conceptos Clave

### 1. **Ownership (Propiedad)**
- Representa el **contrato de timeshare** de un usuario
- Define **QUÉ tiene el propietario** (qué unidad, qué tipo de propiedad)
- Es **permanente** - dura años, no expira cada año

**Tipos de Ownership:**
```
FIXED_WEEK    - Propietario tiene una semana fija específica (ej: Semana 25 cada año)
FLOATING      - Propietario puede elegir cualquier semana disponible
POINTS        - Sistema de puntos (como RCI)
```

### 2. **Week Allocation (Asignación de Semana)**
- Representa una **asignación específica de semana para un año**
- Se **genera anualmente** a partir de los Ownerships
- **Expira** al final del año si no se usa

**Ejemplo:**
```
Ownership:
  - Owner: Juan Pérez
  - Unit: 2BR Oceanview
  - Type: FIXED_WEEK
  - Fixed Week: 25

Week Allocations generadas cada año:
  2026 → Week 25 (June 16-22, 2026) | Status: ASSIGNED
  2027 → Week 25 (June 15-21, 2027) | Status: ASSIGNED
  2028 → Week 25 (June 13-19, 2028) | Status: ASSIGNED
```

---

## 🔄 Flujo Completo de Asignación

### **⚠️ IMPORTANTE: Contexto del Negocio**

**La aplicación NO vende timeshares - solo los administra.**

- Los timeshares se venden **fuera del sistema** (ventas presenciales, contratos físicos, etc.)
- La **propiedad/resort** maneja el proceso de venta
- El **staff** ingresa manualmente los datos del contrato en el sistema después de la venta

**Ejemplo del mundo real:**
```
1. Cliente visita el resort → Recibe presentación de ventas
2. Cliente firma contrato físico → Paga cuota inicial
3. Staff del resort → Ingresa datos del contrato en el sistema
4. Sistema → Genera las semanas correspondientes automáticamente
```

---

### **FASE 1: Registro Manual de Ownership (Staff)**

**Quién:** Staff del resort (con acceso al sistema)  
**Cuándo:** Después de que el cliente firmó el contrato de timeshare  
**Qué necesita el staff:**
- Datos del contrato físico firmado
- Email del cliente
- Detalles del timeshare vendido (qué unidad, qué semana)

**Cómo:** Formulario en staff dashboard o endpoint `/hotel-staff/ownerships/register`

---

#### **🎯 Principio: Máxima Automatización, Mínima Fricción**

El sistema maneja automáticamente **3 escenarios posibles** sin que el staff necesite saberlo:

**Escenario 1: Usuario ya registrado como Guest**
```typescript
// Cliente: maria@email.com ya está registrada como 'guest'
// Staff registra timeshare con ese email

→ Sistema detecta: email existe + role = 'guest'
→ Acción automática:
   ✅ Convierte role: 'guest' → 'owner'
   ✅ Crea ownership
   ✅ Genera week_allocation
   ✅ Email: "¡Bienvenido como propietario! Ahora puedes..." 
```

**Escenario 2: Usuario nuevo (sin cuenta)**
```typescript
// Cliente: juan@email.com no existe en el sistema
// Staff registra timeshare con ese email

→ Sistema detecta: email no existe
→ Acción automática:
   ✅ Crea usuario nuevo con role = 'owner'
   ✅ Genera contraseña temporal
   ✅ Crea ownership
   ✅ Genera week_allocation
   ✅ Email: "Cuenta creada - Usuario: juan@email.com, Contraseña: TMP-XYZ123"
```

**Escenario 3: Usuario ya es Owner (agregando timeshares)**
```typescript
// Cliente: pedro@email.com ya es 'owner' con 1 timeshare
// Staff registra segundo timeshare para mismo cliente

→ Sistema detecta: email existe + role = 'owner'
→ Acción automática:
   ✅ Crea ownership adicional
   ✅ Genera week_allocation del nuevo timeshare
   ✅ Email: "Nuevo timeshare agregado a tu cuenta"
```

**Resultado:** Staff solo ingresa email + datos del contrato. Sistema decide automáticamente qué hacer.

---

```typescript
// Staff ingresa SOLO email + datos del contrato
// Sistema maneja automáticamente los 3 escenarios
POST /hotel-staff/ownerships/register
Authorization: Bearer {staff_token}

{
  "owner_email": "juan.perez@email.com",  // ⚠️ Campo crítico - sistema decide qué hacer
  "owner_name": "Juan Pérez",              // Solo si usuario nuevo
  "owner_phone": "+34 600 123 456",        // Solo si usuario nuevo
  "unit_id": 5,  // 2BR Oceanview
  "type": "FIXED_WEEK",
  "fixed_week_number": 25,  // Según contrato firmado
  "annual_fee": 800,
  "currency": "EUR",
  "contract_reference": "TS-2026-001234",  // Número del contrato físico
  "contract_start_year": 2026,
  "contract_end_year": null,  // perpetuo
  "purchase_date": "2026-01-15",
  "notes": "Cliente VIP, contrato firmado en oficina central"
}

// Sistema automáticamente:
✅ Busca usuario por email
✅ SI NO EXISTE → Crea usuario con role='owner' + contraseña temporal
✅ SI EXISTE como 'guest' → Convierte a 'owner'
✅ SI EXISTE como 'owner' → Agrega ownership adicional
✅ Crea ownership record en DB
✅ Genera week_allocation para el año actual (2026)
✅ Envía email apropiado según escenario (bienvenida / conversión / nuevo timeshare)
```

**Estados del Ownership:**
- `ACTIVE` - Contrato activo, puede generar semanas
- `SUSPENDED` - Temporalmente inactivo (no pagar cuota)
- `TERMINATED` - Contrato finalizado
- `PENDING_PAYMENT` - Cuota anual pendiente

---

### **FASE 2: Generación Anual de Week Allocations**

**Quién:** Sistema automático (cron job) o Admin manual  
**Cuándo:** Enero 1 de cada año  
**Qué hace:** Crea week_allocations para todos los ownerships ACTIVOS

#### **Método 1: Automático (Recomendado)**

```typescript
// Cron job que se ejecuta: Enero 1, 00:00 cada año
// Pseudo-código:

const activeOwnerships = await Ownership.findAll({ 
  where: { status: 'ACTIVE' } 
});

for (const ownership of activeOwnerships) {
  if (ownership.type === 'FIXED_WEEK') {
    // Generar semana fija automáticamente
    await weekAllocationService.generateAnnualAllocations(
      ownership.id,
      currentYear
    );
  }
  // FLOATING y POINTS no generan automáticamente
}
```

**Resultado:**
```
Ownership 123 (Fixed Week 25) → Week Allocation creada:
  - year: 2026
  - week_number: 25
  - start_date: 2026-06-16
  - end_date: 2026-06-22
  - status: ASSIGNED  ✅ Estado inicial
```

#### **Método 2: Manual (Admin)**

```typescript
// Admin puede generar allocations manualmente para un ownership específico
POST /admin/ownerships/:id/generate-allocations
{
  "year": 2026
}
```

---

### **FASE 3: Estados de Week Allocation**

Una vez creada la week_allocation, pasa por diferentes estados:

```
┌─────────────┐
│  ASSIGNED   │  ← Estado inicial (owner tiene la semana)
└──────┬──────┘
       │
       ├─────────────→ ┌─────────────┐
       │                │  RESERVED   │ (owner hace booking para sí mismo)
       │                └─────────────┘
       │
       ├─────────────→ ┌─────────────┐
       │                │  RELEASED   │ (owner convierte a créditos)
       │                └──────┬──────┘
       │                       │
       │                       ├──→ ┌─────────────┐
       │                       │    │   BOOKED    │ (otro usuario lo reserva)
       │                       │    └──────┬──────┘
       │                       │           │
       │                       │           └──→ ┌─────────────┐
       │                       │                 │    USED     │ (checkout)
       │                       │                 └─────────────┘
       │                       │
       │                       └──→ ┌─────────────┐
       │                            │   EXPIRED   │ (pasó la fecha)
       │                            └─────────────┘
       │
       └─────────────→ ┌─────────────┐
                       │   EXPIRED   │ (semana pasó sin usarse)
                       └─────────────┘
```

---

## 🎯 Casos de Uso Detallados

### **Caso 1: Fixed Week (Más común)**

**Escenario:** Juan firmó contrato de timeshare para Semana 25 de 2BR Oceanview

**Proceso de registro:**
```
1. Juan visita resort → Recibe tour y presentación
2. Juan firma contrato físico TS-2026-001234
3. Staff recibe copia del contrato firmado
4. Staff abre sistema y registra el contrato:
```

```typescript
// Staff completa formulario con datos del contrato
POST /hotel-staff/ownerships/register
{
  owner_email: "juan.perez@email.com",
  owner_name: "Juan Pérez",
  unit_id: 5,
  type: "FIXED_WEEK",
  fixed_week_number: 25,
  contract_reference: "TS-2026-001234"
}

// Sistema crea automáticamente:
// 1. Usuario (si no existe)
// 2. Ownership record
// 3. Week allocation del año actual
```

**Cada año:**
```typescript
// Sistema genera automáticamente (Enero 1):
await weekAllocationService.generateAnnualAllocations(ownership.id, 2026);

// Resultado: week_allocation creada
{
  ownership_id: 1,
  year: 2026,
  week_number: 25,
  start_date: '2026-06-16',
  end_date: '2026-06-22',
  status: 'ASSIGNED'
}
```

**Juan puede:**
1. **Usar su semana** → Status: RESERVED
2. **Convertir a créditos** → Status: RELEASED (disponible en marketplace)
3. **No hacer nada** → Status: EXPIRED (después de June 22)

---

### **Caso 2: Floating Week**

**Escenario:** María compró Floating Week (puede elegir cualquier semana)

**Setup Inicial:**
```sql
INSERT INTO ownerships (owner_id, unit_id, type, annual_points, annual_fee, status)
VALUES (456, 5, 'FLOATING', 52, 900, 'ACTIVE');
-- ⚠️ NOTA: NO se genera automáticamente week_allocation
```

**Flujo:**
1. Sistema **NO genera** week_allocations automáticamente
2. María **elige una semana** disponible del inventario RELEASED
3. Cuando María selecciona, se crea week_allocation:

```typescript
POST /owner/select-floating-week
{
  "unit_id": 5,
  "week_number": 30
}

// Sistema:
✅ Verifica que semana 30 está disponible (RELEASED por otro owner)
✅ Crea week_allocation temporal para María
✅ Status: RESERVED
```

**Ventajas de Floating:**
- Más flexibilidad
- Puede elegir diferentes semanas cada año
- Puede usar semanas de alta temporada si están disponibles

---

### **Caso 3: Points-Based (RCI-style)**

**Escenario:** Pedro tiene 1000 puntos anuales

**Setup Inicial:**
```sql
INSERT INTO ownerships (owner_id, unit_id, type, annual_points, annual_fee, status)
VALUES (789, 5, 'POINTS', 1000, 1200, 'ACTIVE');
-- ⚠️ NO se genera week_allocation automáticamente
```

**Flujo:**
1. Sistema **NO genera** week_allocations
2. Pedro **gasta puntos** para reservar
3. Diferentes semanas/unidades tienen diferentes costos en puntos:

```typescript
POST /owner/book-with-points
{
  "unit_id": 5,        // 2BR Oceanview
  "week_number": 30,   // Alta temporada
  "points_to_spend": 250
}

// Sistema:
✅ Verifica que Pedro tiene 1000 puntos disponibles
✅ Verifica que semana 30 está RELEASED
✅ Deduce 250 puntos
✅ Crea booking (no week_allocation)
```

---

## 🛠️ Endpoints Implementados

### **Staff: Registrar Nuevo Timeshare**

```http
POST /hotel-staff/ownerships/register
Authorization: Bearer {staff_token}

{
  "owner_email": "juan.perez@email.com",
  "owner_name": "Juan Pérez",
  "owner_phone": "+34 600 123 456",
  "unit_id": 5,
  "type": "FIXED_WEEK",
  "fixed_week_number": 25,
  "annual_fee": 800,
  "currency": "EUR",
  "contract_reference": "TS-2026-001234",
  "purchase_date": "2026-01-15",
  "contract_start_year": 2026,
  "notes": "Contrato firmado en oficina principal"
}

Response: {
  "success": true,
  "message": "Timeshare registrado exitosamente",
  "data": {
    "user": {
      "id": 123,
      "email": "juan.perez@email.com",
      "role": "owner",
      "scenario": "new_user"  // Indica qué escenario se manejó
      // Valores posibles:
      // - "new_user": Usuario creado desde cero
      // - "guest_converted": Guest convertido a Owner
      // - "existing_owner": Owner agregando timeshare adicional
    },
    "temporary_password": "TMP-ABC123",  // Solo si scenario = "new_user"
    "ownership": {
      "id": 456,
      "type": "FIXED_WEEK",
      "fixed_week_number": 25,
      "contract_reference": "TS-2026-001234",
      "is_additional": false  // true si es 2do, 3er timeshare, etc.
    },
    "allocations": [
      {
        "year": 2026,
        "week_number": 25,
        "start_date": "2026-06-16",
        "end_date": "2026-06-22",
        "status": "ASSIGNED"
      }
    ],
    "email_sent": {
      "type": "welcome_new_owner",  // Tipo de email enviado
      "to": "juan.perez@email.com"
    }
  }
}
```

### **Ejemplos de los 3 Escenarios**

#### **Ejemplo 1: Usuario Nuevo**
```typescript
// Staff registra: maria@email.com (no existe en sistema)
POST /hotel-staff/ownerships/register
{
  owner_email: "maria@email.com",
  owner_name: "María García",
  unit_id: 5,
  type: "FIXED_WEEK",
  fixed_week_number: 30
}

// Sistema:
1. Busca email en DB → No existe
2. Crea usuario:
   - email: maria@email.com
   - password: TMP-XYZ789 (temporal)
   - role: 'owner'
3. Crea ownership + week_allocation
4. Envía email:
   Subject: "¡Bienvenido a [Resort]! Tu cuenta ha sido creada"
   Body:
   - Usuario: maria@email.com
   - Contraseña temporal: TMP-XYZ789
   - Link para cambiar contraseña
   - Resumen del timeshare (Semana 30, 2BR)

Response:
{
  scenario: "new_user",
  temporary_password: "TMP-XYZ789",
  email_sent: { type: "welcome_new_owner" }
}
```

#### **Ejemplo 2: Guest → Owner**
```typescript
// Staff registra: pedro@email.com (ya existe como 'guest')
POST /hotel-staff/ownerships/register
{
  owner_email: "pedro@email.com",  // Usuario ya existe
  unit_id: 3,
  type: "FLOATING",
  annual_points: 52
}

// Sistema:
1. Busca email en DB → Existe con role='guest'
2. Actualiza usuario:
   - role: 'guest' → 'owner'
   - Mantiene password existente
3. Crea ownership + NO genera week (FLOATING)
4. Envía email:
   Subject: "¡Enhorabuena! Ahora eres propietario"
   Body:
   - "Tu cuenta ha sido actualizada a propietario"
   - Nuevas funcionalidades disponibles
   - Resumen del timeshare

Response:
{
  scenario: "guest_converted",
  temporary_password: null,  // Usa su contraseña existente
  email_sent: { type: "guest_to_owner_conversion" }
}
```

#### **Ejemplo 3: Owner Adicional**
```typescript
// Staff registra: juan@email.com (ya es 'owner' con 1 timeshare)
POST /hotel-staff/ownerships/register
{
  owner_email: "juan@email.com",  // Owner existente
  unit_id: 8,
  type: "FIXED_WEEK",
  fixed_week_number: 40
}

// Sistema:
1. Busca email en DB → Existe con role='owner'
2. NO modifica usuario (ya es owner)
3. Crea ownership adicional + week_allocation
4. Envía email:
   Subject: "Nuevo timeshare agregado a tu cuenta"
   Body:
   - "Se ha agregado un nuevo timeshare"
   - Resumen: Semana 40, unidad tipo X
   - Total timeshares: 2

Response:
{
  scenario: "existing_owner",
  temporary_password: null,
  ownership: { is_additional: true },
  email_sent: { type: "additional_ownership" }
}
```

---

### **Admin: Generar Allocations Manualmente**

```http
POST /admin/ownerships/:id/generate-allocations
Authorization: Bearer {admin_token}

{
  "year": 2026
}

Response: {
  "success": true,
  "allocations": [
    {
      "id": 1,
      "ownership_id": 1,
      "year": 2026,
      "week_number": 25,
      "start_date": "2026-06-16",
      "end_date": "2026-06-22",
      "status": "ASSIGNED"
    }
  ]
}
```

### **Owner: Ver Mis Semanas**

```http
GET /owner/weeks?year=2026
Authorization: Bearer {owner_token}

Response: {
  "success": true,
  "data": [
    {
      "id": 1,
      "week_number": 25,
      "start_date": "2026-06-16",
      "end_date": "2026-06-22",
      "status": "ASSIGNED",
      "unit": {
        "name": "2BR Oceanview",
        "property": "Hotel Emperador Madrid"
      }
    }
  ]
}
```

### **Staff: Ver Inventory**

```http
GET /hotel-staff/inventory/weeks?year=2026&status=RELEASED
Authorization: Bearer {staff_token}

Response: {
  "success": true,
  "data": [
    // Todas las semanas RELEASED disponibles para booking
  ]
}
```

---

## ⚙️ Configuración Técnica

### **Servicio: WeekAllocationService**

Ubicación: `backend/src/services/v2/WeekAllocationService.ts`

**Métodos principales:**

```typescript
class WeekAllocationService {
  // Generar allocations para un ownership (año específico)
  async generateAnnualAllocations(
    ownershipId: number,
    year: number
  ): Promise<WeekAllocation[]>

  // Generar semanas específicas (para ownership floating)
  async generateSpecificWeeks(
    ownershipId: number,
    year: number,
    weekNumbers: number[]
  ): Promise<WeekAllocation[]>

  // Expirar semanas viejas (cron job)
  async expireOldAllocations(
    cutoffDate: Date
  ): Promise<number>

  // Calcular fechas de una semana
  private calculateWeekDates(
    year: number,
    weekNumber: number
  ): { start_date: Date; end_date: Date }
}
```

### **Cron Jobs Necesarios**

```typescript
// 1. Generar allocations anuales (Enero 1, 00:00)
cron.schedule('0 0 1 1 *', async () => {
  const currentYear = new Date().getFullYear();
  const ownerships = await Ownership.findAll({ 
    where: { status: 'ACTIVE', type: 'FIXED_WEEK' } 
  });

  for (const ownership of ownerships) {
    await weekAllocationService.generateAnnualAllocations(
      ownership.id,
      currentYear
    );
  }
});

// 2. Expirar semanas viejas (diario a las 02:00)
cron.schedule('0 2 * * *', async () => {
  const today = new Date();
  const expired = await weekAllocationService.expireOldAllocations(today);
  console.log(`Expired ${expired} old allocations`);
});
```

---

## ✅ Validaciones del Sistema

### **Validaciones por Escenario**

**Escenario 1: Usuario Nuevo**
- ✅ Email no existe en sistema
- ✅ `owner_name` y `owner_phone` son requeridos
- ✅ Email válido (formato)
- ✅ Generar contraseña temporal segura (12 chars, alfanumérica)

**Escenario 2: Guest → Owner**
- ✅ Email existe en sistema
- ✅ Usuario tiene role = 'guest'
- ✅ `owner_name` y `owner_phone` opcionales (usa datos existentes)
- ✅ Mantener contraseña existente

**Escenario 3: Owner Adicional**
- ✅ Email existe en sistema
- ✅ Usuario tiene role = 'owner'
- ✅ Verificar que no tenga ya un ownership del mismo tipo + semana
- ✅ Validar límite de ownerships (ej: máximo 5 por usuario)

**Validaciones Comunes (Todos los escenarios)**
- ✅ `unit_id` existe y pertenece a la propiedad del staff
- ✅ `contract_reference` es único (no duplicar contratos)
- ✅ Para FIXED_WEEK: `fixed_week_number` entre 1-52
- ✅ Para FIXED_WEEK: Semana no está ya asignada a otro owner de la misma unidad
- ✅ Para FLOATING/POINTS: `annual_points` > 0
- ✅ `annual_fee` > 0
- ✅ Staff pertenece a la propiedad (`property_id` en JWT)

---

## 🎓 Preguntas Frecuentes

### **¿Cuándo se crean las week_allocations?**

- **FIXED_WEEK:** Automáticamente cada Enero 1 por cron job
- **FLOATING:** Solo cuando el owner selecciona una semana
- **POINTS:** No se crean (se hace booking directo con puntos)

### **¿Qué pasa si un owner no paga la cuota anual?**

```typescript
// Admin suspende el ownership
PATCH /admin/ownerships/:id
{
  "status": "SUSPENDED"
}

// Resultado:
✅ No se generan nuevas week_allocations
✅ Week_allocations existentes permanecen (ya pagadas)
```

### **¿Puede un owner tener múltiples semanas?**

Sí, un owner puede tener múltiples ownerships:

```sql
-- Owner 123 tiene:
Ownership 1: Fixed Week 25 (2BR Oceanview)
Ownership 2: Fixed Week 40 (Studio)
Ownership 3: Floating Week (1BR)

-- Resultado: 2 week_allocations automáticas + 1 manual
```

### **¿Cómo funciona la conversión a créditos?**

```typescript
POST /owner/weeks/:id/release
{
  "week_allocation_id": 123
}

// Sistema:
✅ Cambia status: ASSIGNED → RELEASED
✅ Calcula créditos (según temporada, unidad)
✅ Acredita a credit_account del owner
✅ Semana disponible en marketplace
```

### **¿Qué pasa con las semanas expiradas?**

```typescript
// Cron job diario:
- Encuentra week_allocations con end_date < today
- Cambia status a EXPIRED
- Envía email al owner: "Tu semana expiró sin usarse"
```

### **¿Qué pasa si el staff se equivoca de email?**

Si el staff ingresa email equivocado:
```
1. Sistema crea usuario/ownership con email incorrecto
2. Email llega a persona equivocada
3. Staff debe:
   - Desactivar ownership (status: SUSPENDED)
   - Crear nuevo ownership con email correcto
   - Contactar soporte si se envió contraseña temporal a persona incorrecta
```

**Prevención:**
- UI muestra confirmación: "¿Email correcto? juan@email.com"
- Si email existe, mostrar: "Usuario encontrado: Juan Pérez (Owner desde 2025)"

### **¿Cómo sabe el staff si el cliente ya tiene cuenta?**

El formulario tiene **validación en tiempo real**:
```typescript
// Mientras staff escribe email:
Input onChange → Debounce 500ms → API: GET /users/check-email?email=...

Respuestas posibles:
1. "Email no encontrado" → Badge verde "Usuario nuevo"
2. "Email encontrado - Guest" → Badge azul "Será convertido a Owner"
3. "Email encontrado - Owner" → Badge naranja "Agregando timeshare adicional"
```

### **¿Puede un cliente tener múltiples ownerships de la misma semana?**

No, validación del sistema:
```typescript
if (existing_owner && type === 'FIXED_WEEK') {
  const duplicate = await Ownership.findOne({
    where: {
      owner_id: user.id,
      unit_id: unit_id,
      type: 'FIXED_WEEK',
      fixed_week_number: fixed_week_number
    }
  });
  
  if (duplicate) {
    throw new Error('Cliente ya posee esta semana en esta unidad');
  }
}
```

---

## 📊 Diagrama de Base de Datos

```
users
  └─ id

ownerships
  ├─ owner_id (FK → users.id)
  ├─ unit_id (FK → timeshare_units.id)
  ├─ type (FIXED_WEEK, FLOATING, POINTS)
  ├─ fixed_week_number (si FIXED_WEEK)
  └─ status (ACTIVE, SUSPENDED, TERMINATED)

week_allocations
  ├─ ownership_id (FK → ownerships.id)
  ├─ year
  ├─ week_number
  ├─ start_date
  ├─ end_date
  └─ status (ASSIGNED, RELEASED, BOOKED, USED, EXPIRED)

timeshare_units
  ├─ property_id (FK → timeshare_properties.id)
  ├─ category (Studio, 1BR, 2BR)
  └─ base_credit_value
```

---

## ✅ Checklist de Implementación

### **Fase 1: Setup Inicial**
- [x] Modelos V2 creados (Ownership, WeekAllocation)
- [x] Servicio WeekAllocationService implementado
- [x] Endpoints owner para ver weeks y ownerships
- [x] Endpoints staff para registrar ownerships

### **Fase 2: Automatización**
- [ ] Cron job: Generar allocations anuales (Enero 1)
- [ ] Cron job: Expirar semanas viejas (diario)
- [ ] Notificaciones email cuando se generan allocations
- [ ] Notificaciones email cuando expiran semanas

### **Fase 3: UI Owner**
- [x] Componente MyWeeks.tsx para ver semanas V2
- [x] Navegación actualizada (Sidebar, Header, BottomNav)
- [x] Dashboard con acceso rápido a "Mis Semanas"
- [x] Filtros por estado y búsqueda
- [x] Selector de año
- [ ] Botón "Convertir a Créditos" funcional
- [ ] Modal de confirmación para conversión

### **Fase 4: UI Staff**
- [x] Formulario "Registrar Nuevo Timeshare"
- [x] Modal para mostrar contraseña temporal
- [x] Lista de ownerships registrados
- [ ] Ver allocations generadas por ownership

### **Fase 5: Sistema de Contraseñas**
- [x] Campo must_change_password en User model
- [x] Generación de contraseña temporal en registro
- [x] Página de cambio de contraseña obligatorio
- [x] Redirección automática en login
- [x] Migración ejecutada en base de datos

---

## 📌 Próximos Pasos

1. **Staff UI: Formulario de Registro de Timeshare**
   - Sección "Registrar Nuevo Timeshare" en staff dashboard
   - Campos: Email cliente, datos unidad, tipo ownership, datos contrato
   - Validación: Email único, semana disponible, contrato no duplicado
   - Auto-creación de usuario si no existe
   - Auto-conversión de guest → owner

2. **Endpoint Backend: `/hotel-staff/ownerships/register`**
   - Validar que staff pertenece a la propiedad
   - Buscar o crear usuario por email
   - Crear ownership record
   - Generar week_allocation del año actual
   - Enviar email de bienvenida al owner

3. **Implementar cron jobs**
   - Generación anual automática (Enero 1)
   - Expiración diaria de semanas viejas
   - Reportes por email

4. **Owner UI para ver semanas**
   - Dashboard con "Mis Semanas 2026"
   - Botón "Convertir a Créditos"
   - Estado visual (ASSIGNED, RELEASED, EXPIRED)

5. **Testing**
   - Test: Staff registra contrato → usuario + ownership + allocation creados
   - Test: Email duplicado → usa usuario existente
   - Test: Contrato duplicado → error
   - Test: Semana ya asignada → error
   - Test: Auto-conversión guest → owner

---

**Documentación relacionada:**
- [TIMESHARE_PLATFORM_V2_SPEC.md](TIMESHARE_PLATFORM_V2_SPEC.md) - Especificación completa
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md) - Schema de base de datos
- [USER_EXPERIENCE_DESIGN.md](USER_EXPERIENCE_DESIGN.md) - Flujos de usuario
