# Flujo de Invitación de Owner - Análisis Completo

**Fecha:** 25 de Enero, 2026  
**Objetivo:** Documentar el flujo completo desde que Staff crea la invitación hasta que el Owner la acepta y decide entre booking o créditos

---

## 🎯 Resumen Ejecutivo

Este flujo permite al **Staff** invitar a nuevos propietarios otorgándoles habitaciones pre-asignadas. El **Owner** puede elegir entre:
1. **Aceptar como bookings** (mantener las reservas y confirmarlas)
2. **Convertir a créditos** (recibir créditos para usar en el marketplace)

---

## 📊 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    STAFF CREA INVITACIÓN                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ POST /staff/invitations/              │
        │      create-owner-invitation          │
        │                                       │
        │ Params:                               │
        │  - email                              │
        │  - first_name, last_name              │
        │  - rooms_data: [                      │
        │      { room_id, start_date,           │
        │        end_date, room_type }          │
        │    ]                                  │
        │  - expires_in_days: 30 (default)     │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ Sistema genera:                       │
        │  ✓ Token único (64 chars hex)         │
        │  ✓ Fecha de expiración                │
        │  ✓ Link de invitación                 │
        │  ✓ Email automático al owner          │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              OWNER RECIBE EMAIL CON LINK                     │
│   "Has sido invitado a ser propietario en [Property]"       │
│   Link: http://frontend/register?invitation=TOKEN           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              OWNER HACE CLICK EN LINK                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ Frontend valida token:                │
        │ GET /public/invitations/              │
        │     invitation/:token                 │
        │                                       │
        │ Response:                             │
        │  - email (pre-filled)                 │
        │  - first_name, last_name              │
        │  - property info                      │
        │  - rooms_count                        │
        │  - expires_at                         │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         OWNER COMPLETA REGISTRO (RegisterWizard)             │
│  - Formulario pre-lleno con datos de invitación             │
│  - Owner completa password, phone, etc.                     │
│  - Sistema crea cuenta con rol "owner"                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ POST /auth/register                   │
        │  + invitationToken en body            │
        │                                       │
        │ Sistema:                              │
        │  1. Crea usuario                      │
        │  2. Asigna rol "owner"                │
        │  3. Acepta invitación                 │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ POST /staff/invitations/              │
        │      accept-invitation                │
        │                                       │
        │ Params:                               │
        │  - token                              │
        │  - user_id                            │
        │  - acceptance_type: "booking"         │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ Sistema crea BOOKINGS PENDIENTES     │
        │ Por cada room en rooms_data:          │
        │                                       │
        │ Booking.create({                      │
        │   property_id                         │
        │   room_id                             │
        │   guest_name: Owner's name            │
        │   guest_email: Owner's email          │
        │   check_in, check_out                 │
        │   status: 'pending'                   │
        │   raw: {                              │
        │     source: 'staff_invitation'        │
        │     booking_type: 'owner_invitation'  │
        │     invitation_id                     │
        │   }                                   │
        │ })                                    │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           OWNER VE BOOKINGS PENDIENTES EN WEEKS              │
│                                                              │
│   Status: "pending"                                          │
│   Badge: "owner_invitation"                                  │
│                                                              │
│   Opciones:                                                  │
│   ┌─────────────────┐  ┌─────────────────┐                 │
│   │ ✓ Confirmar      │  │ 💳 Convertir a  │                 │
│   │   Booking        │  │    Créditos     │                 │
│   └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                    ↓                    ↓
        ┌───────────────────┐  ┌───────────────────┐
        │   OPCIÓN A:        │  │   OPCIÓN B:        │
        │   CONFIRMAR        │  │   CONVERTIR        │
        └───────────────────┘  └───────────────────┘
                ↓                         ↓
                
═════════════════════════════════════════════════════════════
   OPCIÓN A: CONFIRMAR BOOKING
═════════════════════════════════════════════════════════════

Owner hace click en "✓ Confirmar Booking"
                ↓
        ┌───────────────────────────────────────┐
        │ POST /staff/invitations/              │
        │      confirm-booking/:bookingId       │
        │                                       │
        │ Verifica:                             │
        │  - Booking pertenece al owner         │
        │  - Status es 'pending'                │
        │  - Source es 'staff_invitation'       │
        │                                       │
        │ Actualiza:                            │
        │  booking.status = 'pending_approval'  │
        └───────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│        BOOKING ENTRA EN COLA DE APROBACIÓN DE STAFF          │
