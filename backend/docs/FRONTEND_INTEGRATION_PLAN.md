# Plan de Integración Frontend-Backend

## 📊 Estado Actual del Frontend

### ✅ Implementado
1. **Autenticación**: Login, Register, PendingApproval
2. **Roles**: Owner, Guest, Staff, Admin
3. **Owner Features**: Dashboard, Weeks, Swaps, Credits (timeshare)
4. **Guest Features**: BookingAccess (token-based), Dashboard, GuestInfo
5. **Staff Features**: Dashboard, History, Availability, Profile
6. **Admin Features**: Dashboard, Rooms (básico)
7. **Infraestructura**: React Query, Stripe Elements, i18n, Tailwind

### ❌ NO Implementado (Necesario para Marketplace)
1. **Marketplace Público**: Vista de hoteles y habitaciones sin auth
2. **Búsqueda de Properties**: Filtros por ciudad, país, estrellas
3. **Vista de Habitaciones**: Lista con precios y disponibilidad
4. **Sistema de Booking**: Crear reservas y pagar
5. **Panel de Comisiones**: Admin configura % de comisión
6. **Staff Room Management**: CRUD de habitaciones, activación marketplace
7. **Pricing Display**: Mostrar precio hotel vs precio guest

## 🔧 Cambios Necesarios

### 1. API Client - Ajustar Base URL ✅
**Archivo**: `src/api/client.ts`
**Cambio**: El backend usa `/hotels` como prefijo

```typescript
// ACTUAL
baseURL: API_URL  // http://localhost:3000

// NECESARIO  
baseURL: `${API_URL}/hotels`  // http://localhost:3000/hotels
```

### 2. Crear API de Marketplace (NUEVO)
**Archivo**: `src/api/marketplace.ts` (crear)

```typescript
export const marketplaceApi = {
  // Público (sin auth)
  getProperties: (filters?) => GET /public/properties
  getProperty: (id) => GET /public/properties/:id
  getPropertyRooms: (id, filters?) => GET /public/properties/:id/rooms
  getRoomDetails: (propertyId, roomId) => GET /public/properties/:propertyId/rooms/:roomId
  checkAvailability: (id, dates) => GET /public/properties/:id/availability
  
  // Autenticado (guest)
  createBooking: (data) => POST /bookings
  getMyBookings: () => GET /bookings/my
}
```

### 3. Crear API de Staff Rooms (NUEVO)
**Archivo**: `src/api/staff-rooms.ts` (crear)

```typescript
export const staffRoomsApi = {
  // Staff/Admin autenticado
  listRooms: (propertyId?) => GET /hotel-staff/rooms?propertyId=X
  createRoom: (data) => POST /hotel-staff/rooms
  updateRoom: (id, data) => PUT /hotel-staff/rooms/:id
  deleteRoom: (id) => DELETE /hotel-staff/rooms/:id
  toggleMarketplace: (id, enabled) => PATCH /hotel-staff/rooms/:id/marketplace
  importFromPMS: (propertyId?) => POST /hotel-staff/rooms/import-from-pms
}
```

### 4. Crear API de Admin Settings (NUEVO)
**Archivo**: `src/api/admin-settings.ts` (crear)

```typescript
export const adminSettingsApi = {
  // Admin autenticado
  getCommissionRate: () => GET /admin/settings/commission
  updateCommissionRate: (rate) => PATCH /admin/settings/commission
}
```

### 5. Actualizar Rutas (App.tsx)
**Archivo**: `src/App.tsx`

Agregar:
```tsx
// NUEVAS RUTAS PÚBLICAS
<Route path="/marketplace" element={<MarketplacePage />} />
<Route path="/marketplace/properties/:id" element={<PropertyDetailPage />} />
<Route path="/marketplace/properties/:id/rooms/:roomId" element={<RoomDetailPage />} />

// NUEVAS RUTAS STAFF
<Route path="/staff/rooms" element={<StaffRoomManagement />} />

// NUEVAS RUTAS ADMIN
<Route path="/admin/settings" element={<AdminSettings />} />
<Route path="/admin/commission" element={<CommissionSettings />} />
```

### 6. Crear Páginas Nuevas

#### A. Marketplace Público (sin auth)
**Archivos a crear**:
- `src/pages/marketplace/Marketplace.tsx` - Lista de properties
- `src/pages/marketplace/PropertyDetail.tsx` - Detalle de property + rooms
- `src/pages/marketplace/RoomDetail.tsx` - Detalle de habitación + booking

**Features**:
- Búsqueda y filtros (ciudad, país, precio, tipo)
- Cards de properties con estrellas, amenities, imágenes
- Grid de habitaciones con precios (mostrar guestPrice)
- Calendarios de disponibilidad
- Botón "Reservar" → redirige a login/register si no auth

