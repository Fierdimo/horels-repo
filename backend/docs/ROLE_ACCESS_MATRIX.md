# Matriz de Acceso por Rol

## Roles en el Sistema

1. **admin** - Administrador de la plataforma
2. **staff** - Personal del hotel (anteriormente hotel-staff)
3. **owner** - Propietarios de semanas (timeshare)
4. **guest** - Huéspedes del hotel

## Funcionalidades por Rol

### ADMIN (Administrador)
**Acceso Global - Gestión de la plataforma**

#### Property Management (CRUD Properties)
- ✅ GET /hotels/properties - Ver todas las properties
- ✅ GET /hotels/properties/:id - Ver detalles de cualquier property
- ✅ POST /hotels/properties - Crear nueva property
- ✅ PUT /hotels/properties/:id - Actualizar property
- ✅ DELETE /hotels/properties/:id - Eliminar property
- ✅ POST /hotels/properties/:id/pms/test - Probar conexión PMS
- ✅ PUT /hotels/properties/:id/pms/sync - Sincronizar PMS
- ✅ GET /hotels/properties/:id/pms/logs - Ver logs de sync
- ✅ GET /hotels/properties/:id/availability - Ver disponibilidad

#### Dashboard (Vista global)
- ✅ GET /hotels/dashboard/stats - Estadísticas de todas las properties
- ✅ GET /hotels/dashboard/bookings - Bookings de todas las properties
- ✅ GET /hotels/dashboard/weeks - Weeks de todas las properties
- ✅ GET /hotels/dashboard/services - Servicios de todas las properties

#### User Management
- ✅ GET /hotels/admin/logs - Ver logs de sistema
- ✅ GET /hotels/admin/logs/stats - Estadísticas de logs
- ✅ DELETE /hotels/admin/users/:userId - Eliminar usuarios
- ✅ GET /hotels/admin/staff-requests - Ver solicitudes de staff
- ✅ POST /hotels/admin/staff-requests/:userId - Aprobar/rechazar staff

### STAFF (Personal del Hotel)
**Acceso restringido a su property_id**

#### Operational Dashboard
- ✅ GET /hotels/dashboard/stats - Estadísticas de SU property solamente
- ✅ GET /hotels/dashboard/bookings - Bookings de SU property
- ✅ GET /hotels/dashboard/weeks - Weeks de SU property
- ✅ GET /hotels/dashboard/services - Servicios de SU property

#### Property Management (Limited to own property)
- ✅ GET /hotels/properties - Ver solo SU property
- ✅ GET /hotels/properties/:id - Ver solo si :id = su property_id
- ✅ PUT /hotels/properties/:id - Editar SU property (contacto, horarios, amenidades, etc.)
- ✅ GET /hotels/properties/:id/availability - Ver disponibilidad de SU property
- ❌ POST /hotels/properties - NO puede crear nuevas properties
- ❌ DELETE /hotels/properties/:id - NO puede eliminar properties

#### Hotel Services Management
- ✅ GET /hotels/staff/services - Ver servicios de SU property
- ✅ PATCH /hotels/staff/services/:id/status - Actualizar estado de servicios
- ✅ GET /hotels/staff/services/history - Historial de servicios

#### PMS Operations
- ✅ POST /hotels/properties/:id/pms/test - Puede probar credenciales PMS de SU property
- ✅ PUT /hotels/properties/:id/pms/sync - Puede sincronizar SU property
- ✅ GET /hotels/properties/:id/pms/logs - Ver logs de SU property

### OWNER (Propietario de Semanas)
**Gestión de timeshare - Sus propias semanas**

#### Property Discovery (Público)
- ✅ GET /hotels/public/properties - Ver todas las properties con timeshare
- ✅ GET /hotels/public/properties/:id - Ver detalles de property
- ✅ GET /hotels/public/weeks/available - Ver weeks disponibles para swap (solo owners)