│                                                              │
│  Staff ve en PendingBookings.tsx:                           │
│   - Booking de tipo "owner_invitation"                      │
│   - Status "pending_approval"                               │
│   - Puede aprobar o rechazar                                │
└─────────────────────────────────────────────────────────────┘
                ↓
        ┌───────────────────────────────────────┐
        │ Staff aprueba:                        │
        │ POST /staff/invitations/              │
        │      approve-booking/:bookingId       │
        │                                       │
        │ Sistema:                              │
        │  1. Actualiza booking.status =        │
        │     'confirmed'                       │
        │  2. Si usó créditos, confirma         │
        │     transacción                       │
        │  3. Week ya no es editable            │
        └───────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│              BOOKING CONFIRMADO ✅                           │
│                                                              │
│  Owner ve en Weeks.tsx:                                     │
│   - Status: "confirmed"                                     │
│   - Puede usar la reserva en las fechas                     │
│   - Badge: "owner_invitation" (origen)                      │
└─────────────────────────────────────────────────────────────┘


═════════════════════════════════════════════════════════════
   OPCIÓN B: CONVERTIR A CRÉDITOS
═════════════════════════════════════════════════════════════

Owner hace click en "💳 Convertir a Créditos"
                ↓
        ┌───────────────────────────────────────┐
        │ Modal confirma la conversión:         │
        │                                       │
        │ "Al convertir, recibirás XX créditos  │
        │  y perderás este booking"             │
        │                                       │
        │ ¿Estás seguro?                        │
        └───────────────────────────────────────┘
                ↓ (Owner confirma)
                
        ┌───────────────────────────────────────┐
        │ POST /staff/invitations/              │
        │      convert-booking-to-credits/      │
        │      :bookingId                       │
        │                                       │
        │ Verifica:                             │
        │  - Booking pertenece al owner         │
        │  - Status es 'pending'                │
        │  - Source es 'staff_invitation'       │
        └───────────────────────────────────────┘
                ↓
        ┌───────────────────────────────────────┐
        │ Calcula créditos:                     │
        │                                       │
        │ 1. Calcula noches:                    │
        │    nights = (checkout - checkin)      │
        │                                       │
        │ 2. Obtiene season_type de calendar    │
        │    (RED, WHITE, BLUE)                 │
        │                                       │
        │ 3. Usa CreditCalculationService:      │
        │    calculateBookingCost(              │
        │      property_id,                     │
        │      room_type,                       │
        │      season_type,                     │
        │      nights                           │
        │    )                                  │
        │                                       │
        │ 4. Resultado: totalCredits            │
        └───────────────────────────────────────┘
                ↓
        ┌───────────────────────────────────────┐
        │ Actualiza UserCreditWallet:           │
        │                                       │
        │ wallet.total_balance += credits       │
        │ wallet.total_earned += credits        │
        └───────────────────────────────────────┘
                ↓
        ┌───────────────────────────────────────┐
        │ Crea CreditTransaction:               │
        │                                       │
        │ CreditTransaction.create({            │
        │   user_id: owner.id                   │
        │   transaction_type: 'DEPOSIT'         │
        │   amount: credits                     │
        │   status: 'ACTIVE'                    │
        │   booking_id: booking.id              │
        │   description: "Converted invitation  │
        │     booking to credits"               │
        │ })                                    │
        └───────────────────────────────────────┘
                ↓
        ┌───────────────────────────────────────┐
        │ Cancela booking:                      │
        │                                       │
        │ booking.status = 'cancelled'          │
        └───────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│            CRÉDITOS AGREGADOS A WALLET ✅                    │
│                                                              │
│  Owner ve:                                                  │
│   - Balance actualizado en Dashboard                        │
│   - Transacción en historial                                │
│   - Puede usar créditos en marketplace                      │
│                                                              │
│  Booking:                                                   │
│   - Ya no aparece en Weeks (status: cancelled)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Endpoints del Backend

### 1. **Staff crea invitación**

```
POST /hotels/staff/invitations/create-owner-invitation
Auth: requireStaffRole
```

