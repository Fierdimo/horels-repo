# Sistema Unificado de Créditos - Plan de Implementación Técnica

**Fecha:** 25 de Enero, 2026  
**Objetivo:** Implementar sistema simplificado donde TODO se convierte en créditos  
**Duración Estimada:** 8-10 semanas

---

## 📋 Tabla de Contenidos

1. [Arquitectura del Nuevo Sistema](#arquitectura)
2. [Componentes Backend](#backend)
3. [Componentes Frontend](#frontend)
4. [APIs Necesarias](#apis)
5. [Modelos de Datos](#modelos)
6. [Flujos de Usuario](#flujos)
7. [Plan de Migración](#migracion)
8. [Testing Strategy](#testing)

---

## 🏗️ Arquitectura del Nuevo Sistema {#arquitectura}

### Diagrama de Flujo Simplificado

```
┌─────────────────────────────────────────────────────────────┐
│                         OWNER                                │
└────────────┬────────────────────────────────────┬───────────┘
             │                                    │
             │ 1. Release Week                    │ 2. Search Available
             ▼                                    ▼
    ┌────────────────────┐              ┌──────────────────────┐
    │ Week → Credits     │              │ Search Inventory     │
    │ Conversion         │              │ (Booking.com style)  │
    └────────┬───────────┘              └──────────┬───────────┘
             │                                     │
             │ Credits assigned                    │ Find matches
             ▼                                     ▼
    ┌─────────────────────────────────────────────────────────┐
    │              UNIFIED INVENTORY POOL                      │
    │  (All available weeks with credit pricing)              │
    └────────────┬────────────────────────────────────────────┘
                 │
                 │ 3. Book with Credits
                 ▼
    ┌─────────────────────────────────────────┐
    │    Credit Booking Service               │
    │    - Check balance                      │
    │    - Calculate difference               │
    │    - Process payment if needed          │
    │    - Confirm booking automatically      │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │         BOOKING CONFIRMED               │
    │     (No staff intervention)             │
    └─────────────────────────────────────────┘
```

### Principios de Diseño

1. **Automático First** - Sin intervención manual
2. **Transparente** - Owner siempre sabe qué recibe
3. **Inmediato** - Confirmación instantánea
4. **Flexible** - Créditos + cash si necesario
5. **Unificado** - Un solo inventario, una sola lógica

---

## 🔧 Componentes Backend {#backend}

### 1. Inventory Service (NUEVO)

**Responsabilidad:** Gestionar pool unificado de semanas disponibles

```typescript
// backend/src/services/inventoryService.ts

interface InventoryItem {
  id: number;
  weekId: number;
  propertyId: number;
  accommodationType: string;
  startDate: Date;
  endDate: Date;
  creditPrice: number; // Costo en créditos
  status: 'available' | 'reserved' | 'booked';
  originalOwnerId: number; // Owner que liberó la semana
  addedToInventoryAt: Date;
}

class InventoryService {
  /**
   * Agrega una semana al inventario disponible
   * Se llama cuando owner libera su semana
   */
  async addWeekToInventory(
    weekId: number,
    creditPrice: number
  ): Promise<InventoryItem>;

  /**
   * Busca semanas disponibles con filtros
   */
  async searchAvailableWeeks(filters: {
    startDate?: Date;
    endDate?: Date;
    propertyId?: number;
    location?: string;
    accommodationType?: string;
    minCredits?: number;
    maxCredits?: number;
  }): Promise<InventoryItem[]>;

  /**
   * Reserva una semana temporalmente (durante checkout)
   */
  async reserveWeek(
    inventoryItemId: number,
    ownerId: number,
    expiresInMinutes: number = 15
  ): Promise<void>;

  /**
   * Confirma la reserva y marca como booked
   */
  async confirmBooking(
    inventoryItemId: number,
    bookingId: number
  ): Promise<void>;

  /**
   * Libera una reserva si expira
   */
  async releaseExpiredReservations(): Promise<void>;

  /**
   * Obtiene estadísticas del inventario
   */
  async getInventoryStats(): Promise<{
    totalAvailable: number;
    byProperty: Record<number, number>;
    byAccommodationType: Record<string, number>;
    averageCreditPrice: number;
  }>;
}
```

### 2. Week Release Service (NUEVO)

**Responsabilidad:** Convertir semanas en créditos

```typescript
// backend/src/services/weekReleaseService.ts

import CreditCalculationService from './CreditCalculationService';  // ✅ Reutilizar existente
import CreditWalletService from './CreditWalletService';  // ✅ Reutilizar existente

interface ReleaseResult {
  success: boolean;
  creditsAwarded: number;
  inventoryItemId: number;
  walletBalance: number;
}

class WeekReleaseService {
  /**
   * Calcula cuántos créditos vale una semana
   * ✅ USA CreditCalculationService.calculateDepositCredits() existente
   */
  async calculateWeekValue(weekId: number): Promise<{
    credits: number;
    breakdown: {
      baseCredits: number;
      seasonMultiplier: number;
      propertyMultiplier: number;
      accommodationMultiplier: number;
    };
  }> {
    // ✅ Reutilizar servicio existente
    const result = await CreditCalculationService.calculateDepositCredits(weekId);
    
    return {
      credits: result.credits,
      breakdown: {
        baseCredits: result.breakdown.baseValue,
        seasonMultiplier: result.breakdown.tierMultiplier,
        propertyMultiplier: result.breakdown.locationMultiplier,
        accommodationMultiplier: result.breakdown.roomTypeMultiplier
      }
    };
  }

  /**
   * Libera una semana y asigna créditos al owner
   * TRANSACCIÓN ATÓMICA
   */
  async releaseWeek(
    weekId: number,
    ownerId: number
  ): Promise<ReleaseResult>;

  /**
   * Valida que la semana pueda ser liberada
   */
  async validateRelease(weekId: number, ownerId: number): Promise<{
    valid: boolean;
    reason?: string;
  }>;

  /**
   * Obtiene estimación de créditos SIN liberar
   */
  async estimateReleaseValue(weekId: number): Promise<number>;
}
```

### 3. Credit Booking Service (NUEVO)

**Responsabilidad:** Gestionar bookings pagados con créditos

```typescript
// backend/src/services/creditBookingService.ts

interface BookingRequest {
  ownerId: number;
  inventoryItemId: number;
  useCredits: number;
  additionalPayment?: {
    method: 'stripe' | 'paypal';
    amount: number;
  };
}

interface BookingResult {
  success: boolean;
  bookingId: number;
  creditsUsed: number;
  cashPaid: number;
  remainingCredits: number;
}

class CreditBookingService {
  /**
   * Calcula opciones de pago para un booking
   */
  async calculatePaymentOptions(
    ownerId: number,
    creditPrice: number
  ): Promise<{
    availableCredits: number;
    requiredCredits: number;
    difference: number; // Negativo si sobran, positivo si faltan
    options: Array<{
      type: 'credits_only' | 'credits_plus_cash' | 'buy_credits';
      creditsUsed: number;
      cashAmount: number;
      description: string;
    }>;
  }>;

  /**
   * Ejecuta el booking con créditos (y cash si necesario)
   * TRANSACCIÓN ATÓMICA
   */
  async bookWithCredits(
    request: BookingRequest
  ): Promise<BookingResult>;

  /**
   * Valida que el booking pueda realizarse
   */
  async validateBooking(
    ownerId: number,
    inventoryItemId: number
  ): Promise<{
    valid: boolean;
    reason?: string;
  }>;

  /**
   * Cancela un booking y devuelve créditos
   */
  async cancelCreditBooking(
    bookingId: number,
    reason: string
  ): Promise<{
    success: boolean;
    creditsRefunded: number;
  }>;
}
```

### 4. Modificaciones a Servicios Existentes

#### CreditWalletService (MODIFICAR)

```typescript
// Agregar método para deducir créditos por booking
async deductCreditsForBooking(
  ownerId: number,
  amount: number,
  bookingId: number,
  description: string
): Promise<{
  success: boolean;
  remainingBalance: number;
  transactionId: number;
}>;

// Agregar método para comprar créditos adicionales
async purchaseCredits(
  ownerId: number,
  amount: number,
  paymentIntentId: string
): Promise<{
  success: boolean;
  newBalance: number;
}>;
```

#### CreditCalculationService (✅ YA EXISTE - REUTILIZAR)

```typescript
// ✅ YA IMPLEMENTADO en backend/src/services/CreditCalculationService.ts
// Fórmula: Credits = Base_Season × Tier × Location × Room_Type

// Método principal ya implementado:
async calculateDepositCredits(weekId: number): Promise<{
  credits: number;
  breakdown: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
  };
}>;

### 4. Servicios Existentes a Reutilizar

### Estructura de Páginas

```
frontend/src/pages/owner/
├── WeekManagement.tsx           (Modificada)
│   ├── MyWeeksTab                ✅ Mantener
│   └── ReleaseWeekModal          🆕 NUEVO - Sustituye swap creation
│
├── InventorySearch.tsx          🆕 NUEVO - Búsqueda tipo Booking.com
│   ├── SearchFilters
│   ├── AvailabilityCalendar
│   ├── ResultsList
│   └── WeekDetailDrawer
│
├── CreditBookingCheckout.tsx   🆕 NUEVO - Checkout con créditos
│   ├── BookingSummary
│   ├── CreditBalanceDisplay
│   ├── PaymentOptions
│   └── ConfirmationScreen
│
└── Swaps.tsx                    ⚠️ DEPRECAR o simplificar
```

### 1. Release Week Modal (NUEVO)

```tsx
// frontend/src/components/owner/ReleaseWeekModal.tsx

interface ReleaseWeekModalProps {
  week: Week;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal simple para liberar una semana por créditos
 * 
 * Muestra:
 * - Detalles de la semana
 * - Estimación de créditos que recibirá
 * - Confirmación
 */
export function ReleaseWeekModal({ week, isOpen, onClose, onSuccess }: ReleaseWeekModalProps) {
  const [estimatedCredits, setEstimatedCredits] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  
  // Fetch estimated credits usando servicio existente
  useEffect(() => {
    if (isOpen && week) {
      fetchEstimate();
    }
  }, [isOpen, week]);
  
  const fetchEstimate = async () => {
    try {
      // ✅ Usa CreditCalculationService.estimateCreditsForWeek() existente
      const { data } = await apiClient.get(
        `/api/credits/estimate/${week.id}`
      );
      setEstimatedCredits(data.estimatedCredits);
      setBreakdown(data.breakdown);
    } catch (error) {
      console.error('Error estimating credits:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">
          Release Week for Credits
        </h2>

        {/* Week Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <WeekSummary week={week} />
        </div>

        {/* Credits Estimation */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">You will receive</p>
              <p className="text-4xl font-bold text-blue-600">
                {estimatedCredits} credits
              </p>
            </div>
            <Coins className="h-16 w-16 text-blue-400" />
          </div>
          
          {/* Breakdown */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">
              How is this calculated?
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Base: 1000 credits</li>
              <li>Season multiplier: ×1.3 (high season)</li>
              <li>Property tier: ×1.2 (premium)</li>
              <li>Accommodation: ×1.4 (duplex)</li>
            </ul>
          </details>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ This action cannot be undone. Your week will be added to the 
            marketplace inventory and you will receive {estimatedCredits} credits 
            to use for future bookings.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRelease}
            disabled={loading}
            className="flex-1 btn-primary"
          >
            {loading ? 'Releasing...' : 'Confirm Release'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### 2. Inventory Search Page (NUEVO)

```tsx
// frontend/src/pages/owner/InventorySearch.tsx

/**
 * Página principal de búsqueda de inventario disponible
 * Estilo Booking.com
 */
export default function InventorySearch() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<SearchFilters>({
    startDate: null,
    endDate: null,
    location: '',
    accommodationType: 'all',
    maxCredits: null
  });
  
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-search', filters],
    queryFn: () => inventoryApi.search(filters)
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Search Bar */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-4">
            Find Your Next Stay
          </h1>
          
          {/* Search Filters */}
          <SearchFilters
            filters={filters}
            onChange={setFilters}
          />
        </div>
      </header>

      {/* Results Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Stats Bar */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-gray-600">
                {data.results.length} weeks available
              </p>
              <SortDropdown />
            </div>

            {/* Results List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.results.map((item) => (
                <WeekCard
                  key={item.id}
                  item={item}
                  onSelect={() => handleSelectWeek(item)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

### 3. Week Card Component

```tsx
// frontend/src/components/inventory/WeekCard.tsx

interface WeekCardProps {
  item: InventoryItem;
  onSelect: () => void;
}

export function WeekCard({ item, onSelect }: WeekCardProps) {
  const { property, startDate, endDate, creditPrice, accommodationType } = item;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition cursor-pointer"
         onClick={onSelect}>
      {/* Property Image */}
      <div className="relative h-48 rounded-t-xl overflow-hidden">
        <img
          src={property.images[0]}
          alt={property.name}
          className="w-full h-full object-cover"
        />
        {/* Badge */}
        <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full">
          <span className="text-sm font-semibold">{accommodationType}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Property Name */}
        <h3 className="font-bold text-lg mb-2">{property.name}</h3>
        
        {/* Location */}
        <div className="flex items-center text-gray-600 text-sm mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{property.city}, {property.country}</span>
        </div>

        {/* Dates */}
        <div className="flex items-center text-gray-600 text-sm mb-4">
          <Calendar className="h-4 w-4 mr-1" />
          <span>
            {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t pt-3">
          {/* Price */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">From</p>
              <p className="text-2xl font-bold text-blue-600">
                {creditPrice} credits
              </p>
            </div>
            <button className="btn-primary">
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4. Credit Booking Checkout

```tsx
// frontend/src/pages/owner/CreditBookingCheckout.tsx

export default function CreditBookingCheckout() {
  const { inventoryItemId } = useParams();
  const { user } = useAuth();
  
  // Fetch item details and payment options
  const { data: item } = useQuery({
    queryKey: ['inventory-item', inventoryItemId],
    queryFn: () => inventoryApi.getItem(inventoryItemId)
  });

  const { data: paymentOptions } = useQuery({
    queryKey: ['payment-options', inventoryItemId, user?.id],
    queryFn: () => bookingApi.getPaymentOptions(inventoryItemId)
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Complete Your Booking</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Summary */}
          <BookingSummaryCard item={item} />

          {/* Payment Options */}
          <PaymentOptionsCard
            options={paymentOptions}
            onSelect={setSelectedOption}
          />

          {/* Additional Options */}
          <AdditionalOptionsCard />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <PriceSummaryCard
            item={item}
            paymentOption={selectedOption}
            onConfirm={handleConfirmBooking}
          />
        </div>
      </div>
    </div>
  );
}
```

### 5. Payment Options Card

```tsx
// frontend/src/components/booking/PaymentOptionsCard.tsx

export function PaymentOptionsCard({ options, onSelect }: PaymentOptionsCardProps) {
  const [selectedOption, setSelectedOption] = useState(options?.options[0]);

  if (!options) return <LoadingSpinner />;

  const { availableCredits, requiredCredits, difference } = options;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Payment Method</h2>

      {/* Credit Balance */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Your Credit Balance</span>
          <span className="text-2xl font-bold text-blue-600">
            {availableCredits} credits
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Required</span>
          <span className="text-lg font-semibold">
            {requiredCredits} credits
          </span>
        </div>
        <div className="border-t mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Difference</span>
            <span className={`text-lg font-bold ${
              difference >= 0 ? 'text-green-600' : 'text-orange-600'
            }`}>
              {difference >= 0 ? `+${difference}` : difference} credits
            </span>
          </div>
        </div>
      </div>

      {/* Payment Options */}
      <div className="space-y-3">
        {options.options.map((option, index) => (
          <label
            key={index}
            className={`block border-2 rounded-lg p-4 cursor-pointer transition ${
              selectedOption === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start">
              <input
                type="radio"
                name="payment-option"
                checked={selectedOption === option}
                onChange={() => {
                  setSelectedOption(option);
                  onSelect(option);
                }}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <p className="font-semibold mb-1">{option.type}</p>
                <p className="text-sm text-gray-600 mb-2">
                  {option.description}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-blue-600 font-medium">
                    {option.creditsUsed} credits
                  </span>
                  {option.cashAmount > 0 && (
                    <span className="text-green-600 font-medium">
                      + €{option.cashAmount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔌 APIs Necesarias {#apis}

### 1. Week Release Endpoints

```typescript
// POST /api/owner/weeks/:weekId/release
// Libera una semana y asigna créditos

Request: {
  confirmation: boolean;
}

Response: {
  success: boolean;
  creditsAwarded: number;
  inventoryItemId: number;
  newBalance: number;
  message: string;
}
```

```typescript
// GET /api/owner/weeks/:weekId/release/estimate
// Estima cuántos créditos recibiría

Response: {
  estimatedCredits: number;
  breakdown: {
    baseCredits: number;
    seasonMultiplier: number;
    propertyMultiplier: number;
    accommodationMultiplier: number;
  };
}
```

### 2. Inventory Search Endpoints

```typescript
// GET /api/inventory/search
// Busca semanas disponibles

Query Params: {
  startDate?: string;
  endDate?: string;
  propertyId?: number;
  location?: string;
  accommodationType?: string;
  minCredits?: number;
  maxCredits?: number;
  sortBy?: 'credits' | 'date' | 'location';
  limit?: number;
  offset?: number;
}

Response: {
  success: boolean;
  results: InventoryItem[];
  total: number;
  filters: AppliedFilters;
}
```

```typescript
// GET /api/inventory/:itemId
// Obtiene detalles de una semana específica

Response: {
  success: boolean;
  item: InventoryItem;
  property: Property;
  similarWeeks: InventoryItem[];
}
```

### 3. Credit Booking Endpoints

```typescript
// POST /api/bookings/calculate-options
// Calcula opciones de pago para un booking

Request: {
  inventoryItemId: number;
}

Response: {
  availableCredits: number;
  requiredCredits: number;
  difference: number;
  options: Array<{
    type: 'credits_only' | 'credits_plus_cash' | 'buy_credits';
    creditsUsed: number;
    cashAmount: number;
    description: string;
  }>;
}
```

```typescript
// POST /api/bookings/with-credits
// Crea un booking usando créditos

Request: {
  inventoryItemId: number;
  paymentOption: {
    type: string;
    creditsToUse: number;
    additionalPayment?: {
      method: 'stripe' | 'paypal';
      amount: number;
    };
  };
}

Response: {
  success: boolean;
  booking: Booking;
  creditsUsed: number;
  cashPaid: number;
  remainingCredits: number;
  confirmationCode: string;
}
```

---

## 💾 Modelos de Datos {#modelos}

### 1. InventoryItems Table (NUEVA)

```sql
CREATE TABLE inventory_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  week_id INT NOT NULL,
  property_id INT NOT NULL,
  accommodation_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  credit_price INT NOT NULL,
  status ENUM('available', 'reserved', 'booked') DEFAULT 'available',
  original_owner_id INT NOT NULL,
  reserved_by_owner_id INT NULL,
  reserved_until TIMESTAMP NULL,
  booked_by_owner_id INT NULL,
  booking_id INT NULL,
  added_to_inventory_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (week_id) REFERENCES weeks(id),
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (original_owner_id) REFERENCES users(id),
  FOREIGN KEY (reserved_by_owner_id) REFERENCES users(id),
  FOREIGN KEY (booked_by_owner_id) REFERENCES users(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_property (property_id),
  INDEX idx_accommodation (accommodation_type),
  INDEX idx_credit_price (credit_price)
);
```

### 2. Week Releases Table (NUEVA)

```sql
CREATE TABLE week_releases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  week_id INT NOT NULL,
  owner_id INT NOT NULL,
  credits_awarded INT NOT NULL,
  inventory_item_id INT NOT NULL,
  calculation_breakdown JSON, -- {baseCredits, multipliers, etc}
  released_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (week_id) REFERENCES weeks(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  
  INDEX idx_owner (owner_id),
  INDEX idx_week (week_id)
);
```

### 3. Credit Bookings Table (NUEVA)

```sql
CREATE TABLE credit_bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  owner_id INT NOT NULL,
  credits_used INT NOT NULL,
  cash_paid DECIMAL(10,2) DEFAULT 0,
  payment_intent_id VARCHAR(255),
  wallet_transaction_id INT,
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (wallet_transaction_id) REFERENCES credit_transactions(id),
  
  INDEX idx_owner (owner_id),
  INDEX idx_booking (booking_id)
);
```

### 4. Modificaciones a Tablas Existentes

```sql
-- Agregar campo a weeks para tracking
ALTER TABLE weeks
ADD COLUMN released_to_inventory BOOLEAN DEFAULT FALSE,
ADD COLUMN inventory_item_id INT NULL,
ADD FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);

-- Agregar tipos de transacción a credit_transactions
ALTER TABLE credit_transactions
MODIFY COLUMN transaction_type ENUM(
  'deposit', 
  'withdrawal', 
  'expiration', 
  'purchase', 
  'week_release',  -- NUEVO
  'booking_payment', -- NUEVO
  'booking_refund'   -- NUEVO
);

-- Agregar campos a bookings
ALTER TABLE bookings
ADD COLUMN booked_with_credits BOOLEAN DEFAULT FALSE,
ADD COLUMN credit_booking_id INT NULL,
ADD FOREIGN KEY (credit_booking_id) REFERENCES credit_bookings(id);
```

---

## 🔄 Flujos de Usuario {#flujos}

### Flujo 1: Release Week

```
1. Owner → My Weeks → Selecciona semana
2. Click "Release for Credits"
3. Modal muestra:
   - Detalles de la semana
   - Estimación: "1,200 credits"
   - Breakdown de cálculo
   - Warning: irreversible
4. Owner confirma
5. Backend:
   a. Valida week ownership
   b. Calcula créditos finales
   c. TRANSACTION:
      - Crea InventoryItem
      - Asigna créditos a wallet
      - Marca week como released
      - Log en week_releases
   d. Commit
6. Frontend:
   - Success message
   - Muestra nuevo balance
   - Redirige a wallet o inventory search
```

### Flujo 2: Search & Browse

```
1. Owner → "Find a Stay" / "Browse Available Weeks"
2. Search page:
   - Filtros: Dates, Location, Type, Max Credits
   - Calendario de disponibilidad
3. Aplica filtros
4. Backend:
   - Query inventory_items
   - Join con properties
   - Aplica filtros y sorting
   - Pagina resultados
5. Frontend:
   - Grid de WeekCards
   - Cada card muestra:
     * Property image
     * Location
     * Dates
     * Accommodation type
     * Credit price
6. Owner click en card
7. Modal/Drawer con detalles:
   - Property full info
   - Amenities
   - Photos
   - Map
   - Similar weeks
   - "Book Now" button
```

### Flujo 3: Credit Booking Checkout

```
1. Owner → "Book Now" en week detail
2. Checkout page:
   - Left: Booking summary
   - Right: Payment sidebar
3. Backend fetch payment options:
   - Check owner's credit balance
   - Calculate difference
   - Generate options:
     a. Credits only (if sufficient)
     b. Credits + cash (if insufficient)
     c. Buy more credits
4. Owner selecciona opción
5. Si necesita cash:
   - Stripe payment form
   - Confirm payment
6. Owner click "Confirm Booking"
7. Backend:
   a. Valida inventario aún disponible
   b. Valida balance de créditos
   c. TRANSACTION:
      - Reserve inventory item
      - Deduct credits from wallet
      - Process cash payment (if any)
      - Create booking record
      - Create credit_booking record
      - Update inventory_item status
      - Mark original week as booked
   d. Commit
8. Frontend:
   - Success animation
   - Confirmation screen con:
     * Booking details
     * Confirmation code
     * Credits used
     * Remaining balance
   - Email confirmation sent
```

### Flujo 4: Booking Cancellation

```
1. Owner → My Bookings → Select booking
2. Click "Cancel Booking"
3. Confirm cancellation
4. Backend:
   a. Check cancellation policy
   b. Calculate refund:
      - Full credit refund if >30 days
      - Partial if 14-30 days
      - No refund if <14 days
   c. TRANSACTION:
      - Return credits to wallet
      - Mark booking as cancelled
      - Return inventory_item to available
      - Log refund transaction
   d. Commit
5. Frontend:
   - Success message
   - Show refund details
   - Update balance
```

---

## 🚀 Plan de Migración {#migracion}

### Fase 1: Preparación (1 semana)

**Objetivos:**
- ✅ Setup de tablas nuevas
- ✅ Servicios base implementados
- ✅ Tests unitarios

**Tasks:**
1. Crear migraciones de BD:
   - `inventory_items`
   - `week_releases`
   - `credit_bookings`
   - Modificaciones a tablas existentes
2. Implementar modelos Sequelize
3. Crear servicios base (sin lógica compleja)
4. Setup tests

**Entregables:**
- Migraciones ejecutadas en staging
- Modelos creados
- Test suite básico

---

### Fase 2: Backend Core (2-3 semanas)

**Week 1: Inventory & Release**
- Implementar `InventoryService`
- Implementar `WeekReleaseService`
- Tests de integración
- API endpoints:
  - `POST /weeks/:id/release`
  - `GET /weeks/:id/release/estimate`
  - `GET /inventory/search`

**Week 2: Credit Booking**
- Implementar `CreditBookingService`
- Modificar `CreditWalletService`
- Tests de integración
- API endpoints:
  - `POST /bookings/calculate-options`
  - `POST /bookings/with-credits`

**Week 3: Integration & Testing**
- Tests E2E completos
- Performance testing
- Error handling refinement
- Documentation

**Entregables:**
- APIs completas y documentadas
- Test coverage >80%
- Postman collection

---

### Fase 3: Frontend Implementation (2-3 semanas)

**Week 1: Release Flow**
- `ReleaseWeekModal` component
- Integración con API
- Success/error states
- Update `MyWeeks` page

**Week 2: Search & Browse**
- `InventorySearch` page
- `SearchFilters` component
- `WeekCard` component
- `WeekDetailDrawer` component
- Integración con API

**Week 3: Checkout Flow**
- `CreditBookingCheckout` page
- `PaymentOptionsCard` component
- `PriceSummaryCard` component
- Stripe integration (if needed)
- Confirmation screen

**Entregables:**
- Flujos completos funcionales
- Responsive design
- Error handling
- Loading states

---

### Fase 4: Migration & Rollout (1 semana)

**Pre-Launch:**
1. Full E2E testing en staging
2. Performance audit
3. Security audit
4. User acceptance testing

**Launch Strategy:**
1. Soft launch (10% usuarios)
2. Monitor metrics:
   - Release rate
   - Search usage
   - Booking conversion
   - Error rate
3. Gradual rollout to 100%

**Post-Launch:**
1. Monitor for 7 days
2. Collect user feedback
3. Quick fixes if needed
4. Performance optimization

**Entregables:**
- Sistema en producción
- Monitoring dashboard
- Incident response plan

---

### Fase 5: Deprecation of Old System (1 semana)

**Tasks:**
1. Completar SwapRequests activos:
   - Script para migración
   - Manual review por staff
2. Deprecar endpoints viejos:
   - Mantener por 30 días (read-only)
   - Redirect a nuevos endpoints
3. Update documentation
4. Communication to users:
   - Email announcement
   - In-app notification
   - Help center articles
5. Staff training

**Entregables:**
- SwapRequests migrados
- Legacy code removed
- Documentation updated

---

## 🧪 Testing Strategy {#testing}

### Unit Tests

```typescript
// Test: Calculate week credit value
describe('WeekReleaseService.calculateWeekValue', () => {
  it('should calculate base credits correctly', async () => {
    const result = await service.calculateWeekValue(weekId);
    expect(result.credits).toBeGreaterThan(0);
    expect(result.breakdown).toHaveProperty('baseCredits');
  });

  it('should apply season multiplier', async () => {
    // High season week
    const highSeasonResult = await service.calculateWeekValue(highSeasonWeekId);
    // Low season week
    const lowSeasonResult = await service.calculateWeekValue(lowSeasonWeekId);
    
    expect(highSeasonResult.credits).toBeGreaterThan(lowSeasonResult.credits);
  });
});
```

### Integration Tests

```typescript
// Test: Full release flow
describe('Week Release Flow', () => {
  it('should release week and assign credits atomically', async () => {
    const initialBalance = await getWalletBalance(ownerId);
    
    const result = await weekReleaseService.releaseWeek(weekId, ownerId);
    
    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBeGreaterThan(0);
    
    const newBalance = await getWalletBalance(ownerId);
    expect(newBalance).toBe(initialBalance + result.creditsAwarded);
    
    const inventoryItem = await InventoryItem.findByPk(result.inventoryItemId);
    expect(inventoryItem).toBeDefined();
    expect(inventoryItem.status).toBe('available');
  });
});
```

### E2E Tests

```typescript
// Test: Search and book with credits
describe('Credit Booking Flow', () => {
  it('should allow owner to search, select, and book with credits', async () => {
    // 1. Release a week
    await releasePage.releaseWeek(weekId);
    
    // 2. Search inventory
    await searchPage.goto();
    await searchPage.setFilters({
      location: 'Maldives',
      maxCredits: 1500
    });
    await searchPage.clickSearch();
    
    // 3. Select a week
    const weekCard = await searchPage.getResultCard(0);
    await weekCard.click();
    
    // 4. Book with credits
    await weekDetailDrawer.clickBook();
    await checkoutPage.selectPaymentOption('credits_only');
    await checkoutPage.clickConfirm();
    
    // 5. Verify confirmation
    await expect(confirmationScreen.heading).toContainText('Booking Confirmed');
    
    // 6. Verify balance updated
    const newBalance = await walletPage.getBalance();
    expect(newBalance).toBeLessThan(initialBalance);
  });
});
```

---

## 📊 Success Metrics

### Key Performance Indicators (KPIs)

1. **Adoption Rate**
   - % of owners who release weeks
   - Target: >30% in first 3 months

2. **Booking Conversion**
   - % of searches that lead to booking
   - Target: >15%

3. **Automation Success**
   - % of bookings without staff intervention
   - Target: >95%

4. **User Satisfaction**
   - NPS score
   - Target: >70

5. **Revenue Impact**
   - Additional bookings per month
   - Credits purchased
   - Target: +25% in 6 months

---

## 🔐 Security Considerations

1. **Transaction Atomicity**
   - All credit operations in transactions
   - Rollback on any failure
   - Idempotency keys for payments

2. **Credit Balance Validation**
   - Always check before deduction
   - Prevent double-spending
   - Audit logs for all transactions

3. **Inventory Race Conditions**
   - Pessimistic locking for bookings
   - Reservation timeout mechanism
   - Clear expired reservations regularly

4. **Payment Security**
   - PCI compliance for cash payments
   - Stripe SCA support
   - Secure webhook handling

---

## 📝 Documentation Plan

1. **API Documentation**
   - OpenAPI/Swagger specs
   - Example requests/responses
   - Error codes and handling

2. **User Guides**
   - How to release a week
   - How to search and book
   - Understanding credits

3. **Staff Training**
   - New system overview
   - Handling edge cases
   - Troubleshooting guide

4. **Developer Docs**
   - Architecture overview
   - Service dependencies
   - Deployment guide

---

## ✅ Checklist de Implementación

### Backend
- [ ] Crear migraciones de BD
- [ ] Implementar modelos Sequelize
- [ ] Implementar `InventoryService`
- [ ] Implementar `WeekReleaseService`
- [ ] Implementar `CreditBookingService`
- [ ] Modificar `CreditWalletService`
- [ ] Modificar `CreditCalculationService`
- [ ] Crear API endpoints
- [ ] Tests unitarios (>80% coverage)
- [ ] Tests de integración
- [ ] Tests E2E
- [ ] Documentación API (Swagger)

### Frontend
- [ ] `ReleaseWeekModal` component
- [ ] Update `MyWeeks` page
- [ ] `InventorySearch` page
- [ ] `SearchFilters` component
- [ ] `WeekCard` component
- [ ] `WeekDetailDrawer` component
- [ ] `CreditBookingCheckout` page
- [ ] `PaymentOptionsCard` component
- [ ] `PriceSummaryCard` component
- [ ] Confirmation screen
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] Accessibility (a11y)

### DevOps
- [ ] CI/CD pipeline updates
- [ ] Staging deployment
- [ ] Production deployment plan
- [ ] Rollback plan
- [ ] Monitoring setup
- [ ] Alerting configuration

### Documentation
- [ ] API documentation
- [ ] User guides
- [ ] Staff training materials
- [ ] Developer documentation
- [ ] Migration guide

### Communication
- [ ] Announcement email draft
- [ ] In-app notification
- [ ] Help center articles
- [ ] FAQ updates

---

## 🎯 Next Steps

1. **Validar con Antonio:**
   - [ ] Revisar este documento
   - [ ] Aclarar dudas de pricing
   - [ ] Confirmar prioridades
   - [ ] Aprobar timeline

2. **Diseño UX/UI:**
   - [ ] Crear wireframes
   - [ ] Mockups de alta fidelidad
   - [ ] Validar con stakeholders

3. **Kickoff Técnico:**
   - [ ] Setup de proyecto
   - [ ] División de tareas
   - [ ] Sprint planning

---

**Documento creado:** 25 de Enero, 2026  
**Última actualización:** 25 de Enero, 2026  
**Versión:** 1.0  
**Estado:** Pendiente de aprobación