#### B. Staff Room Management
**Archivo**: `src/pages/staff/RoomManagement.tsx` (mejorar existente)

**Features actuales**:
- ✅ Lista de habitaciones
- ✅ Crear/Editar/Eliminar

**Features a AGREGAR**:
- Toggle "Activar en Marketplace" por habitación
- Mostrar estado: Marketplace Enabled/Disabled
- Campo customPrice (precio personalizado)
- Campo pmsResourceId (ID en PMS)
- Botón "Importar desde PMS"
- Mostrar hotelPrice vs guestPrice calculado
- Preview de cómo se ve en marketplace

#### C. Admin Commission Settings
**Archivo**: `src/pages/admin/CommissionSettings.tsx` (NUEVO)

**Features**:
- Input para % de comisión (0-50%)
- Ejemplo visual: Hotel $100 → Guest $X
- Cálculo en tiempo real al cambiar %
- Historial de cambios de comisión
- Guardar cambios (solo admin)

#### D. Guest Booking Flow
**Archivos**:
- `src/pages/guest/BookingPage.tsx` (NUEVO)
- `src/pages/guest/BookingConfirmation.tsx` (NUEVO)
- `src/pages/guest/BookingPayment.tsx` (NUEVO)

**Features**:
- Formulario de booking (fechas, guests)
- Resumen de pricing:
  ```
  Precio hotel: $89.00 x 3 noches = $267.00
  Comisión plataforma (12%): $32.04
  ─────────────────────────────────────
  Total a pagar: $299.04
  ```
- Integración con Stripe Elements
- Confirmación y recibo

### 7. Componentes Reutilizables

#### A. PropertyCard
**Archivo**: `src/components/marketplace/PropertyCard.tsx` (NUEVO)

```tsx
interface PropertyCardProps {
  id: number;
  name: string;
  city: string;
  country: string;
  stars: number;
  image: string;
  description: string;
  amenities: string[];
  onClick: () => void;
}
```

#### B. RoomCard
**Archivo**: `src/components/marketplace/RoomCard.tsx` (NUEVO)

```tsx
interface RoomCardProps {
  id: number;
  name: string;
  type: string;
  capacity: number;
  hotelPrice: number;      // No mostrar al guest
  guestPrice: number;      // Precio que ve el guest
  commissionRate: number;  // Opcional, para transparency
  amenities: string[];
  images: string[];
  available: boolean;
  onBook: () => void;
}
```

#### C. PricingBreakdown
**Archivo**: `src/components/booking/PricingBreakdown.tsx` (NUEVO)

```tsx
interface PricingBreakdownProps {
  hotelPrice: number;
  guestPrice: number;
  commission: number;
  commissionRate: number;
  nights: number;
  showHotelPrice?: boolean; // false para guests, true para admin/staff
}
```

#### D. CommissionRateInput
**Archivo**: `src/components/admin/CommissionRateInput.tsx` (NUEVO)

```tsx
interface CommissionRateInputProps {
  value: number;
  onChange: (rate: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}
```

### 8. Tipos TypeScript

#### Actualizar `src/types/models.ts`
```typescript
// Agregar:
export interface Property {
  id: number;
  name: string;
  location: string;
  city: string;
  country: string;
  description: string;
  amenities: string[];
  stars: number;
  images: string[];
  pms_provider?: string;
  check_in_time?: string;
  check_out_time?: string;
  timezone?: string;
  languages?: string[];
}

export interface Room {
  id: number;
  propertyId: number;
  name: string;
  description?: string;
  type?: string;
  capacity: number;
  floor?: string;
  status: string;
  amenities: string[];
  basePrice: number;
  customPrice?: number;
  pmsResourceId?: string;
  isMarketplaceEnabled: boolean;
  images: string[];
  // Precios calculados (desde backend)
  hotelPrice: number;
  guestPrice: number;
  platformCommission: number;
  commissionRate: number;
}

export interface Booking {
  id: number;
  propertyId: number;
  roomId: number;
  guestUserId: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  hotelPricePerNight: number;
  guestPricePerNight: number;
  commissionPerNight: number;
  totalGuestAmount: number;
  totalHotelPayout: number;
  totalPlatformCommission: number;
  commissionRate: number;
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionSettings {
  commissionRate: number;
  description: string;
  example: {
    hotelPrice: number;
    guestPrice: number;
    commission: number;
  };
}
```

### 9. Hooks Personalizados

#### A. useMarketplace
**Archivo**: `src/hooks/useMarketplace.ts` (NUEVO)