**Request Body:**
```json
{
  "email": "nuevo.owner@example.com",
  "first_name": "Juan",
  "last_name": "Pérez",
  "rooms_data": [
    {
      "room_id": 123,
      "start_date": "2026-03-01",
      "end_date": "2026-03-08",
      "room_type": "suite"
    },
    {
      "room_id": 124,
      "start_date": "2026-07-15",
      "end_date": "2026-07-22",
      "room_type": "duplex"
    }
  ],
  "expires_in_days": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Owner invitation created successfully",
  "data": {
    "invitation": {
      "id": 5,
      "token": "a1b2c3d4...64chars",
      "email": "nuevo.owner@example.com",
      "property_id": 10,
      "rooms_count": 2,
      "expires_at": "2026-02-25T00:00:00.000Z",
      "invitation_link": "http://localhost:5173/register?invitation=a1b2c3d4...",
      "email_sent": true
    }
  }
}
```

**Validaciones:**
- ✅ Staff debe tener property_id asignado
- ✅ Todas las habitaciones deben pertenecer a la property del staff
- ✅ rooms_data no puede estar vacío
- ✅ Cada room debe tener: room_id, start_date, end_date, room_type
- ✅ Email no debe existir como usuario registrado
- ✅ No debe haber otra invitación pendiente para ese email

**Proceso:**
1. Genera token único (crypto.randomBytes(32))
2. Calcula fecha de expiración (default 30 días)
3. Crea registro en OwnerInvitation
4. Envía email con link de invitación
5. Retorna link para que staff pueda copiarlo manualmente si el email falla

---

### 2. **Owner valida token (público)**

```
GET /hotels/api/public/invitations/invitation/:token
Auth: NO REQUERIDO
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "nuevo.owner@example.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "property": {
      "id": 10,
      "name": "Resort Paradise",
      "location": "Cancún, México"
    },
    "rooms_count": 2,
    "rooms_data": [...],
    "expires_at": "2026-02-25T00:00:00.000Z"
  }
}
```

**Validaciones:**
- ✅ Token existe
- ✅ Invitación status = 'pending'
- ✅ No ha expirado (expires_at > now)

---

### 3. **Owner acepta invitación (durante registro)**

```
POST /hotels/staff/invitations/accept-invitation
Auth: NO REQUERIDO (se llama después de crear usuario)
```

**Request Body:**
```json
{
  "token": "a1b2c3d4...",
  "user_id": 42,
  "acceptance_type": "booking"  // o "credits"
}
```

**Response (acceptance_type: "booking"):**
```json
{
  "success": true,
  "message": "Invitation accepted. Please confirm or convert your bookings.",
  "data": {
    "acceptance_type": "booking",
    "bookings_created": 2,
    "bookings": [
      {
        "id": 100,
        "room_id": 123,
        "check_in": "2026-03-01",
        "check_out": "2026-03-08",
        "status": "pending"
      },
      {
        "id": 101,
        "room_id": 124,
        "check_in": "2026-07-15",
        "check_out": "2026-07-22",
        "status": "pending"
      }
    ],
    "user_role": "owner"
  }
}
```

**Proceso (acceptance_type: "booking"):**
1. Convierte usuario a rol "owner"
2. Por cada room en rooms_data:
   - Crea Booking con status 'pending'
   - guest_name = nombre del owner
   - guest_email = email del owner
   - total_amount = 0 (sin pago)
   - payment_status = 'completed'
   - raw.booking_type = 'owner_invitation'
3. Marca invitación como 'accepted'
4. Owner debe decidir: confirmar o convertir cada booking

---

### 4. **Owner confirma booking**

```
POST /hotels/staff/invitations/confirm-booking/:bookingId
Auth: authenticateToken
```

**Validaciones:**
- ✅ Booking pertenece al owner (guest_email = user.email)
- ✅ Status = 'pending'
- ✅ Source = 'staff_invitation'

**Proceso:**
1. Actualiza booking.status = 'pending_approval'
2. Staff debe aprobar en PendingBookings

---

### 5. **Staff aprueba booking**

```
POST /hotels/staff/invitations/approve-booking/:bookingId
Auth: requireStaffRole
```

**Validaciones:**
- ✅ Booking pertenece a la property del staff
- ✅ Status = 'pending_approval'

**Proceso:**
1. Actualiza booking.status = 'confirmed'
2. Si usó créditos, confirma transacción
3. Owner puede usar la reserva

---

### 6. **Owner convierte booking a créditos**

```
POST /hotels/staff/invitations/convert-booking-to-credits/:bookingId
Auth: authenticateToken
```

**Validaciones:**
- ✅ Booking pertenece al owner
- ✅ Status = 'pending'
- ✅ Source = 'staff_invitation'

