# Mock PMS System - Guía de Uso

## Descripción

El **Mock PMS** es un sistema de Property Management System (PMS) simulado que reemplaza MEWS para desarrollo y pruebas. Incluye múltiples propiedades hoteleras en España con habitaciones reservables y gestión completa de reservas.

## 🏨 Propiedades Disponibles

El sistema incluye 4 propiedades hoteleras completamente configuradas:

### 1. Hotel Emperador Madrid
- **ID**: `MOCK-PROP-001`
- **Ubicación**: Gran Vía 53, Madrid
- **Habitaciones**: 33 totales
  - 20x Standard Double Room (€150/noche)
  - 10x Deluxe Suite (€280/noche)
  - 3x Presidential Suite (€550/noche)
- **Amenidades**: WiFi, Rooftop Pool, Spa, Fine Dining, Bar, Fitness Center

### 2. Barcelona Princess
- **ID**: `MOCK-PROP-002`
- **Ubicación**: Avinguda Diagonal 1, Barcelona
- **Habitaciones**: 33 totales
  - 25x Sea View Room (€180/noche)
  - 8x Family Suite (€320/noche)
- **Amenidades**: WiFi, Beach Access, Infinity Pool, Beach Club, Restaurant

### 3. Alfonso XIII Sevilla
- **ID**: `MOCK-PROP-003`
- **Ubicación**: Calle San Fernando 2, Sevilla
- **Habitaciones**: 20 totales
  - 15x Classic Room (€200/noche)
  - 5x Royal Suite (€480/noche)
- **Amenidades**: WiFi, Garden Pool, Courtyard Gardens, Fine Dining, Spa

### 4. Maria Cristina San Sebastian
- **ID**: `MOCK-PROP-004`
- **Ubicación**: Paseo República Argentina 4, San Sebastián
- **Habitaciones**: 20 totales
  - 18x Superior River View (€220/noche)
  - 2x Presidential Suite (€650/noche)
- **Amenidades**: WiFi, Michelin Star Restaurant, Spa, River Views, Bar

**Total**: 106 habitaciones disponibles en 4 propiedades

## 📡 API Endpoints

### Obtener todas las propiedades
```bash
GET /api/mock-pms/properties
```

**Respuesta**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "MOCK-PROP-001",
      "name": "Hotel Emperador Madrid",
      "address": "Gran Vía 53",
      "city": "Madrid",
      "country": "Spain",
      "timezone": "Europe/Madrid",
      "description": "Luxury 5-star hotel...",
      "images": ["url1", "url2"],
      "amenities": ["WiFi", "Pool", ...],
      "checkInTime": "15:00",
      "checkOutTime": "12:00",
      "phone": "+34 915 478 800",
      "email": "reservas@emperadormadrid.com"
    }
  ]
}
```

### Obtener detalles de una propiedad con tipos de habitación
```bash
GET /api/mock-pms/properties/:propertyId
```

**Ejemplo**:
```bash
GET /api/mock-pms/properties/MOCK-PROP-001
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "MOCK-PROP-001",
    "name": "Hotel Emperador Madrid",
    "...": "...",
    "roomTypes": [
      {
        "id": "MOCK-ROOM-001-1",
        "propertyId": "MOCK-PROP-001",
        "name": "Standard Double Room",
        "description": "Elegant 25m² room...",
        "capacity": 2,
        "basePrice": 150,
        "images": ["url"],
        "amenities": ["King Bed", "City View", ...],
        "quantity": 20
      }
    ]
  }
}
```

### Obtener tipos de habitación de una propiedad
```bash
GET /api/mock-pms/properties/:propertyId/rooms
```

**Ejemplo**:
```bash
GET /api/mock-pms/properties/MOCK-PROP-002/rooms
```

### Obtener todas las reservas
```bash
GET /api/mock-pms/bookings
Authorization: Bearer <token>
```

**Query Parameters**:
- `propertyId` (opcional): Filtrar por propiedad específica

**Ejemplo**:
```bash
GET /api/mock-pms/bookings?propertyId=MOCK-PROP-001
```

### Obtener detalles de una reserva
```bash
GET /api/mock-pms/bookings/:bookingId
Authorization: Bearer <token>
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "id": "MOCK-BKG-1234567890-ABC123",
    "propertyId": "MOCK-PROP-001",
    "roomTypeId": "MOCK-ROOM-001-1",
    "roomNumber": "305",
    "confirmationCode": "CONF-AB12CD",
    "status": "CONFIRMED",
    "checkIn": "2026-03-15T00:00:00.000Z",
    "checkOut": "2026-03-20T00:00:00.000Z",
    "guest": {
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan@example.com",
      "phone": "+34 600 000 000"
    },
    "numberOfGuests": 2,
    "specialRequests": "Late check-in",
    "createdAt": "2026-02-01T10:00:00.000Z",
    "updatedAt": "2026-02-01T10:00:00.000Z"
  }
}
```

### Obtener estadísticas del Mock PMS
```bash
GET /api/mock-pms/stats
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "properties": 4,
    "roomTypes": 10,
    "totalRooms": 106,
    "totalBookings": 15,
    "activeBookings": 12,
    "cancelledBookings": 3
  }
}
```

### Limpiar todas las reservas (Admin)
```bash
DELETE /api/mock-pms/bookings
Authorization: Bearer <admin-token>
```

**Respuesta**:
```json
{
  "success": true,
  "message": "All mock bookings cleared"
}
```

## 🔧 Uso con PMSAdapter

### Configurar propiedad para usar Mock PMS

```typescript
import TimeshareProperty from './models/v2/TimeshareProperty';

