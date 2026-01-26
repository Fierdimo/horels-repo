# Análisis del Flujo de Invitaciones y Créditos

**Fecha:** 25 de Enero, 2026  
**Estado:** Documentación y análisis

---

## 🎯 Flujo Correcto (Según Requisitos del Negocio)

### ⚠️ IMPORTANTE: El Owner NO existe antes de la invitación
La invitación es el ÚNICO mecanismo para crear un Owner. No hay registro normal de Owner sin invitación.

---

### Paso 1: Staff genera invitación
- Staff crea invitación para una **persona que NO tiene cuenta aún**
- Staff ingresa:
  - Email del futuro Owner (no existe en el sistema)
  - Nombre y apellido del futuro Owner
  - Habitación(es) asignadas con fechas
  - Room type
- Sistema:
  - Genera token único
  - Envía email al futuro Owner
  - Email incluye link y QR code

**Backend actual:** ✅ **CORRECTO**
```
POST /hotels/staff/invitations/create-owner-invitation
```

---

### Paso 2: Futuro Owner recibe email
- La persona recibe email con:
  - Link directo: `{FRONTEND_URL}/register-owner?token=abc123`
  - QR code con el mismo link
  - Token visible por si quiere copiarlo
- **Esta persona NO tiene cuenta aún**

**Backend actual:** ✅ **CORRECTO**  
**Frontend actual:** ❓ **VERIFICAR** - ¿Existe la página `/register-owner`?

---

### Paso 3: Futuro Owner accede con el token

#### 3a. Link/QR desde correo (más común)
- Hace click en el link o escanea QR
- Es redireccionado a: `/register-owner?token=abc123`
- Token está pre-cargado en la URL

#### 3b. Entrada manual (alternativa)
- Va a la web directamente
- Encuentra enlace: "¿Tienes un código de invitación?"
- Introduce el token manualmente
- Es redireccionado a: `/register-owner?token=abc123`

**Frontend actual:** ❓ **VERIFICAR**

---

### Paso 4: Página de Registro + Decisión de Invitación

**ESTE ES EL PASO CRÍTICO - Aquí hay 2 opciones de UX:**

#### **Opción A: Decisión DURANTE el registro** (Recomendado ✅)
1. Owner llega a `/register-owner?token=abc123`
2. Sistema valida token y muestra:
   ```
   ┌─────────────────────────────────────────────┐
   │  📧 Invitación de [Hotel Name]             │
   │                                             │
   │  📅 Fechas: 01/06/2026 - 08/06/2026        │
   │  🏨 Habitación: Deluxe                      │
   │  ⏰ 7 noches                                 │
   │                                             │
   │  Tienes 2 opciones:                        │
   │  ○ Aceptar como reserva confirmada         │
   │  ○ Convertir a 12 créditos                 │
   │                                             │
   │  ¿Qué prefieres?                           │
   │  [ Reserva ]  [ Créditos ]                 │
   └─────────────────────────────────────────────┘
   
   Después de seleccionar, muestra formulario:
   ┌─────────────────────────────────────────────┐
   │  Completa tu registro                      │
   │                                             │
   │  Email: owner@email.com (pre-llenado)      │
   │  Nombre: John (pre-llenado)                │
   │  Apellido: Doe (pre-llenado)               │
   │  Contraseña: [___________]                 │
   │  Confirmar: [___________]                  │
   │  Teléfono: [___________]                   │
   │                                             │
   │  Has seleccionado: ✓ Reserva              │
   │                                             │
   │  [Crear cuenta y confirmar]                │
   └─────────────────────────────────────────────┘
   ```
3. Owner selecciona opción (booking o créditos)
4. Owner completa formulario de registro
5. Al enviar, backend:
   - Crea usuario con rol "owner"
   - Procesa la decisión (bookings o créditos)
   - Marca invitación como accepted
   - Envía notificación a Staff
6. Owner es redireccionado a su dashboard

**Ventajas:**
- ✅ Flujo continuo, sin interrupciones
- ✅ Owner decide con información fresca
- ✅ No necesita login adicional
- ✅ Menos pasos totales