**Proceso:**
1. Calcula nights = (checkout - checkin) en días
2. Obtiene season_type del calendario
3. Calcula créditos usando CreditCalculationService
4. Actualiza UserCreditWallet:
   - total_balance += credits
   - total_earned += credits
5. Crea CreditTransaction (DEPOSIT)
6. Cancela booking (status = 'cancelled')

**Ejemplo de cálculo:**
```javascript
// Booking: 7 noches en Suite, temporada RED
nights = 7
room_type = "suite"
season_type = "RED"

// CreditCalculationService.calculateBookingCost()
// Base: season_type RED = alta valoración
// Multiplier: suite = 1.5x
// Total: ~1,200 créditos (ejemplo)

credits = 1200
```

---

## 🎨 Frontend - Componentes

### 1. **Staff: CreateOwnerInvitation.tsx**

**Ubicación:** `frontend/src/pages/staff/CreateOwnerInvitation.tsx`

**Funcionalidad:**
- Formulario para crear invitación
- Selector de habitaciones con fechas
- Preview de créditos estimados
- Copia link de invitación
- Muestra si email fue enviado

**Estado:**
```typescript
interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  rooms: Array<{
    room_id: number;
    start_date: string;
    end_date: string;
    room_type: string;
  }>;
}
```

**Mutation:**
```typescript
const createInvitationMutation = useMutation({
  mutationFn: (data) => 
    apiClient.post('/staff/invitations/create-owner-invitation', data),
  onSuccess: (response) => {
    const invitation = response.data.data.invitation;
    toast.success('Invitación creada!');
    if (!invitation.email_sent) {
      toast.error('⚠️ Email no pudo ser enviado. Copia el link manualmente.');
    }
    setCreatedInvitation(invitation);
  }
});
```

---

### 2. **Owner: Weeks.tsx**

**Ubicación:** `frontend/src/pages/owner/Weeks.tsx`

**Funcionalidad:**
- Lista todos los weeks/bookings del owner
- Identifica bookings de invitación (booking_type: 'owner_invitation')
- Muestra botones: "Confirmar" y "Convertir a Créditos"
- Modales de confirmación

**Detección de invitation bookings:**
```typescript
const invitationBookings = weeks.filter(w => {
  if (w.source !== 'booking') return false;
  const bookingType = (w as any).booking_type;
  return bookingType === 'owner_invitation';
});
```

**Render condicional:**
```tsx
{week.status === 'pending' && 
 week.booking_type === 'owner_invitation' && (
  <div className="flex gap-2">
    <button
      onClick={() => {
        setSelectedBooking(week);
        setConfirmModalOpen(true);
      }}
      disabled={isConfirmingInvitation}
    >
      ✓ Confirmar Booking
    </button>
    <button
      onClick={() => {
        setSelectedBooking(week);
        setConvertModalOpen(true);
      }}
      disabled={isConvertingInvitation}
    >
      💳 Convertir a Créditos
    </button>
  </div>
)}
```

---

### 3. **Hook: useWeeks.ts**

**Ubicación:** `frontend/src/hooks/useWeeks.ts`

**Mutations disponibles:**
```typescript
// Confirmar invitation booking
const confirmInvitationBookingMutation = useMutation({
  mutationFn: (bookingId: number) => 
    timeshareApi.confirmInvitationBooking(bookingId),
  onSuccess: () => {
    toast.success('Booking confirmado!');
    queryClient.invalidateQueries({ queryKey: ['weeks'] });
  }
});

// Convertir invitation booking a créditos
const convertInvitationBookingMutation = useMutation({
  mutationFn: (bookingId: number) => 
    timeshareApi.convertInvitationBookingToCredits(bookingId),
  onSuccess: (data) => {
    toast.success(`¡Convertido a ${data.data.credits_added} créditos!`);
    queryClient.invalidateQueries({ queryKey: ['weeks'] });
    queryClient.invalidateQueries({ queryKey: ['creditWallet'] });
  }
});
```

---

### 4. **API Client: timeshare.ts**

```typescript
export const confirmInvitationBooking = async (bookingId: number) => {
  const { data } = await apiClient.post(
    `/staff/invitations/confirm-booking/${bookingId}`
  );
  return data;
};

export const convertInvitationBookingToCredits = async (bookingId: number) => {
  const { data } = await apiClient.post(
    `/staff/invitations/convert-booking-to-credits/${bookingId}`
  );
  return data;
};
```