// Crear propiedad con Mock PMS
const property = await TimeshareProperty.create({
  name: 'Mi Hotel de Prueba',
  pms_provider: 'other', // 'other' usa el Mock PMS
  pms_property_id: 'MOCK-PROP-001', // ID de la propiedad mock
  timezone: 'Europe/Madrid',
  // ... otros campos
});
```

### Crear reserva a través del adapter

```typescript
import { PMSFactory } from './services/pms/PMSFactory';

// Obtener adapter para la propiedad
const adapter = await PMSFactory.getAdapter(propertyId);

// Crear reserva
const result = await adapter.createBooking({
  checkIn: new Date('2026-03-15'),
  checkOut: new Date('2026-03-20'),
  guest: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@example.com',
    phone: '+34 600 000 000'
  },
  numberOfGuests: 2,
  roomCategory: 'Standard', // Se busca por nombre similar
  specialRequests: 'Late check-in requested',
  internalBookingId: 123,
  internalConfirmationCode: 'INT-ABC123'
});

console.log(result);
// {
//   success: true,
//   pmsBookingId: 'MOCK-BKG-...',
//   pmsConfirmationCode: 'CONF-...',
//   status: 'CONFIRMED',
//   roomAssigned: '305',
//   checkInTime: '15:00',
//   checkOutTime: '12:00',
//   message: 'Booking confirmed at Standard Double Room'
// }
```

### Verificar disponibilidad

```typescript
const availability = await adapter.getAvailability({
  checkIn: new Date('2026-03-15'),
  checkOut: new Date('2026-03-20')
});

console.log(availability);
// [
//   {
//     roomCategory: 'Standard Double Room',
//     roomCategoryId: 'MOCK-ROOM-001-1',
//     available: true,
//     availableCount: 18, // 20 total - 2 reservadas
//     price: 150,
//     currency: 'EUR'
//   },
//   ...
// ]
```

### Cancelar reserva

```typescript
const cancellation = await adapter.cancelBooking({
  pmsBookingId: 'MOCK-BKG-1234567890-ABC123',
  reason: 'Guest request'
});

console.log(cancellation);
// {
//   success: true,
//   pmsBookingId: 'MOCK-BKG-...',
//   status: 'CANCELLED',
//   message: 'Booking cancelled successfully'
// }
```

### Consultar estado de reserva

```typescript
const status = await adapter.getBookingStatus('MOCK-BKG-1234567890-ABC123');

console.log(status);
// {
//   pmsBookingId: 'MOCK-BKG-...',
//   status: 'CONFIRMED',
//   checkIn: Date,
//   checkOut: Date,
//   roomAssigned: '305',
//   guest: { firstName: 'Juan', ... }
// }
```

## 🎯 Casos de Uso

### 1. Testing de flujo de reservas

```typescript
// Test completo de flujo de reserva
describe('Booking Flow', () => {
  it('should create, check, and cancel booking', async () => {
    const adapter = await PMSFactory.getAdapter(propertyId);
    
    // 1. Verificar disponibilidad
    const availability = await adapter.getAvailability({
      checkIn: new Date('2026-03-15'),
      checkOut: new Date('2026-03-20')
    });
    expect(availability.length).toBeGreaterThan(0);
    
    // 2. Crear reserva
    const booking = await adapter.createBooking({
      checkIn: new Date('2026-03-15'),
      checkOut: new Date('2026-03-20'),
      guest: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
      numberOfGuests: 2,
      roomCategory: 'Standard',
      internalBookingId: 1,
      internalConfirmationCode: 'TEST-001'
    });
    expect(booking.success).toBe(true);
    
    // 3. Verificar estado
    const status = await adapter.getBookingStatus(booking.pmsBookingId);
    expect(status.status).toBe('CONFIRMED');
    
    // 4. Cancelar
    const cancellation = await adapter.cancelBooking({
      pmsBookingId: booking.pmsBookingId
    });
    expect(cancellation.success).toBe(true);
  });
});
```

### 2. Desarrollo de frontend sin backend real

```typescript
// En desarrollo, el frontend puede usar las APIs del Mock PMS
// para mostrar propiedades y habitaciones reales