#### **Opción B: Decisión DESPUÉS del registro**
1. Owner llega a `/register-owner?token=abc123`
2. Sistema valida token y muestra solo formulario de registro
3. Owner crea cuenta (sin decidir aún)
4. Después de crear cuenta, redirige a `/owner/pending-invitation`
5. Owner ve detalles y decide
6. Backend procesa la decisión

**Desventajas:**
- ❌ Requiere que Owner inicie sesión después de registrarse
- ❌ Más pasos, más fricción
- ❌ Owner podría olvidar decidir

---

### Paso 5: Backend procesa la decisión

**Backend actual:** ⚠️ **PARCIALMENTE CORRECTO pero en el momento equivocado**

**Problema en `authRoutes.ts` línea 193:**
```typescript
// If owner is registering with an invitation token, accept it automatically
if (invitationToken && role.name === 'owner') {
  // ... Creates bookings automatically ❌
}
```

❌ **Problema:** Auto-acepta como bookings SIN preguntarle al Owner

✅ **Debería ser (Opción A):**
```typescript
// Owner is registering with invitation token AND has made a decision
if (invitationToken && role.name === 'owner' && acceptance_type) {
  // Validate token
  // Create user
  // Process decision (booking OR credits, based on acceptance_type)
  // Mark invitation as accepted
  // Notify staff
}
```

---

### Paso 6: Owner ve su dashboard

**Si eligió Booking:**
- Dashboard muestra: "Tu reserva está pendiente de aprobación del staff"
- Booking aparece con status: `pending_approval`
- Owner espera confirmación

**Si eligió Créditos:**
- Dashboard muestra: "Tienes 12 créditos disponibles"
- Wallet muestra los créditos
- Owner puede usarlos inmediatamente

---

### Paso 7: Staff recibe notificación y actúa

#### 5a. Aceptar como Booking
- Owner confirma las fechas
- Sistema crea bookings con status `pending_approval`
- Bookings aparecen en vista del Owner como "Pendientes de confirmación del Staff"
- Sistema envía notificación al Staff

#### 5b. Convertir a Créditos
- Owner rechaza las fechas específicas
- Owner prefiere usar en otra oportunidad
- Sistema convierte a night credits según fórmula
- Créditos se depositan en wallet del Owner
- Sistema envía notificación al Staff

**Backend actual:** ⚠️ **CONFUSO**

Hay un endpoint `/accept-invitation` que recibe `acceptance_type`:
```typescript
POST /accept-invitation
{
  token: "abc123",
  user_id: 456,
  acceptance_type: "booking" | "credits"
}
```

**Problema:** Este endpoint se llama DURANTE el registro según `authRoutes.ts`, no DESPUÉS.

✅ **Debería ser:**
- Este endpoint se llama DESPUÉS del registro
- Cuando Owner ya está logueado
- Desde una página dedicada en el dashboard del Owner

---

### Paso 6: Staff recibe notificación

#### 6a. Si Owner aceptó como Booking
**Staff ve:**
- Notificación: "Owner X aceptó invitación como booking"
- Booking aparece en lista "Bookings Pendientes de Aprobación"
- Staff debe:
  1. Revisar el booking
  2. Aprobar → Habitación queda bloqueada, no aparece en marketplace
  3. O Rechazar → Habitación se libera, Owner notificado

**Backend actual:** ✅ **CORRECTO** (parcialmente)
```typescript
POST /staff/invitations/approve-booking/:bookingId
POST /staff/invitations/reject-booking/:bookingId
```

**Frontend actual:** ✅ **IMPLEMENTADO** 
- Tab "Bookings" en UnifiedDashboard
- Botones Aprobar/Rechazar funcionan

#### 6b. Si Owner convirtió a Créditos
**Staff ve:**
- Notificación: "Owner X convirtió invitación a créditos"
- Habitación(es) se liberan automáticamente
- Habitaciones vuelven a estar disponibles para marketplace
- Créditos ya están en wallet del Owner