---

## 🎯 Estados del Booking de Invitación

```
Estado del Booking en el flujo:

1. PENDING (inicial)
   - Owner ve 2 botones: Confirmar / Convertir
   - No ha tomado decisión
   
2A. PENDING_APPROVAL (si owner confirma)
    - Staff debe aprobar
    - Aparece en PendingBookings del staff
    
    → Staff aprueba:
      2A.1. CONFIRMED
            - Booking confirmado ✅
            - Owner puede usar reserva
    
    → Staff rechaza:
      2A.2. REJECTED
            - Booking rechazado ❌
            - No se convierte en week

2B. CANCELLED (si owner convierte a créditos)
    - Booking cancelado
    - Créditos agregados a wallet
    - No hay vuelta atrás
```

---

## ✅ Casos de Uso Completos

### Caso 1: Owner Acepta y Confirma Booking

```
1. Staff crea invitación:
   - Email: owner@example.com
   - 1 habitación Suite del 01-08 Mar
   
2. Owner recibe email, hace click

3. Owner completa registro:
   - Sistema acepta invitación con acceptance_type: "booking"
   - Se crea 1 Booking con status: "pending"
   
4. Owner inicia sesión, va a Weeks.tsx:
   - Ve booking pendiente con badge "owner_invitation"
   - Hace click "✓ Confirmar Booking"
   
5. Sistema:
   - POST /confirm-booking/:bookingId
   - booking.status = "pending_approval"
   
6. Staff ve en PendingBookings:
   - Booking de "owner@example.com"
   - Tipo: "owner_invitation"
   - Aprueba
   
7. Sistema:
   - POST /approve-booking/:bookingId
   - booking.status = "confirmed"
   
8. Owner ve en Weeks:
   - Booking confirmado ✅
   - Puede usar la reserva del 01-08 Mar
```

---

### Caso 2: Owner Convierte a Créditos

```
1. Staff crea invitación:
   - Email: owner2@example.com
   - 2 habitaciones:
     a) Duplex 01-08 Mar (temporada RED)
     b) Suite 15-22 Jul (temporada BLUE)
   
2. Owner recibe email, completa registro

3. Sistema acepta invitación con acceptance_type: "booking":
   - Se crean 2 Bookings con status: "pending"
   
4. Owner va a Weeks.tsx:
   - Ve 2 bookings pendientes
   - Hace click "💳 Convertir a Créditos" en ambos
   
5. Sistema (por cada booking):
   
   Booking 1:
   - 7 noches, Duplex, RED
   - Cálculo: 1,000 créditos
   - wallet.total_balance += 1,000
   - booking.status = "cancelled"
   
   Booking 2:
   - 7 noches, Suite, BLUE
   - Cálculo: 800 créditos
   - wallet.total_balance += 800
   - booking.status = "cancelled"
   
6. Owner ve:
   - Balance: 1,800 créditos ✅
   - Bookings ya no aparecen en Weeks
   - Puede usar créditos en marketplace
```

---

### Caso 3: Owner Mixto (Confirma uno, Convierte otro)

```
1. Staff crea invitación con 3 habitaciones

2. Owner acepta como "booking"
   - 3 bookings pendientes

3. Owner decide:
   - Booking A (Mar): Confirmar ✓
   - Booking B (Jul): Convertir 💳
   - Booking C (Dic): Convertir 💳

4. Resultado:
   - Booking A: status "pending_approval" → Staff aprueba → "confirmed"
   - Booking B: status "cancelled" → +900 créditos
   - Booking C: status "cancelled" → +1,100 créditos
   
5. Owner tiene:
   - 1 reserva confirmada (Mar)
   - 2,000 créditos para marketplace
```

---

## ⚠️ Casos Edge y Validaciones

### 1. **Invitación Expirada**

```
Validación:
if (invitation.status !== 'pending' || new Date() > invitation.expires_at) {
  return error("Invitation has expired");
}

Flujo:
- Owner intenta usar link después de 30 días
- Sistema: "Esta invitación ha expirado"
- Staff debe crear nueva invitación
```

### 2. **Email Ya Existe**

```
Validación:
const existingUser = await User.findOne({ where: { email } });
if (existingUser) {
  return error("User with this email already exists");
}

Recomendación:
- Si el usuario ya existe como guest, usar "Assign Period" en vez de invitación
- Invitaciones son solo para nuevos owners
```