#### Week Management
- ✅ GET /hotels/timeshare/weeks - Ver SUS semanas
- ✅ POST /hotels/timeshare/weeks/:weekId/confirm - Confirmar su semana
- ❌ No puede ver semanas de otros owners

#### Swap Management
- ✅ GET /hotels/timeshare/swaps - Ver SUS swap requests
- ✅ POST /hotels/timeshare/swaps - Crear swap request
- ✅ POST /hotels/timeshare/swaps/:swapId/authorize - Autorizar swap
- ❌ Solo puede hacer swaps con sus propias semanas

#### Night Credits
- ✅ GET /hotels/timeshare/night-credits - Ver SUS night credits
- ✅ POST /hotels/timeshare/weeks/:weekId/convert - Convertir SU semana a créditos
- ✅ POST /hotels/timeshare/night-credits/:creditId/use - Usar SUS créditos
- ❌ No puede ver créditos de otros

#### Conversion
- ✅ GET /hotels/conversion/matching-swaps/:propertyId - Buscar swaps disponibles
- ✅ POST /hotels/conversion/complete-swap - Completar swap
- ✅ GET /hotels/conversion/swap-fee - Ver tarifa de swap

### GUEST (Huésped)
**Experiencia de huésped - Bookings y servicios**

#### Property Discovery (Público)
- ✅ GET /hotels/public/properties - Ver todas las properties activas y verificadas
- ✅ GET /hotels/public/properties/:id - Ver detalles de property específica
- ✅ GET /hotels/public/properties/:id/availability - Consultar disponibilidad
- ✅ GET /hotels/public/cities - Ver lista de ciudades con hoteles disponibles

#### Booking Management (Autenticado como guest)
- ✅ POST /hotels/pms/bookings - Crear nueva reserva (requiere permisos create_booking)
- ✅ GET /hotels/pms/bookings/:bookingId - Ver sus propios bookings
- ✅ PUT /hotels/pms/bookings/:bookingId - Modificar su booking
- ✅ DELETE /hotels/pms/bookings/:bookingId - Cancelar su booking

#### Booking Access (Token-based)
- ✅ GET /hotels/guest/booking/:token - Ver SU booking por token
- ❌ No puede ver bookings de otros

#### Hotel Services
- ✅ POST /hotels/guest/services - Solicitar servicios del hotel
- ✅ GET /hotels/guest/services/:token - Ver servicios de SU booking
- ❌ Solo puede solicitar servicios para su booking

#### Content
- ✅ GET /hotels/guest/nearby/:token - Ver contenido cercano al hotel

## Endpoints de Autenticación (Público)

- ✅ POST /hotels/auth/register - Registro de nuevos usuarios
- ✅ POST /hotels/auth/login - Login
- ✅ GET /hotels/auth/me - Ver perfil propio (autenticado)
- ✅ DELETE /hotels/auth/me - Eliminar propia cuenta

## Endpoints Públicos (Sin Autenticación)

- ✅ GET /hotels/health - Health check
- ✅ GET /hotels/public/properties - Listado de properties activas y verificadas
- ✅ GET /hotels/public/properties/:id - Detalles de property específica  
- ✅ GET /hotels/public/properties/:id/availability - Consultar disponibilidad
- ✅ GET /hotels/public/cities - Lista de ciudades con hoteles disponibles
- ✅ GET /hotels/properties/names - Listado de nombres de properties (legacy)

## Notas de Implementación

### Property Access Middleware
- `validatePropertyAccess`: Valida que staff solo acceda a su property_id
- `addPropertyFilter`: Agrega filtro automático por property_id para staff en queries

### Cambios Necesarios
1. ✅ Cambiar "hotel-staff" a "staff" en todos los middlewares
2. ⚠️ Agregar validación de property_id en endpoints de staff
3. ⚠️ Verificar que dashboard solo muestre datos de la property del staff
4. ⚠️ Separar endpoints de PMS test (admin only) vs sync (staff allowed)
5. ⚠️ Documentar permisos en API_DOCUMENTATION.md