**Backend actual:** ✅ **CORRECTO**
- Al convertir a créditos:
  - Se crean `Week` records con status 'converted'
  - Se crean `NightCredit` records
  - Se calcula con Master Formula
  - NO se crean bookings

**Frontend actual:** ❓ **VERIFICAR**
- ¿Staff recibe notificación?
- ¿Dónde ve Staff el historial de conversiones?

---

## 🔴 Problemas Identificados

### 1. **Auto-aceptación como BOOKING sin preguntarle al Owner (CRÍTICO)**
**Ubicación:** `backend/src/routes/authRoutes.ts` línea 193-259

**Problema:**
```typescript
// If owner is registering with an invitation token, accept it automatically
if (invitationToken && role.name === 'owner') {
  // Creates bookings immediately as DEFAULT ❌
  // No pregunta: ¿Booking o Créditos?
}
```

❌ **MALO:** Asume que el Owner SIEMPRE quiere booking.

✅ **CORRECTO:** Debe recibir `acceptance_type` del frontend y procesarlo.

**Solución:**
```typescript
// Owner is registering with invitation AND decision
if (invitationToken && role.name === 'owner' && acceptance_type) {
  if (acceptance_type === 'booking') {
    // Create bookings with status 'pending_approval'
  } else if (acceptance_type === 'credits') {
    // Convert to credits immediately
  }
}
```

---

### 2. **Falta página de registro especial para Owners**
**Frontend:** No existe `/register-owner` que:
- Valide token de invitación
- Muestre detalles de la invitación
- Permita al Owner elegir: Booking vs Créditos
- Incluya formulario de registro

**Solución:**
- Crear página: `/register-owner?token=abc123`
- Página debe tener 2 secciones:
  1. Sección superior: Detalles de invitación + Decisión
  2. Sección inferior: Formulario de registro (email pre-llenado)

---

### 3. **Endpoint `/accept-invitation` está mal usado**
**Problema:** Ese endpoint está diseñado para Owners que YA tienen cuenta, pero:
- Los Owners SOLO se crean via invitación
- No tiene sentido que exista un Owner sin haber aceptado una invitación primero

**Solución:**
- Este endpoint probablemente NO debería existir
- La lógica debe estar en `/auth/register` con el parámetro `acceptance_type`
- O renombrar a `/invitations/register-and-accept`

---

### 4. **Falta notificación a Staff sobre conversiones**
**Problema:** No hay visibilidad clara de cuándo Owner convierte a créditos.

**Solución:**
- Notificación push/email a Staff cuando Owner se registra y elige
- Dashboard de Staff muestra historial de invitaciones con estados:
  - Pendiente (enviada, no registrado)
  - Aceptada como Booking (registrado, eligió booking)
  - Convertida a Créditos (registrado, eligió créditos)
  - Expirada (token vencido)

---

## ✅ Flujo Correcto Paso a Paso (Revisado)

### Backend: Crear Invitación (Staff)
```
POST /hotels/staff/invitations/create-owner-invitation
{
  "email": "owner@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "rooms_data": [
    {
      "room_id": 5,
      "start_date": "2026-06-01",
      "end_date": "2026-06-08",
      "room_type": "deluxe"
    }
  ],
  "expires_in_days": 30
}

Response:
{
  "success": true,
  "data": {
    "invitation": {
      "token": "abc123...",
      "invitation_link": "https://app.com/accept-invitation?token=abc123",
      "email_sent": true
    }
  }
}
```

---

### Frontend: Owner Recibe Email
```
Subject: Invitación a Propiedad XYZ

Hola John,

Has sido invitado a unirte como propietario en [Hotel Name].

📅 Fechas asigPágina de Registro de Owner con Decisión

**URL:** `/register-owner?token=abc123`

**Flujo completo:**
```
1. Owner llega via link del email
2. Sistema valida token con backend
3. Si válido, muestra página dividida en 2 secciones:

┌──────────────────────────────────────────────────────────┐
│  SECCIÓN 1: Invitación y Decisión                        │
│                                                           │
│  📧 Invitación de [Hotel Name]                          │
│  Te han asignado:                                        │
│                                                           │
│  📅 Check-in: 01/06/2026                                │
│  📅 Check-out: 08/06/2026                               │
│  🏨 Habitación: Deluxe Suite                            │
│  ⏰ 7 noches                                             │
│                                                           │
│  ¿Qué prefieres hacer?                                  │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │  📅 Aceptar         │  │  💎 Convertir       │      │
│  │  como Reserva       │  │  a Créditos         │      │
│  │                     │  │                     │      │
│  │  ✓ Fechas fijas     │  │  ✓ Flexibilidad     │      │
│  │  ⏳ Requiere        │  │  ✓ 12 créditos      │      │
│  │     aprobación      │  │  ✓ Disponible ya    │      │
│  │                     │  │                     │      │
│  │  [ Seleccionar ]    │  │  [ Seleccionar ]    │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                           │
│  ✓ Has seleccionado: Reserva                            │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  SECCIÓN 2: Completa tu Registro                         │
│                                                           │
│  Email:          [owner@email.com] (deshabilitado)       │
│  Nombre:         [John] (deshabilitado)                  │
│  Apellido:       [Doe] (deshabY Decisión (en un solo paso)
```
POST /auth/register
{
  "email": "owner@example.com",
  "password": "secure123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "role": "owner",
  "invitation_token": "abc123",
  "acceptance_type": "booking" | "credits"  // ← NUEVO parámetro REQUERIDO
}

Backend:
1. Valida que token existe y es válido
2. Valida que email coincide con invitación
3. Crea usuario con rol owner
4. Procesa la decisión según acceptance_type:
   
   SI acceptance_type === "booking":
   - Crea Booking records con status: 'pending_approval'
   - Marca invitación con: acceptance_type: 'booking'
   - Envía notificación a Staff: "Owner aceptó como reserva"
   
   SI acceptance_type === "credits":
   - Calcula créditos con Master Formula
   - Crea Week records con status: 'converted'
   - Crea NightCredit records
   - Marca invitación con: acceptance_type: 'credits'
   - Envía notificación a Staff: "Owner convirtió a créditos"

5. Marca invitación como: status='accepted'

Response (si booking):
{
  "success": true,
  "message": "Cuenta creada. Tu reserva está pendiente de aprobación.",
  "data": {
    "user": { ... },
    "bookings": [
      {
        "id": 789,
        "status": "pending_approval",
        "check_in": "2026-06-01",
        "check_out": "2026-06-08"
      }
    ]
  }
}

Response (si credits):
{
  "success": true,
  "message": "Cuenta creada. Tienes 12 créditos disponibles.",
  "data": {
    "user": { ... },
    "credits": {
      "total_nights": 12,
      "expiry_date": "2027-12-25"
    }
```

**Opción B: Entrada Manual**
```
URL: /accept-invitation

1. Owner ve formulario: "Ingresa tu código de invitación"
2. Owner pega: abc123
3. Sistema valida token
4. Si válido, muestra formulario de registro
5. ... resto igual
```

---

### Backend: Registro con Token (NO acepta invitación aún)
```
POST /auth/register
{
  "email": "owner@example.com",
  "password": "secure123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "owner",
  "invitation_token": "abc123"  // ← Solo para validación
}

Backend:
1. Valida que token existe y es válido
2. Valida que email coincide con invitación
3. Crea usuario con rol owner
4. Almacena token en perfil del usuario (campo: pending_invitation_token)
5. NO crea bookings
6. NO marca invitación como accepted

Response:
{
  "success": true,
  "message": "Cuenta creada exitosamente",
  "data": {
    "user": { ... },
    "has_pending_invitation": true  // ← Indicador importante
  }
}
```

---

### Frontend: Owner Inicia Sesión y Ve Dashboard

**Dashboard muestra:**
```tsx
{hasPendingInvitation && (
  <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6 mb-6">
    <div className="flex items-start gap-4">
      <Bell className="h-8 w-8 text-purple-600" />
      <div className="flex-1">
        <h3 className="text-lg font-bold text-purple-900 mb-2">
          ¡Tienes una invitación pendiente!
        </h3>
        <p className="text-sm text-purple-700 mb-4">
          Debes decidir qué hacer con tu invitación antes de poder usar tu cuenta completamente.
        </p>
        <Link 
          to="/owner/invitations/pending"
          className="btn btn-primary"
        >
          Ver Invitación →
        </Link>
      </div>
    </div>
  </div>
)}
```

---

### Frontend: Página de Decisión de Invitación

**URL:** `/owner/invitations/pending`

```tsx
function PendingInvitationPage() {
  const { invitation } = useQuery(['pending-invitation']);
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Tu Invitación</h1>
      
      {/* Detalles de la Invitación */}
      <ModernCard>
        <h2 className="text-xl font-semibold mb-4">
          {invitation.property.name}
        </h2>
        
        <div className="space-y-4">
          {invitation.rooms_data.map(room => (
            <div key={room.room_id} className="border-l-4 border-purple-500 pl-4">
              <p className="font-medium">{room.room_type}</p>
              <p className="text-sm text-gray-600">
                📅 {formatDate(room.start_date)} - {formatDate(room.end_date)}
              </p>
              <p className="text-sm text-gray-600">
                ⏰ {room.nights} noches
              </p>
              <p className="text-sm text-purple-600">
                💰 Créditos estimados si conviertes: {room.estimated_credits}
              </p>
            </div>
          ))}
        </div>
      </ModernCard>
      
      {/* Opciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Opción A: Aceptar como Booking */}
        <ModernCard 
          className="border-2 border-green-500 cursor-pointer hover:shadow-xl"
          onClick={() => handleAccept('booking')}
        >
          <div className="text-center p-6">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-xl font-bold mb-2">Aceptar como Reserva</h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirma estas fechas para tu estadía. 
              El staff debe aprobar tu solicitud.
            </p>
            <div className="bg-green-50 rounded p-3 text-sm text-green-800">
              ✓ Fechas garantizadas (sujeto a aprobación)
              <br />
              ✓ Habitación reservada
              <br />
              ⏳ Requiere confirmación del staff
            </div>
          </div>
        </ModernCard>
        
        {/* Opción B: Convertir a Créditos */}
        <ModernCard 
          className="border-2 border-purple-500 cursor-pointer hover:shadow-xl"
          onClick={() => handleAccept('credits')}
        >
          <div className="text-center p-6">
            <Coins className="h-16 w-16 mx-auto mb-4 text-purple-600" />
            <h3 className="text-xl font-bold mb-2">Convertir a Créditos</h3>
            <p className="text-sm text-gray-600 mb-4">
              Recibe créditos en tu wallet para usar 
              cuando y donde quieras.
            </p>
            <div className="bg-purple-50 rounded p-3 text-sm text-purple-800">
              ✓ Flexibilidad total
              <br />
              ✓ Usa en cualquier propiedad de la red
              <br />
              ✓ Disponible inmediatamente
              <br />
              💎 <strong>{totalCredits} créditos</strong>
            </div>
          </div>
        </ModernCard>
      </div>
    </div>
  );
}
```

---

### Backend: Owner Acepta Invitación

**Opción A: Como Booking**
```
POST /owner/invitations/accept
{
  "token": "abc123",
  "acceptance_type": "booking"
}

Backend:
1. Valida token pertenece al owner logueado
2. Crea Bookings con status: 'pending_approval'
3. Marca invitación como: accepted (acceptance_type: 'booking')
4. Envía notificación al Staff
5. Habitaciones NO se bloquean aún (hasta que staff apruebe)

Response:
{
  "success": true,
  "message": "Invitación aceptada. El staff revisará tu solicitud.",
  "data": {
    "bookings": [
      {
        "id": 789,
        "room_id": 5,
        "check_in": "2026-06-01",
        "check_out": "2026-06-08",
        "status": "pending_approval"
      }
    ]
  }
}
```

**Opción B: Como Créditos**
```
POST /owner/invitations/accept
{
  "token": "abc123",
  "acceptance_type": "credits"
}

Backend:
1. Valida token pertenece al owner logueado
2. Crea Week records (status: 'converted')
3. Calcula créditos con Master Formula
4. Crea NightCredit records
5. Marca invitación como: accepted (acceptance_type: 'credits')
6. Envía notificación al Staff
7. Habitaciones quedan libres inmediatamente

Response:
{
  "success": true,
  "message": "Invitación convertida a créditos exitosamente",
  "data": {
    "total_credits": 12,
    "credits": [
      {
        "id": 456,
        "nights": 12,
        "expiry_date": "2027-12-25"
      }
    ]
  }
}
```

---

### Frontend: Staff Recibe Notificación

**Cuando Owner acepta como Booking:**
```
Dashboard Staff → Tab "Bookings" → Badge muestra "1"

Card:
┌─────────────────────────────────────┐
│ 🟣 John Doe                          │
│ john@example.com                     │
│ ────────────────────────────────────│
│ Check-in: 01/06/2026                │
│ Check-out: 08/06/2026               │
│ Noches: 7                            │
│ Habitación: Deluxe (#5)             │
│ ────────────────────────────────────│
│ 📋 Origen: Invitación de Staff      │
│ 💰 Créditos estimados: 12           │
│ ────────────────────────────────────│
│ [✓ Aprobar]  [× Rechazar]           │
└─────────────────────────────── - Agregar parámetro `acceptance_type`**
```typescript
// ANTES (línea 193):
if (invitationToken && role.name === 'owner') {
  // Creates bookings automatically ❌
  // No pregunta al Owner qué prefiere
}

// DESPUÉS:
if (invitationToken && role.name === 'owner') {
  // Validar que acceptance_type fue enviado
  const { acceptance_type } = req.body;
  
  if (!acceptance_type || !['booking', 'credits'].includes(acceptance_type)) {
    return res.status(400).json({
      success: false,
      message: 'acceptance_type es requerido (booking o credits)'
    });
  }
  
  const invitation = await OwnerInvitation.findOne({
    where: { token: invitationToken, status: 'pending' }
  });
  
  if (!invitation || !invitation.isValid() || invitation.email !== email) {
    return res.status(400).json({
      success: false,
      message: 'Token de invitación inválido o expirado'
    });
  }
  
  // Procesar según decisión del Owner
  if (acceptance_type === 'booking') {
    // Crear bookings con status 'pending_approval'
    // ... lógica existente ...
    
    // Notificar a Staff
    await emailService.sendStaffNotification({
      type: 'owner_accepted_booking',
      owner: user,
      invitation
    });
  } else if (acceptance_type === 'credits') {
    // Convertir a créditos
    // Calcular con Master Formula
    // Crear WeekRegistro de Owner**
- Ruta: `/register-owner?token=abc123`
- Componente: `RegisterOwner.tsx`
- Funcionalidad:
  - Valida token con GET `/invitations/validate?token=xxx`
  - Muestra detalles de la invitación
  - Permite seleccionar: Booking vs Créditos
  - Formulario de registro (email/nombre pre-llenados)
  - Submit envía: `POST /auth/register` con `acceptance_type`

**2.2. Página alternativa para entrada manual de token**
- Ruta: `/invitation-code`
- Simple input para pegar token
- Redirige a: `/register-owner?token=xxx`

**2.3. NO necesita banner en dashboard**
- El Owner se registra y decide en un solo paso
- No hay "invitación pendiente" después del registro
- Al registrarse, la invitación ya fue procesada
  });
}
```

**1.2. Eliminar endpoint `/accept-invitation` (ya no es necesario)**
```typescript
// Este endpoint era para Owners que YA tienen cuenta
// Pero los Owners SOLO se crean via invitación
// Por lo tanto, este endpoint es redundante
// La lógica se maneja en /auth/register con acceptance_type// Creates bookings automatically ❌
}