### 3. **Habitación No Disponible**

```
TODO: Validación pendiente
- Cuando staff crea invitación, debe validar disponibilidad de fechas
- No debe permitir doble reserva de misma habitación
```

### 4. **Owner No Toma Decisión**

```
Estado actual:
- Bookings quedan en status "pending" indefinidamente
- No hay timeout automático

Mejora recomendada:
- Agregar reminder email después de 7 días
- Opción de expirar invitación si no se usa en X días
```

### 5. **Conversión Después de Confirmación**

```
Validación actual:
- Solo permite convertir bookings con status "pending"
- Si owner ya confirmó (status "pending_approval"), no puede convertir

Posible mejora:
- Permitir cancelar booking confirmado antes de aprobación de staff
- Una vez staff aprueba, NO permitir conversión
```

---

## 📊 Modelo de Datos

### OwnerInvitation Table

```typescript
interface OwnerInvitation {
  id: number;
  token: string; // 64 chars hex único
  email: string;
  first_name?: string;
  last_name?: string;
  created_by_staff_id: number; // FK to users
  property_id: number; // FK to properties
  rooms_data: Array<{
    room_id: number;
    start_date: string; // ISO date
    end_date: string;
    room_type: string;
  }>;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  acceptance_type?: 'booking' | 'credits';
  accepted_at?: Date;
  created_user_id?: number; // FK to users (después de aceptar)
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Booking (de invitación)

```typescript
interface InvitationBooking extends Booking {
  // Campos estándar de Booking
  property_id: number;
  room_id: number;
  guest_name: string; // Nombre del owner
  guest_email: string; // Email del owner
  check_in: Date;
  check_out: Date;
  status: 'pending' | 'pending_approval' | 'confirmed' | 'cancelled';
  
  // Metadata específica de invitación
  raw: {
    source: 'staff_invitation';
    booking_type: 'owner_invitation';
    user_id: number; // ID del owner
    invitation_id: number; // FK a OwnerInvitation
  };
  
  // Pagos
  total_amount: 0; // Sin costo para owner
  payment_status: 'completed'; // Sin pago requerido
}
```

---

## 🚀 Mejoras Recomendadas

### 1. **Validación de Disponibilidad**

**Problema:** Staff puede crear invitación con habitaciones ya reservadas

**Solución:**
```typescript
// En create-owner-invitation endpoint:
for (const roomData of rooms_data) {
  const conflicts = await Booking.findAll({
    where: {
      room_id: roomData.room_id,
      status: { [Op.in]: ['pending', 'confirmed'] },
      [Op.or]: [
        {
          check_in: { [Op.between]: [roomData.start_date, roomData.end_date] }
        },
        {
          check_out: { [Op.between]: [roomData.start_date, roomData.end_date] }
        }
      ]
    }
  });
  
  if (conflicts.length > 0) {
    throw new Error(`Room ${roomData.room_id} is already booked for selected dates`);
  }
}
```

---

### 2. **Preview de Créditos en UI**

**Mejora:** Mostrar a owner cuántos créditos recibirá ANTES de convertir

**Implementación:**
```typescript
// Nuevo endpoint:
GET /staff/invitations/estimate-credits/:bookingId

// Response:
{
  "booking_id": 100,
  "nights": 7,
  "room_type": "suite",
  "season_type": "RED",
  "estimated_credits": 1200,
  "breakdown": {
    "base_value": 800,
    "season_multiplier": 1.3,
    "room_multiplier": 1.5
  }
}
```

**UI en Weeks.tsx:**
```tsx
<button onClick={() => handleEstimateCredits(booking.id)}>
  💳 Convertir a Créditos (~{estimatedCredits || '...'})
