# Pruebas de Integración: Bookings y Pagos desde Marketplace

## Resumen de Cambios

### Backend

#### 1. **Endpoint de Bookings Mejorado** (`/api/dashboard/bookings`)
- ✅ Ahora filtra por `guest_email` cuando el usuario es `guest`
- ✅ Aumentado límite a 100 bookings para guests
- ✅ Incluye información completa de Property (city, country)
- ✅ Retorna campo `bookings` (en lugar de `data`) para consistencia con frontend

#### 2. **Nuevo Endpoint de Pagos** (`/api/client/payments`)
- ✅ Endpoint: `GET /api/client/payments`
- ✅ Requiere autenticación (`authenticateToken`)
- ✅ Filtra bookings por `guest_email` del usuario
- ✅ Solo incluye bookings con `payment_intent_id` (pagos reales)
- ✅ Transforma datos de Booking a formato Payment:
  - `payment_status: 'paid'` → `status: 'completed'`
  - `payment_status: 'failed'` → `status: 'failed'`
  - `payment_status: 'refunded'` → `status: 'refunded'`
  - Otros → `status: 'pending'`
- ✅ Incluye Property name para cada pago

### Frontend

#### 3. **API de Pagos** (`frontend/src/api/payments.ts`)
- ✅ Nueva función: `getPaymentHistory()`
- ✅ Interface `PaymentHistory` exportada
- ✅ Endpoint: `/client/payments`

#### 4. **Página GuestPayments** (`frontend/src/pages/guest/GuestPayments.tsx`)
- ✅ Ahora usa `paymentsApi.getPaymentHistory()` (API real)
- ✅ Eliminado mock data
- ✅ Query key incluye `user?.id` para invalidación correcta
- ✅ Muestra pagos reales de bookings del marketplace

#### 5. **Página GuestBookings** (`frontend/src/pages/guest/GuestBookings.tsx`)
- ✅ Ya estaba usando `bookingsApi.getMyBookings()`
- ✅ Endpoint correcto: `/dashboard/bookings`
- ✅ Backend ahora filtra correctamente por guest_email

## Flujo de Datos

### 1. Usuario hace booking en Marketplace
```
Marketplace Checkout
    ↓
Stripe Payment Intent creado
    ↓
Booking guardado con:
  - guest_email: email del usuario
  - payment_intent_id: ID de Stripe
  - payment_status: 'paid'
  - total_amount: monto pagado
  - currency: 'EUR'
    ↓
Usuario logueado ve sus bookings y pagos
```

### 2. Guest ve sus Bookings
```
GET /api/dashboard/bookings
    ↓
Backend filtra: WHERE guest_email = user.email
    ↓
Frontend recibe lista de bookings
    ↓
GuestBookings muestra todos los bookings del usuario
```

### 3. Guest ve su Historial de Pagos
```
GET /api/client/payments
    ↓
Backend filtra: 
  - WHERE guest_email = user.email
  - AND payment_intent_id IS NOT NULL
    ↓
Frontend recibe payments transformados
    ↓
GuestPayments muestra:
  - Total gastado (EUR)
  - Pagos completados (count)
  - Total transacciones
  - Tabla con cada pago
```

## Pruebas a Realizar

### Preparación
1. ✅ Asegurar que backend esté corriendo
2. ✅ Asegurar que frontend esté corriendo
3. ✅ Tener un usuario guest registrado y logueado

### Caso 1: Usuario Guest sin Bookings
**Pasos:**
1. Login como guest nuevo (sin bookings previos)
2. Ir a "My Bookings"
3. Ir a "Payment History"

**Resultado Esperado:**
- ✅ My Bookings: Muestra estado vacío con link a marketplace
- ✅ Payment History: Muestra estado vacío con link a marketplace

### Caso 2: Usuario Guest con Booking desde Marketplace
**Pasos:**
1. Ir a Marketplace
2. Seleccionar propiedad y fechas
3. Completar formulario de booking
4. Pagar con tarjeta de prueba Stripe: `4242 4242 4242 4242`
5. Esperar confirmación
6. Ir a "My Bookings"
7. Ir a "Payment History"

**Resultado Esperado:**
- ✅ My Bookings: 
  - Lista muestra el nuevo booking
  - Status: "confirmed"
  - Propiedad correcta
  - Fechas correctas
  - Botón "View Details" funcional
  - Botón "Request Service" visible
  