// DESPUÉS:
if (invitationToken && role.name === 'owner') {
  // Solo validar y almacenar token
  const invitation = await OwnerInvitation.findOne({
    where: { token: invitationToken, status: 'pending' }
  });
  RECIBIR `acceptance_type` durante registro
- [ ] Validar que `acceptance_type` es requerido cuando hay `invitationToken`
- [ ] Procesar decisión según `acceptance_type` (booking o credits)
- [ ] Agregar notificaciones a Staff cuando Owner se registra y decide
- [ ] Actualizar modelo `OwnerInvitation` para incluir `acceptance_type`
- [ ] ~~Eliminar endpoint `/accept-invitation`~~ (o marcarlo como deprecado)

### Frontend Owner
- [ ] Crear página `/register-owner?token=xxx`
- [ ] Crear endpoint de validación: `GET /invitations/validate?token=xxx`
- [ ] UI para mostrar detalles de invitación en página de registro
- [ ] UI para seleccionar: Booking vs Créditos
- [ ] Formulario de registro integrado con la decisión
- [ ] Enviar `acceptance_type` en POST `/auth/register`
router.post('/accept', 
  authenticateToken, 
  requireOwnerRole, 
  async (req, res) => {
    const { acceptance_type } = req.body;
    const userId = req.user.id;
    
    // Obtener token del perfil del usuario
    const user = await User.findByPk(userId);
    const token = user.pending_invitation_token;
    
    // ... resto de lógica existente de accept-invitation
    // pero ahora se llama DESPUÉS del login
  }
);
```

---

### Fase 2: Crear Frontend (Owner)

**2.1. Página de Entrada de Token**
- `/accept-invitation` (con o sin ?token=)
- Formulario para ingresar token manualmente
- Validación de token
- Redirige a registro con token validado

**2.2. Página de Decisión**
- `/owner/invitations/pending`
- Mostrar detalles de invitación
- 2 cards grandes: Booking vs Créditos
- Confirmación antes de proceder

**2.3. Banner en Dashboard**
- Detectar si `user.has_pending_invitation`
- Mostrar alerta prominente
- Link a página de decisión

---Futuro Owner recibe email
- [ ] Test: Futuro Owner abre link → Ve página de registro con detalles
- [ ] Test: Owner registra + elige booking → Cuenta creada + Bookings pending
- [ ] Test: Owner registra + elige créditos → Cuenta creada + Créditos en wallet
- [ ] Test: Staff ve notificación cuando Owner elige booking
- [ ] Test: Staff ve notificación cuando Owner elige créditos
- [ ] Test: Staff aprueba booking → Habitación bloqueada
- [ ] Test: Invitación expirada → No se puede registrar
- [ ] Test: Email incorrecto → No puede usar el token
- Ver todas las invitaciones creadas
- Estados: Pendiente, Aceptada (Booking), Convertida (Créditos), Expirada
- Filtros y búsqueda

**3.2. Notificaciones**
- Badge en menú cuando hay nuevas acciones
- Lista de notificaciones
- Push notifications (opcional)

---

## 📋 Checklist de Correcciones

### Backend
- [ ] Modificar `authRoutes.ts` para NO crear bookings durante registro
- [ ] Agregar campo `pending_invitation_token` a modelo User
- [ ] Crear endpoint `POST /owner/invitations/accept`
- [ ] Modificar endpoint actual `/accept-invitation` para que solo funcione post-login
- [ ] Agregar notificaciones cuando Owner acepta/convierte

### Frontend Owner
- [ ] Crear página `/accept-invitation`
- [ ] Crear página `/owner/invitations/pending`
- [ ] Agregar banner en dashboard si hay invitación pendiente
- [ ] Mostrar notificación después de aceptar

### Frontend Staff
- [ ] Agregar sección "Historial de Invitaciones"
- [ ] Mostrar estado de cada invitación
- [ ] Notificaciones cuando Owner actúa

### Testing
- [ ] Test: Staff crea invitación → Owner recibe email
- [ ] Test: Owner registra con token → NO se crean bookings
- [ ] Test: Owner acepta como booking → Staff ve pending
- [ ] Test: Staff aprueba booking → Habitación bloqueada
- [ ] Test: Owner convierte a créditos → Créditos en wallet
- [ ] Test: Invitación expirada → No se puede aceptar

---

**Última actualización:** 25 de Enero, 2026  
**Prioridad:** ALTA - Corregir flujo de auto-aceptación