</button>
```

---

### 3. **Notificaciones por Email**

**Eventos que deben enviar email:**

1. **Staff crea invitación** → Email a owner
   - ✅ YA IMPLEMENTADO

2. **Owner acepta invitación** → Email a staff
   - ❌ NO IMPLEMENTADO
   - Email: "Juan Pérez ha aceptado tu invitación"

3. **Owner confirma booking** → Email a staff
   - ❌ NO IMPLEMENTADO
   - Email: "Juan Pérez quiere confirmar reserva (pending approval)"

4. **Staff aprueba booking** → Email a owner
   - ❌ NO IMPLEMENTADO
   - Email: "Tu reserva ha sido aprobada ✅"

5. **Owner convierte a créditos** → Email a owner
   - ❌ NO IMPLEMENTADO
   - Email: "Has recibido 1,200 créditos"

---

### 4. **Dashboard de Invitaciones para Staff**

**Pantalla nueva:** `StaffInvitations.tsx`

**Funcionalidad:**
- Lista de invitaciones creadas
- Estados: pending, accepted, expired
- Filtros por property, fecha
- Métricas: tasa de aceptación, créditos vs bookings

**Mock:**
```tsx
<div className="stats-grid">
  <div>
    <h3>Invitaciones Enviadas</h3>
    <p>15</p>
  </div>
  <div>
    <h3>Aceptadas</h3>
    <p>12 (80%)</p>
  </div>
  <div>
    <h3>Como Booking</h3>
    <p>8 (67%)</p>
  </div>
  <div>
    <h3>Como Créditos</h3>
    <p>4 (33%)</p>
  </div>
</div>

<table>
  <tr>
    <td>owner1@example.com</td>
    <td>Accepted - Booking</td>
    <td>2 rooms</td>
    <td>Jan 20, 2026</td>
  </tr>
  <tr>
    <td>owner2@example.com</td>
    <td>Accepted - Credits</td>
    <td>3 rooms → 2,400 credits</td>
    <td>Jan 22, 2026</td>
  </tr>
  <tr>
    <td>owner3@example.com</td>
    <td>Pending</td>
    <td>1 room</td>
    <td>Expires: Feb 5, 2026</td>
  </tr>
</table>
```

---

### 5. **Timeout de Decisión**

**Problema:** Bookings pueden quedar pendientes indefinidamente

**Solución:**
```typescript
// Scheduled job diario:
const expiredInvitationBookings = await Booking.findAll({
  where: {
    status: 'pending',
    'raw.booking_type': 'owner_invitation',
    created_at: { [Op.lt]: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // 14 días
  }
});

for (const booking of expiredInvitationBookings) {
  // Enviar reminder email
  await emailService.sendReminderToDecideInvitation(booking.guest_email);
}

// Si pasan 30 días sin decisión:
const veryExpired = await Booking.findAll({
  where: {
    status: 'pending',
    'raw.booking_type': 'owner_invitation',
    created_at: { [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }
});

for (const booking of veryExpired) {
  // Auto-cancelar
  await booking.update({ status: 'expired' });
}
```

---

## ✅ Checklist de Implementación

### Backend ✅ COMPLETO

- [x] Modelo OwnerInvitation
- [x] POST create-owner-invitation
- [x] GET invitation/:token (validación)
- [x] POST accept-invitation
- [x] POST confirm-booking/:bookingId
- [x] POST approve-booking/:bookingId
- [x] POST convert-booking-to-credits/:bookingId
- [x] Email service para invitaciones
- [x] Cálculo de créditos con CreditCalculationService
- [x] Transacciones de créditos

### Frontend ✅ COMPLETO

- [x] CreateOwnerInvitation.tsx (Staff)
- [x] RegisterWizard.tsx (acepta token)
- [x] Weeks.tsx (muestra bookings de invitación)
- [x] useWeeks hook (mutations)
- [x] API client (timeshare.ts)
- [x] Modales de confirmación

### Pendiente ⚠️

- [ ] Validación de disponibilidad de habitaciones
- [ ] Preview de créditos antes de convertir
- [ ] Emails automáticos (owner acepta, staff aprueba, etc.)
- [ ] Dashboard de invitaciones para staff
- [ ] Timeout/reminder para decisiones pendientes
- [ ] Tests E2E del flujo completo

---

## 🎯 Conclusión

**Estado Actual:** Flujo completo FUNCIONAL ✅

El flujo de invitaciones está 100% implementado en backend y frontend. Owner puede:
1. Recibir invitación por email
2. Registrarse usando el token
3. Ver bookings pendientes
4. Decidir entre confirmar o convertir a créditos
5. Staff aprueba bookings confirmados

**Áreas de Mejora:**
- Validaciones de disponibilidad
- Notificaciones por email más completas
- UI de preview de créditos
- Dashboard de métricas para staff
- Timeouts automáticos

**Recomendación Inmediata:**
Antes de agregar features nuevas, probar el flujo E2E completo con casos reales para validar que todo funciona correctamente.

---

**Documento generado:** 25 de Enero, 2026  
**Versión:** 1.0 - Análisis Completo del Flujo de Invitaciones