- ✅ Payment History:
  - Total Spent: Muestra monto en EUR
  - Completed Payments: Count = 1
  - Total Transactions: 1
  - Tabla muestra:
    * Fecha del pago
    * Nombre de propiedad
    * Método: "card"
    * Monto en EUR
    * Status: "completed" (badge verde)
    * Botón "Download Receipt"

### Caso 3: Usuario Guest con Múltiples Bookings
**Pasos:**
1. Hacer 3 bookings diferentes desde marketplace
2. Esperar que todos se confirmen
3. Ir a "My Bookings"
4. Probar filtros de status
5. Ir a "Payment History"

**Resultado Esperado:**
- ✅ My Bookings:
  - Lista muestra 3 bookings
  - Filtro "All" muestra todos
  - Filtro "Confirmed" muestra los 3
  - Cada card muestra info correcta
  
- ✅ Payment History:
  - Total Spent: Suma de los 3 pagos
  - Completed Payments: 3
  - Total Transactions: 3
  - Tabla ordenada por fecha (más reciente primero)

### Caso 4: Verificar Filtrado por Usuario
**Pasos:**
1. Crear User A (guest) y hacer 2 bookings
2. Crear User B (guest) y hacer 1 booking
3. Login como User A
4. Ver bookings y pagos
5. Logout y login como User B
6. Ver bookings y pagos

**Resultado Esperado:**
- ✅ User A ve solo sus 2 bookings y 2 pagos
- ✅ User B ve solo su 1 booking y 1 pago
- ✅ No hay "data leakage" entre usuarios

## Campos de Booking Relevantes

```typescript
Booking {
  id: number
  guest_email: string           // ← Usado para filtrar por usuario
  guest_name: string
  property_id: number
  check_in: Date
  check_out: Date
  status: string                // confirmed, checked_in, etc.
  total_amount: number          // ← Mostrado en payments
  currency: string              // ← Mostrado en payments
  payment_intent_id: string     // ← Stripe Payment Intent ID
  payment_status: string        // ← Convertido a status en payments
  created_at: Date              // ← Fecha del pago
  Property: {
    name: string                // ← Mostrado en tabla de pagos
    location: string
    city: string
    country: string
  }
}
```

## Verificación de Errores

### Error 1: "No bookings found" pero sí hay en DB
**Causa:** Backend no está filtrando por guest_email
**Solución:** ✅ Verificar línea 115 en dashboard.routes.ts

### Error 2: "Payment history empty" pero hay bookings
**Causa:** Bookings no tienen payment_intent_id
**Solución:** Verificar que marketplace esté guardando payment_intent_id

### Error 3: Bookings de otros usuarios aparecen
**Causa:** Filtro de guest_email no aplicado correctamente
**Solución:** ✅ Backend debe usar `user.email` del token JWT

## Estados de Pago

| payment_status (DB) | status (Frontend) | Badge Color | Icono |
|---------------------|-------------------|-------------|-------|
| paid                | completed         | Verde       | ✓     |
| pending             | pending           | Amarillo    | ⏱     |
| processing          | pending           | Amarillo    | ⏱     |
| failed              | failed            | Rojo        | ✗     |
| refunded            | refunded          | Azul        | ✓     |

## Endpoints Actualizados

```typescript
// Backend
GET /api/dashboard/bookings
- Headers: Authorization: Bearer <token>
- Query: ?status=confirmed&limit=100
- Response: { success: true, bookings: [...], count: 3 }

GET /api/client/payments
- Headers: Authorization: Bearer <token>
- Response: { success: true, payments: [...] }

// Frontend
import { bookingsApi } from '@/api/bookings';
import { paymentsApi } from '@/api/payments';

bookingsApi.getMyBookings()
paymentsApi.getPaymentHistory()
```

## Conclusión

✅ **Backend:**
- Endpoint de bookings filtra correctamente por guest_email
- Nuevo endpoint de payments retorna historial completo
- Ambos endpoints protegidos con autenticación

✅ **Frontend:**
- GuestBookings usa API real de bookings
- GuestPayments usa API real de payments
- Ambas páginas muestran datos reales del marketplace

🎉 **Integración Completa:** Los bookings hechos desde marketplace aparecen correctamente en las páginas de Guest con toda la información de pago.