// Listar propiedades disponibles
fetch('/api/mock-pms/properties')
  .then(res => res.json())
  .then(data => {
    console.log(`${data.count} properties available`);
    // Mostrar en UI
  });

// Ver detalles de propiedad específica
fetch('/api/mock-pms/properties/MOCK-PROP-001')
  .then(res => res.json())
  .then(data => {
    console.log(data.data.name);
    console.log(`${data.data.roomTypes.length} room types`);
    // Mostrar galería de imágenes, amenidades, etc.
  });
```

### 3. Demostración del sistema

El Mock PMS permite hacer demos sin necesidad de conectar con MEWS real:

1. Mostrar 4 propiedades hoteleras reales
2. Ver tipos de habitación con precios
3. Crear reservas de prueba
4. Ver panel de reservas activas
5. Cancelar reservas

## 🔄 Gestión de Estado

El Mock PMS mantiene el estado de las reservas en memoria:

- ✅ Las reservas persisten durante la ejecución del servidor
- ✅ El control de disponibilidad es real (máx habitaciones - reservas activas)
- ✅ Las cancelaciones actualizan el estado correctamente
- ❌ Los datos se pierden al reiniciar el servidor (no persistente en BD)

Para desarrollo persistente, se puede integrar con la base de datos V2.

## 🚀 Ventajas del Mock PMS

1. **Sin dependencias externas**: No requiere credenciales de MEWS
2. **Datos realistas**: 4 hoteles reales con 106 habitaciones
3. **Disponibilidad real**: Control de inventario funcional
4. **Rápido**: Sin latencia de APIs externas
5. **Predecible**: Datos consistentes para testing
6. **Configurable**: Fácil agregar más propiedades
7. **Gratuito**: Sin costos de APIs de terceros

## 📝 Notas de Implementación

### Almacenamiento en Memoria

El Mock PMS usa un patrón Singleton para mantener el estado:

```typescript
class MockPMSDatabase {
  private static instance: MockPMSDatabase;
  
  properties: Map<string, MockProperty> = new Map();
  roomTypes: Map<string, MockRoomType> = new Map();
  bookings: Map<string, MockBooking> = new Map();
  
  static getInstance(): MockPMSDatabase {
    if (!MockPMSDatabase.instance) {
      MockPMSDatabase.instance = new MockPMSDatabase();
    }
    return MockPMSDatabase.instance;
  }
}
```

Todos los adapters comparten la misma instancia de la base de datos.

### Control de Disponibilidad

La disponibilidad se calcula en tiempo real:

```typescript
getAvailableRoomCount(roomTypeId: string, checkIn: Date, checkOut: Date): number {
  const roomType = this.roomTypes.get(roomTypeId);
  if (!roomType) return 0;

  // Contar reservas que se solapan con las fechas solicitadas
  const overlappingBookings = this.getBookingsForRoom(roomTypeId, checkIn, checkOut);
  
  // Disponibles = Total - Reservadas
  return Math.max(0, roomType.quantity - overlappingBookings.length);
}
```

### Búsqueda de Habitaciones

Al crear una reserva, se busca por nombre similar:

```typescript
const availableRoomType = roomTypes.find(rt => 
  rt.name.toLowerCase().includes(request.roomCategory.toLowerCase()) &&
  this.db.isRoomAvailable(rt.id, request.checkIn, request.checkOut)
);
```

Esto permite flexibilidad: "Standard", "standard room", "Standard Double" todos funcionan.

## 🔮 Futura Integración

Cuando esté listo para conectar con MEWS real:

1. Configurar `pms_provider: 'mews'` en la propiedad
2. Agregar credenciales MEWS encriptadas en `pms_credentials`
3. El sistema cambiará automáticamente de Mock a MEWS
4. El resto del código permanece igual (usa PMSAdapter interface)

```typescript
// Cambiar de Mock a MEWS es transparente
const adapter = await PMSFactory.getAdapter(propertyId);
// adapter puede ser MockPMSAdapter o MewsAdapter
// pero la interfaz es la misma

await adapter.createBooking(request); // Funciona con ambos
```

## 📊 Monitoreo

Ver estadísticas del Mock PMS:

```bash
curl http://localhost:3000/api/mock-pms/stats
```

Esto muestra:
- Número de propiedades
- Tipos de habitación totales
- Habitaciones totales
- Reservas totales
- Reservas activas vs canceladas

## ✅ Checklist de Integración

- [x] MockPMSService.ts creado con 4 propiedades
- [x] 10 tipos de habitaciones configuradas
- [x] 106 habitaciones totales disponibles
- [x] Control de disponibilidad implementado
- [x] API endpoints creados
- [x] Integración con PMSFactory
- [x] Routes registradas en app.ts
- [x] Documentación completa

¡El Mock PMS está listo para usar! 🎉