```typescript
export function useMarketplace(filters?) {
  return useQuery({
    queryKey: ['marketplace', 'properties', filters],
    queryFn: () => marketplaceApi.getProperties(filters)
  });
}

export function useProperty(id: number) {
  return useQuery({
    queryKey: ['marketplace', 'property', id],
    queryFn: () => marketplaceApi.getProperty(id)
  });
}

export function usePropertyRooms(propertyId: number, filters?) {
  return useQuery({
    queryKey: ['marketplace', 'rooms', propertyId, filters],
    queryFn: () => marketplaceApi.getPropertyRooms(propertyId, filters)
  });
}
```

#### B. useCommissionSettings
**Archivo**: `src/hooks/useCommissionSettings.ts` (NUEVO)

```typescript
export function useCommissionSettings() {
  return useQuery({
    queryKey: ['admin', 'commission'],
    queryFn: adminSettingsApi.getCommissionRate,
    // Solo fetch si user es admin
    enabled: useAuth().user?.role === 'admin'
  });
}

export function useUpdateCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminSettingsApi.updateCommissionRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission'] });
    }
  });
}
```

## 📋 Prioridades de Implementación

### Fase 1: Backend API Integration (Inmediato)
1. ✅ Ajustar baseURL en client.ts
2. ✅ Crear marketplace.ts API
3. ✅ Crear staff-rooms.ts API
4. ✅ Crear admin-settings.ts API
5. ✅ Actualizar types/models.ts

### Fase 2: Páginas Públicas (Alta Prioridad)
1. ✅ Marketplace.tsx - Lista de properties
2. ✅ PropertyDetail.tsx - Detalle + rooms
3. ✅ RoomDetail.tsx - Detalle habitación
4. ✅ Componentes: PropertyCard, RoomCard

### Fase 3: Staff Features (Alta Prioridad)
1. ✅ Mejorar RoomManagement.tsx
2. ✅ Toggle marketplace enabled
3. ✅ Importar desde PMS
4. ✅ Mostrar pricing calculado

### Fase 4: Admin Features (Media Prioridad)
1. ✅ CommissionSettings.tsx
2. ✅ Componente CommissionRateInput
3. ✅ Validación solo admin

### Fase 5: Booking Flow (Alta Prioridad - después de Stripe)
1. ⏳ BookingPage.tsx
2. ⏳ BookingPayment.tsx (Stripe Elements)
3. ⏳ BookingConfirmation.tsx
4. ⏳ Componente PricingBreakdown

### Fase 6: Testing & Polish (Baja Prioridad)
1. ⏳ Tests unitarios
2. ⏳ Tests E2E
3. ⏳ Responsive design
4. ⏳ Accesibilidad

## 🔍 Diferencias con Lógica Actual

### ❌ Eliminar/Deprecar:
- **Timeshare Weeks**: El foco ahora es marketplace de habitaciones directas
- **Swaps entre Owners**: Ya no aplica para este modelo de negocio
- **Night Credits**: Reemplazado por bookings directos

### ✅ Mantener:
- **Guest Token Access**: Sigue siendo útil para acceso a bookings
- **Staff Dashboard**: Útil para gestión de servicios
- **Admin Users**: Necesario para gestión de plataforma

### 🔄 Adaptar:
- **Owner Role** → Puede eliminarse o convertirse en "Hotel Manager"
- **Rooms Admin** → Expandir a Staff Room Management
- **Dashboard Stats** → Agregar métricas de marketplace (bookings, revenue, comisiones)

## 📦 Dependencias Adicionales

No se requieren nuevas dependencias. Ya tienes:
- ✅ React Query
- ✅ Stripe Elements
- ✅ Axios
- ✅ React Router
- ✅ Tailwind CSS
- ✅ i18n

## 🎨 Consideraciones de UX

1. **Marketplace debe ser accesible sin login** para atraer guests
2. **Precios transparentes**: Mostrar solo guestPrice a guests
3. **Staff ve ambos precios**: hotelPrice y cómo se calcula guestPrice
4. **Admin ve todo**: comisión, breakdown completo
5. **Mobile-first**: Cards responsivas para properties/rooms
6. **Loading states**: Skeletons mientras cargan datos
7. **Error handling**: Mensajes claros si falla API

## 🚀 Siguiente Paso Recomendado

**Empezar por Fase 1**: Ajustar las APIs para que el frontend pueda consumir los endpoints que ya funcionan en el backend. Esto desbloqueará todo lo demás.

**Comandos para empezar:**
```bash
cd sw2-frontend
npm install
npm run dev
```

Luego hacer los cambios en:
1. `src/api/client.ts` (baseURL)
2. Crear `src/api/marketplace.ts`
3. Crear `src/api/staff-rooms.ts`
4. Crear `src/api/admin-settings.ts`
5. Actualizar `src/types/models.ts`
