# Sistema de Créditos - Análisis Técnico y Plan de Implementación

**Fecha:** 25 de Diciembre, 2025  
**Autor:** Análisis Técnico  
**Estado:** Propuesta para Revisión

---

## 📋 RESUMEN EJECUTIVO

El cliente ha definido un sistema de créditos basado en el modelo RCI/Interval con valoración dinámica de semanas depositadas. Este documento analiza los requisitos, identifica cambios necesarios al sistema actual, y propone un plan de implementación en fases.

**Complejidad:** Alta  
**Impacto en Sistema Actual:** Significativo  
**Tiempo Estimado:** 3-4 semanas para MVP  
**Riesgo Principal:** Lógica de cálculo y liquidación entre propiedades

---

## 🎯 MODELO DE NEGOCIO PROPUESTO

### 1. Sistema de Valoración (Power Score)

**Cambio Fundamental:** Abandonar el modelo 1:1 (una semana = una semana) por un sistema de créditos variables.

#### Fórmula de Depósito:
```
Wallet Credits = [Base_Season_Value] × [Location_Multiplier] × [Room_Type_Multiplier]
```

#### Valores Base de Temporada:
- **Red (Alta):** 1000 créditos base
- **White (Media):** 600 créditos base  
- **Blue (Baja):** 300 créditos base

#### Multiplicadores de Ubicación:
| Tier | Multiplicador | Propiedades |
|------|---------------|-------------|
| **DIAMOND** | 1.5x | Green Park Hotel (Cala di Volpe), Hotel Perla (Madonna di Campiglio) |
| **GOLD** | 1.3x | Sport Hotel Astoria (Alta Badia - Coming Soon) |
| **GOLD** | 1.2x | Parc Hotel Posta (S. Vigilio), Palace Pontedilegno Resort |
| **SILVER+** | 1.1x | Sporting Tanca Manna, La Rondinaia, Hotel Ostuni (Coming Soon) |
| **STANDARD** | 1.0x | Hotel Palazzo Caveja (Rimini) |

#### Multiplicadores de Tipo de Habitación:
- **Standard/Classic:** 1.0x
- **Superior/Comfort:** 1.2x
- **Deluxe/Junior Suite:** 1.5x
- **Suite/Presidential:** 2.0x+

#### Ejemplo de Cálculo:
```
Depósito: Semana RED en Green Park Hotel (Diamond), Junior Suite
Créditos = 1000 × 1.5 × 1.5 = 2,250 créditos
```

### 2. Triple-Track Exchange Model

#### Track 1: Peer-to-Peer Swap (Owner vs Owner)
- Intercambio directo entre propietarios
- Fee fijo (€99) solo cuando se confirma el swap
- **Sin swap = sin tarifa**
- Sistema actual YA implementado ✅

#### Track 2: Hotel Conversion (Gasto de Créditos)
- Usuario usa créditos de wallet para reservar noches individuales
- Precios en hoteles del grupo o externos
- **NUEVA FUNCIONALIDAD** 🆕

#### Track 3: Ancillary Services (Upselling)
- Restaurante, media pensión, spa, etc.
- Pago con créditos o tarjeta
- Add-ons durante checkout
- **NUEVA FUNCIONALIDAD** 🆕

### 3. Pagos Híbridos (Cash Top-up)

**Escenario:**
```
Costo Total: 800 créditos
Wallet Usuario: 500 créditos
Diferencia: 300 créditos → Conversión a €300 vía Stripe
```

**Sistema debe:**
- Detectar saldo insuficiente
- Calcular diferencia en moneda
- Procesar pago mixto (créditos + tarjeta)
- **REQUIERE NUEVA LÓGICA** 🆕

### 4. Inter-Property Settlement

**Dos tipos de hoteles:**
1. **Grupo (Swadeshi):** Compensación interna
2. **Externos:** Deuda de plataforma hacia hotel externo

**Sistema debe rastrear:**
- Qué hotel generó los créditos (depósito)
- Qué hotel recibe al huésped (reserva)
- Diferencia para liquidación

---

## 🗄️ CAMBIOS REQUERIDOS EN BASE DE DATOS

### 0. Nueva Tabla: `platform_settings` (Para configuración dinámica)
```sql
CREATE TABLE platform_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') NOT NULL,
  description TEXT,
  updated_by INT, -- Admin user ID
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_key (setting_key)
);

-- Inicializar con valores críticos
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES
('CREDIT_TO_EURO_RATE', '1.0', 'NUMBER', 'Conversion rate: 1 credit = X euros'),
('CREDIT_EXPIRATION_DAYS', '180', 'NUMBER', '6 months expiration period'),
('ENABLE_CREDIT_EXPIRATION', 'true', 'BOOLEAN', 'Enable automatic credit expiration');
```

### 1. Nueva Tabla: `property_tiers`
```sql
CREATE TABLE property_tiers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL, -- 'DIAMOND', 'GOLD', 'SILVER+', 'STANDARD'
  multiplier DECIMAL(3,2) NOT NULL, -- 1.5, 1.3, 1.2, 1.1, 1.0
  description TEXT,
  display_order INT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

### 2. Nueva Tabla: `room_type_multipliers`
```sql
CREATE TABLE room_type_multipliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_type_id INT NOT NULL,
  multiplier DECIMAL(3,2) NOT NULL, -- 1.0, 1.2, 1.5, 2.0
  effective_from DATE,
  effective_to DATE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);
```

### 3. Nueva Tabla: `seasonal_calendar`
```sql
CREATE TABLE seasonal_calendar (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  season_type ENUM('RED', 'WHITE', 'BLUE') NOT NULL,
  base_value INT NOT NULL, -- 1000, 600, 300
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  INDEX idx_dates (property_id, start_date, end_date)
);
```

### 4. Nueva Tabla: `user_credit_wallets`
```sql
CREATE TABLE user_credit_wallets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total_credits INT NOT NULL DEFAULT 0,
  reserved_credits INT NOT NULL DEFAULT 0, -- En uso pero no gastados
  available_credits INT GENERATED ALWAYS AS (total_credits - reserved_credits) STORED,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_wallet (user_id)
);
```

### 5. Nueva Tabla: `credit_transactions`
```sql
CREATE TABLE credit_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  transaction_type ENUM('DEPOSIT', 'SPEND', 'REFUND', 'ADJUSTMENT', 'EXPIRATION') NOT NULL,
  amount INT NOT NULL, -- Positivo o negativo
  balance_after INT NOT NULL,
  source_type ENUM('WEEK_DEPOSIT', 'BOOKING', 'ANCILLARY', 'ADMIN', 'EXPIRATION') NOT NULL,
  source_id INT, -- ID de week, booking, etc.
  description TEXT,
  metadata JSON, -- Detalles de cálculo
  expiration_date DATE, -- Para DEPOSIT transactions, fecha de caducidad
  created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_date (user_id, created_at),
  INDEX idx_expiration (user_id, expiration_date)
);
```

### 6. Modificar Tabla: `properties`
```sql
ALTER TABLE properties 
ADD COLUMN tier_id INT,
ADD COLUMN is_group_property BOOLEAN DEFAULT true,
ADD COLUMN external_settlement_rate DECIMAL(10,2), -- Para externos
ADD FOREIGN KEY (tier_id) REFERENCES property_tiers(id);
```

### 7. Nueva Tabla: `credit_booking_costs`
```sql
CREATE TABLE credit_booking_costs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  room_type_id INT NOT NULL,
  season_type ENUM('RED', 'WHITE', 'BLUE') NOT NULL,
  base_rate_credits INT NOT NULL, -- Precio por noche en créditos
  effective_from DATE,
  effective_to DATE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (room_type_id) REFERENCES room_types(id),
  INDEX idx_property_season (property_id, season_type)
);
```

### 8. Nueva Tabla: `ancillary_services`
```sql
CREATE TABLE ancillary_services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  service_type ENUM('HALFBOARD', 'FULLBOARD', 'SPA', 'RESTAURANT', 'OTHER') NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_credits INT,
  price_cash DECIMAL(10,2),
  allow_credit_payment BOOLEAN DEFAULT true,
  allow_cash_payment BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

### 9. Nueva Tabla: `booking_ancillary_services`
```sql
CREATE TABLE booking_ancillary_services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  ancillary_service_id INT NOT NULL,
  quantity INT DEFAULT 1,
  price_credits INT,
  price_cash DECIMAL(10,2),
  payment_method ENUM('CREDITS', 'CASH', 'MIXED') NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (ancillary_service_id) REFERENCES ancillary_services(id)
);
```

### 10. Modificar Tabla: `weeks`
```sql
ALTER TABLE weeks
ADD COLUMN deposited_for_credits BOOLEAN DEFAULT false,
ADD COLUMN credits_generated INT,
ADD COLUMN deposit_calculation JSON, -- Guardar fórmula usada
ADD COLUMN deposited_at DATETIME,
ADD COLUMN credits_expiration_date DATE, -- 6 meses desde deposited_at
ADD COLUMN ownership_status ENUM('VERIFIED', 'PENDING', 'CLAIMED', 'UNASSIGNED') DEFAULT 'UNASSIGNED',
ADD COLUMN verification_code VARCHAR(50) UNIQUE, -- Para claim system
ADD COLUMN imported_from_legacy BOOLEAN DEFAULT false,
ADD COLUMN legacy_reference VARCHAR(255), -- ID en sistema anterior
ADD INDEX idx_verification (verification_code),
ADD INDEX idx_ownership (owner_id, ownership_status);
```

### 13. Nueva Tabla: `week_claim_requests`
```sql
CREATE TABLE week_claim_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  week_id INT NOT NULL,
  verification_code VARCHAR(50),
  ownership_proof_document VARCHAR(500), -- URL a documento
  status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  admin_notes TEXT,
  approved_by INT, -- Admin user ID
  approved_at DATETIME,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (week_id) REFERENCES weeks(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_status (status)
);
```

### 14. Nueva Tabla: `setting_change_log`
```sql
CREATE TABLE setting_change_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by INT NOT NULL,
  reason TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_setting (setting_key, created_at)
);
```

### 11. Modificar Tabla: `bookings`
```sql
ALTER TABLE bookings
ADD COLUMN payment_method ENUM('CASH', 'CREDITS', 'MIXED') NOT NULL,
ADD COLUMN credits_used INT DEFAULT 0,
ADD COLUMN cash_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN credit_calculation JSON; -- Guardar detalles de cálculo
```

### 12. Nueva Tabla: `inter_property_settlements`
```sql
CREATE TABLE inter_property_settlements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  credit_source_property_id INT, -- Hotel que generó créditos
  service_property_id INT NOT NULL, -- Hotel que hospeda
  credits_used INT NOT NULL,
  settlement_amount DECIMAL(10,2), -- Monto a pagar
  settlement_status ENUM('PENDING', 'PROCESSED', 'PAID') DEFAULT 'PENDING',
  settlement_date DATETIME,
  notes TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (credit_source_property_id) REFERENCES properties(id),
  FOREIGN KEY (service_property_id) REFERENCES properties(id)
);
```

---

## 💡 LÓGICA DE CÁLCULO

### A. Depósito de Semana → Créditos

```typescript
interface DepositCalculation {
  weekId: number;
  propertyId: number;
  roomTypeId: number;
  checkIn: Date;
  checkOut: Date;
}

async function calculateDepositCredits(deposit: DepositCalculation): Promise<number> {
  // 1. Determinar temporada de la semana
  const season = await getSeasonForDates(deposit.propertyId, deposit.checkIn, deposit.checkOut);
  const baseSeasonValue = season.base_value; // 1000, 600, o 300
  
  // 2. Obtener multiplicador de ubicación
  const property = await getPropertyWithTier(deposit.propertyId);
  const locationMultiplier = property.tier.multiplier; // 1.0 - 1.5
  
  // 3. Obtener multiplicador de tipo de habitación
  const roomType = await getRoomTypeWithMultiplier(deposit.roomTypeId);
  const roomTypeMultiplier = roomType.multiplier; // 1.0 - 2.0+
  
  // 4. Calcular créditos totales
  const totalCredits = baseSeasonValue * locationMultiplier * roomTypeMultiplier;
  
  // 5. Guardar metadata para auditoría
  const metadata = {
    baseSeasonValue,
    season: season.season_type,
    locationMultiplier,
    roomTypeMultiplier,
    formula: `${baseSeasonValue} × ${locationMultiplier} × ${roomTypeMultiplier} = ${totalCredits}`
  };
  
  return Math.round(totalCredits);
}
```

### B. Reserva con Créditos → Costo

```typescript
interface BookingCostCalculation {
  propertyId: number;
  roomTypeId: number;
  checkIn: Date;
  checkOut: Date;
}

async function calculateBookingCost(booking: BookingCostCalculation): Promise<{
  totalCredits: number;
  nightlyBreakdown: Array<{ date: Date; credits: number; season: string }>;
}> {
  const nights = getDateRange(booking.checkIn, booking.checkOut);
  const breakdown = [];
  let totalCredits = 0;
  
  for (const night of nights) {
    // 1. Determinar temporada para esta noche
    const season = await getSeasonForDate(booking.propertyId, night);
    
    // 2. Obtener tarifa base en créditos para esta combinación
    const baseRate = await getCreditRate(
      booking.propertyId,
      booking.roomTypeId,
      season.season_type
    );
    
    // 3. Aplicar multiplicador de tipo de habitación
    const roomType = await getRoomTypeWithMultiplier(booking.roomTypeId);
    const nightCredits = baseRate * roomType.multiplier;
    
    breakdown.push({
      date: night,
      credits: Math.round(nightCredits),
      season: season.season_type
    });
    
    totalCredits += nightCredits;
  }
  
  return {
    totalCredits: Math.round(totalCredits),
    nightlyBreakdown: breakdown
  };
}
```

### C. Pago Híbrido (Créditos + Efectivo)

```typescript
interface HybridPaymentCalculation {
  userId: number;
  totalCostCredits: number;
  creditToEuroRate: number; // Ej: 1 crédito = €1
}

async function calculateHybridPayment(payment: HybridPaymentCalculation): Promise<{
  creditsUsed: number;
  cashRequired: number;
  remainingWalletCredits: number;
}> {
  // 1. Obtener wallet del usuario
  const wallet = await getUserWallet(payment.userId);
  const availableCredits = wallet.available_credits;
  
  // 2. Determinar cuántos créditos se pueden usar
  const creditsToUse = Math.min(availableCredits, payment.totalCostCredits);
  
  // 3. Calcular diferencia en efectivo
  const remainingCredits = payment.totalCostCredits - creditsToUse;
  const cashRequired = remainingCredits * payment.creditToEuroRate;
  
  return {
    creditsUsed: creditsToUse,
    cashRequired: cashRequired,
    remainingWalletCredits: availableCredits - creditsToUse
  };
}
```

---

## 🔄 FLUJOS DE USUARIO ACTUALIZADOS

### Flujo 1: Depósito de Semana para Créditos

```
1. Usuario navega a "My Weeks"
2. Selecciona una semana disponible
3. Click en "Convert to Credits"
4. Sistema calcula:
   - Temporada (RED/WHITE/BLUE)
   - Multiplicador de ubicación (tier del hotel)
   - Multiplicador de tipo de habitación
   - TOTAL CREDITS generados
5. Muestra preview del cálculo
6. Usuario confirma conversión
7. Semana marcada como "deposited_for_credits"
8. Wallet actualizado con nuevos créditos
9. Transacción registrada en credit_transactions
```

### Flujo 2: Reserva con Créditos (Conversión Hotel)

```
1. Usuario busca en "Browse Hotels" o "Marketplace"
2. Selecciona propiedad, fechas, tipo de habitación
3. Sistema calcula costo en créditos por noche
4. Muestra desglose:
   - Noche 1: 150 credits (RED season)
   - Noche 2: 150 credits (RED season)
   - Noche 3: 90 credits (WHITE season)
   - TOTAL: 390 credits
5. Usuario ve su wallet balance
6. SI balance suficiente:
   → Procede con reserva usando solo créditos
7. SI balance insuficiente:
   → Sistema ofrece pago híbrido
   → "Use 300 credits + pay €90 with card"
8. Usuario acepta y procesa pago (Stripe)
9. Booking creado, créditos deducidos
10. Settlement record creado si es inter-property
```

### Flujo 3: Add-ons (Ancillary Services)

```
1. Durante checkout de booking (créditos o efectivo)
2. Sistema muestra available ancillary services:
   - Half-Board: 50 credits/day o €50/day
   - Restaurant Credit: 30 credits o €30
   - Spa Access: 40 credits o €40
3. Usuario selecciona servicios deseados
4. Sistema suma costo adicional
5. Aplica payment method seleccionado:
   - Todo créditos
   - Todo efectivo
   - Mixto
6. Booking incluye ancillary services
```

---

## 🛠️ COMPONENTES TÉCNICOS NUEVOS

### Backend - Nuevos Servicios

#### 1. `CreditCalculationService`
```typescript
class CreditCalculationService {
  calculateDepositCredits(weekId: number): Promise<DepositResult>
  calculateBookingCost(bookingParams: BookingParams): Promise<CostResult>
  getSeasonForDate(propertyId: number, date: Date): Promise<Season>
  applyCreditMultipliers(base: number, multipliers: Multipliers): number
  calculateExpirationDate(depositDate: Date): Date // Returns depositDate + 180 days
  checkAndExpireCredits(userId: number): Promise<ExpiredCreditsResult>
}
```

#### 2. `CreditWalletService`
```typescript
class CreditWalletService {
  getUserWallet(userId: number): Promise<Wallet>
  creditWallet(userId: number, amount: number, source: TransactionSource): Promise<Transaction>
  debitWallet(userId: number, amount: number, source: TransactionSource): Promise<Transaction>
  reserveCredits(userId: number, amount: number): Promise<void>
  releaseReservedCredits(userId: number, amount: number): Promise<void>
  getTransactionHistory(userId: number, filters?: Filters): Promise<Transaction[]>
}
```

#### 3. `HybridPaymentService`
```typescript
class HybridPaymentService {
  calculateHybridPayment(userId: number, totalCost: number): Promise<PaymentBreakdown>
  processHybridPayment(userId: number, credits: number, cashAmount: number): Promise<PaymentResult>
  getCreditToEuroRate(): number // Configurable
}
```

#### 4. `SettlementService`
```typescript
class SettlementService {
  createSettlementRecord(booking: Booking): Promise<Settlement>
  calculateInterPropertyDebt(bookingId: number): Promise<DebtCalculation>
  getSettlementReport(propertyId: number, dateRange: DateRange): Promise<SettlementReport>
  markSettlementPaid(settlementId: number): Promise<void>
}
```

#### 5. `AncillaryServiceService`
```typescript
class AncillaryServiceService {
  getAvailableServices(propertyId: number): Promise<AncillaryService[]>
  addServiceToBooking(bookingId: number, serviceId: number, quantity: number): Promise<void>
  calculateServiceCost(serviceId: number, quantity: number, paymentMethod: PaymentMethod): Promise<Cost>
}
```

### Frontend - Nuevas Vistas/Componentes

#### 1. **Credit Wallet Dashboard**
```
- Balance actual de créditos
- Créditos reservados (pending bookings)
- Historial de transacciones
- Gráfico de uso de créditos
- Botón "Convert Week to Credits"
```

#### 2. **Week Conversion Modal**
```
- Selector de semana a convertir
- Preview de cálculo:
  • Season: RED (1000 base)
  • Location: DIAMOND (×1.5)
  • Room Type: Junior Suite (×1.5)
  • Total: 2,250 credits
- Botón de confirmación
```

#### 3. **Credit Booking Flow**
```
- Buscador con precios en créditos
- Cards de habitaciones mostrando:
  • Credits/night
  • Total credits por estadía
  • Cash equivalent (opcional)
- Checkout con hybrid payment option
```

#### 4. **Hybrid Payment Component**
```
- Wallet balance display
- Cost breakdown:
  • Credits available: 500
  • Credits needed: 800
  • Shortfall: 300 credits
  • Cash required: €300
- Stripe payment form para diferencia
- Botón "Complete Booking"
```

#### 5. **Ancillary Services Selector**
```
- Lista de servicios disponibles
- Toggle: Pay with Credits / Pay with Cash
- Quantity selector
- Add to booking button
- Total cost update (créditos + efectivo)
```

#### 6. **Staff: Settlement Dashboard**
```
- Pending settlements
- Settlement history
- Filter by property, date range
- Export to CSV for accounting
- Mark as paid functionality
```

---

## 📊 CONFIGURACIÓN INICIAL REQUERIDA

### 1. Property Tiers
```sql
INSERT INTO property_tiers (name, multiplier, display_order) VALUES
('DIAMOND', 1.5, 1),
('GOLD_HIGH', 1.3, 2),
('GOLD', 1.2, 3),
('SILVER_PLUS', 1.1, 4),
('STANDARD', 1.0, 5);
```

### 2. Asignar Tiers a Propiedades
```sql
UPDATE properties SET tier_id = (SELECT id FROM property_tiers WHERE name='DIAMOND')
WHERE name IN ('Green Park Hotel', 'Hotel Perla');

UPDATE properties SET tier_id = (SELECT id FROM property_tiers WHERE name='GOLD_HIGH')
WHERE name = 'Sport Hotel Astoria';

-- ... etc
```

### 3. Room Type Multipliers
```sql
INSERT INTO room_type_multipliers (room_type_id, multiplier) VALUES
((SELECT id FROM room_types WHERE name='Standard'), 1.0),
((SELECT id FROM room_types WHERE name='Superior'), 1.2),
((SELECT id FROM room_types WHERE name='Deluxe'), 1.5),
((SELECT id FROM room_types WHERE name='Suite'), 2.0);
```

### 4. Seasonal Calendar (Por Propiedad)
```sql
-- Ejemplo para una propiedad
INSERT INTO seasonal_calendar (property_id, start_date, end_date, season_type, base_value) VALUES
(1, '2025-12-20', '2026-01-10', 'RED', 1000),
(1, '2026-07-01', '2026-08-31', 'RED', 1000),
(1, '2026-02-01', '2026-03-31', 'WHITE', 600),
(1, '2026-05-01', '2026-06-30', 'WHITE', 600),
(1, '2026-01-11', '2026-01-31', 'BLUE', 300),
(1, '2026-04-01', '2026-04-30', 'BLUE', 300);
```

### 5. Credit Booking Costs (Tarifas Base)
```sql
-- Ejemplo: Costo base por noche en créditos
INSERT INTO credit_booking_costs (property_id, room_type_id, season_type, base_rate_credits) VALUES
(1, 1, 'RED', 150),   -- Standard en temporada alta
(1, 1, 'WHITE', 100), -- Standard en temporada media
(1, 1, 'BLUE', 50),   -- Standard en temporada baja
(1, 2, 'RED', 200),   -- Deluxe en temporada alta
-- ... etc
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: Foundation (Semana 1) - 5-7 días
**Objetivo:** Base de datos y lógica de cálculo

- [ ] Crear todas las migraciones de nuevas tablas (incluyendo expiration tracking)
- [ ] Seeders para property_tiers, room_type_multipliers
- [ ] CreditCalculationService (depósito, reserva, y expiración)
- [ ] CreditWalletService (básico)
- [ ] Modelo Sequelize para todas las nuevas tablas
- [ ] Tests unitarios para cálculos
- [ ] Cron job para revisar créditos expirados (daily at 00:00)

**Entregable:** Backend puede calcular créditos correctamente y manejar expiración

### FASE 2: Deposit Flow (Semana 2) - 4-5 días
**Objetivo:** Convertir semanas en créditos

- [ ] Endpoint: POST /api/weeks/:id/convert-to-credits
- [ ] Endpoint: GET /api/users/:id/wallet
- [ ] Endpoint: GET /api/users/:id/credit-transactions
- [ ] Frontend: Credit Wallet Dashboard (con indicador de expiración)
- [ ] Frontend: Week Conversion Modal (muestra fecha de expiración de créditos)
- [ ] Frontend: Expiration warnings (30, 7, 1 días antes)
- [ ] Tests de integración

**Entregable:** Usuario puede convertir semanas y ver wallet con fechas de expiración

### FASE 3: Credit Booking (Semana 2-3) - 5-7 días
**Objetivo:** Reservar usando créditos

- [ ] Actualizar búsqueda para mostrar precios en créditos
- [ ] Endpoint: POST /api/bookings (con payment_method='CREDITS')
- [ ] Lógica de deducción de wallet
- [ ] Frontend: Credit Booking Flow
- [ ] Frontend: Booking confirmation con desglose
- [ ] Tests E2E

**Entregable:** Usuario puede reservar usando solo créditos

### FASE 4: Hybrid Payments (Semana 3) - 4-5 días
**Objetivo:** Créditos + Efectivo

- [ ] HybridPaymentService completo
- [ ] Endpoint: POST /api/bookings (payment_method='MIXED')
- [ ] Integración Stripe para diferencia
- [ ] Frontend: Hybrid Payment Component
- [ ] Tests de pagos mixtos

**Entregable:** Usuario puede complementar con tarjeta

### FASE 5: Ancillary Services (Semana 3-4) - 3-4 días
**Objetivo:** Add-ons durante checkout

- [ ] AncillaryServiceService
- [ ] Endpoints CRUD para ancillary_services
- [ ] Endpoint: POST /api/bookings/:id/ancillary-services
- [ ] Frontend: Services Selector en checkout
- [ ] Tests

**Entregable:** Usuario puede agregar servicios

### FASE 6: Settlement & Reporting (Semana 4) - 3-4 días
**Objetivo:** Liquidación entre propiedades

- [ ] SettlementService completo
- [ ] Crear settlement records automáticamente
- [ ] Endpoint: GET /api/settlements (staff)
- [ ] Endpoint: PATCH /api/settlements/:id/mark-paid
- [ ] Frontend: Settlement Dashboard (staff)
- [ ] Reportes exportables

**Entregable:** Staff puede ver y gestionar liquidaciones

### FASE 7: Testing & Refinement (Semana 4) - 2-3 días
**Objetivo:** Simulaciones reales

- [ ] Scenario 1: RED Rimini → WHITE Madonna di Campiglio
- [ ] Scenario 2: Junior Suite Alta Badia con top-up
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentation final

**Entregable:** Sistema listo para beta testing

---

## ⚠️ RIESGOS Y CONSIDERACIONES

### 1. Complejidad de Cálculos
**Riesgo:** Errores en multiplicadores causan valores incorrectos  
**Mitigación:** 
- Tests exhaustivos con casos edge
- Guardar metadata de cada cálculo (auditable)
- Admin panel para revisar cálculos

### 2. Race Conditions en Wallet
**Riesgo:** Dos transacciones simultáneas corrompen balance  
**Mitigación:**
- Usar database transactions con locking
- Implementar optimistic locking
- Sistema de "reserved_credits" para bookings pending

### 3. Conversión Créditos ↔ Euros
**Riesgo:** Tasa de cambio no está clara  
**Acción Requerida:** **CLIENTE DEBE DEFINIR:**
- ¿1 crédito = €1?
- ¿Es variable según hotel/temporada?
- ¿Hay mínimo/máximo de cash top-up?

### 4. Política de Reembolsos
**Riesgo:** ¿Qué pasa si se cancela booking pagado con créditos?  
**Acción Requerida:** **CLIENTE DEBE DEFINIR:**
- ¿Créditos regresan al wallet?
- ¿Se pierde un porcentaje?
- ¿Política diferente según timing de cancelación?

### 3. Expiración de Créditos
**Riesgo:** Créditos pueden acumularse indefinidamente  
**RESPUESTA RECIBIDA:** ✅ **Créditos expiran después de 6 meses**  
**Mitigación:**
- Implementar cron job diario para expirar créditos automáticamente
- Sistema de notificaciones (30, 7, 1 días antes de expirar)
- UI muestra claramente fechas de expiración
- Transacciones de tipo 'EXPIRATION' registradas en historial
- Política de "usar primero los que expiran primero" (FIFO)

### 6. Fraude/Abuse
**Riesgo:** Usuarios intentan manipular sistema  
**Mitigación:**
- Todas transacciones registradas
- Admin puede ver historial completo
- Flags automáticos para patrones sospechosos

### 7. Settlement Delays
**Riesgo:** Hotels externos esperan pago, nosotros tenemos cash flow negativo  
**Mitigación:**
- Require depósito inicial de hotels externos
- Settlement automático mensual
- Dashboard de accounts payable

### 8. PMS Migration (Mews → HotelCube)
**Riesgo:** Cambio de PMS puede romper integración  
**Mitigación:**
- Implementar PMS abstraction layer desde inicio
- Interface común para todas las operaciones PMS
- Adapters pattern para cada PMS provider
- Testing exhaustivo antes de switch a producción
- Mantener Mews como fallback durante transición
- Documentar diferencias entre APIs de Mews y HotelCube

---

---

## ✅ ANSWERED QUESTIONS SUMMARY

Based on client's latest communication, the following has been clarified:

### 1. Credit Expiration: **6 MONTHS**
- Credits expire 180 days after deposit date
- System must track expiration per credit deposit
- Need to implement expiration checker (daily cron job)
- Notification system before expiration (recommended: 30, 7, 1 days before)

### 2. Hotel Integration: **PMS + Platform Account**
- Hotels integrate via their existing PMS
- **Current PMS: Mews (TEMPORARY)** - for testing environment with transaction support
- **Target PMS: HotelCube** (https://www.hotelcube.eu/en/pms-hotelcube/) - production system
- Hotels must create account on platform to manage properties
- Same "Reference Only" architecture as current system
- Real-time data from PMS, local DB stores only mappings
- **Architecture must support multiple PMS providers** (abstraction layer required)

### 3. Credit Rates: **Formula-Based (Dynamic)**
- All numeric values mentioned are examples only
- System must calculate rates using multiplier formulas:
  - **Deposit:** Credits = [Base_Season] × [Location_Multiplier] × [Room_Type_Multiplier]
  - **Booking:** Nightly Cost = [Base_Rate] × [Room_Type_Multiplier]
- "Member Only" credit rates independent of public pricing
- Rates are calculated dynamically, not stored as fixed values

### 4. Week Acquisition: **Existing Ownership Import** ✅
- **All weeks are ALREADY SOLD** - users are existing timeshare owners
- Client has a **current database** with ownership records
- Need **Ownership Verification/Import System**:
  - Admin imports existing weeks from legacy database
  - Users register and "claim" or are assigned their weeks
  - Verification codes or manual admin approval
- **Marketplace** is secondary: for reselling weeks or direct bookings
- **PMS does NOT provide weeks** - only manages hotel room availability

**Implementation Approach:**
1. **Phase 1 (Immediate):** Admin manual import/assignment system
2. **Phase 2 (Short-term):** User claim system with verification codes
3. **Phase 3 (Future):** Automated verification (QR codes, documents, etc.)

### 5. Credit to Euro Rate: **1 Credit = €1 (Admin Configurable)** ✅
- Initial rate: **1:1 (1 Credit = 1 Euro)**
- **CRITICAL:** Must be admin-configurable without code changes
- System must support rate changes at any time
- All calculations reference dynamic rate from settings table
- Historical rate tracking for audit purposes

### 6. Cancellation Policy: **Dual Logic** ✅
- **Hotel/Credit Bookings:** Standard hotel cancellation policy
  - Sliding scale refund based on days before check-in
  - Credits returned to wallet with same expiration date
  - Follows industry-standard hotel practices
  
- **Week Swaps (P2P):** **FINAL - NO RETURNS**
  - Once swap is confirmed by both parties, it's permanent
  - Cannot cancel to get original week back
  - Point of no return after confirmation
  - Warning prompts before confirmation

### 7. Calendar Management: **Role-Based Control** ✅
- **Central Admin Controls:**
  - All multipliers (Location, Room Type)
  - Seasonal Calendar (Red/White/Blue date mapping)
  - Credit Tables and base values
  - Global system settings
  
- **Property Staff Controls:**
  - Room availability (like Booking.com)
  - Blackout dates (when hotel is full/closed)
  - Local property settings
  - Cannot override central multipliers

### 8. Credit Rate Updates: **Admin Configurable** ✅
- Central Admin sets base credit cost rules
- System applies rules automatically to all properties
- Admin can update credit costs per room type as needed
- Changes take effect immediately or on scheduled date
- Audit log of all rate changes

---

## 📝 CRITICAL QUESTIONS FOR CLIENT

### MOST URGENT - Required to proceed with implementation:

**0. WEEK ACQUISITION - How do users initially obtain "weeks"?** ✅ **ANSWERED**
   - ✅ **All weeks are ALREADY SOLD** - existing timeshare ownership
   - ✅ **Ownership Verification/Import System Required**
   - Client has existing database with ownership records
   - Users will register and "claim" their weeks or be assigned by admin
   - Marketplace is for reselling weeks to new users (secondary function)
   
   **REMAINING CLARIFICATIONS NEEDED:**
   - What data fields exist in current/legacy database?
   - Preferred verification method (codes, documents, QR, manual admin approval)?
   - Timeline for legacy data import/migration?
   - Should system support bulk CSV import for weeks?

---

### URGENT - Necessary to advance with development:

**1. Credits → Euros Conversion Rate** ✅ **ANSWERED**
   - ✅ **Initial rate: 1 Credit = €1 (1:1 ratio)**
   - ✅ **MUST be admin-configurable** - rate can change at any time
   - System must reference dynamic rate from platform_settings table
   - No code changes required to update rate in future
   
   **REMAINING:** Historical rate tracking for transactions at different rates?

**2. Cancellation Policy with Credits** ✅ **ANSWERED**
   - ✅ **Hotel/Credit Bookings:** Standard sliding scale refund (like normal hotels)
   - ✅ **Week Swaps (P2P):** **FINAL - NO CANCELLATION** once confirmed
   - Credits returned maintain original expiration date
   
   **REMAINING:** Exact refund percentages by timeframe (30/15/7/1 days before)?

**3. Credit Expiration** ✅ **ANSWERED**
   - **Credits expire after 6 months from deposit date**
   - Extensions: NOT SPECIFIED (need clarification)
   - Expiration reminder notifications: NOT SPECIFIED (need clarification)
   - Grace period before expiration: NOT SPECIFIED (need clarification)

**4. Minimum/Maximum Transaction Limits**
   - Minimum credits required to deposit a week?
   - Minimum credits required to make a booking?
   - Maximum credits allowed per user wallet?
   - Any transaction limits per day/month?

**5. Seasonal Calendar Management** ✅ **ANSWERED**
   - ✅ **Central Admin controls:** Seasonal calendars (Red/White/Blue mapping)
   - ✅ **Property Staff controls:** Availability and blackout dates
   - Central admin sets multipliers and credit tables
   - Property staff manages which dates are bookable (like Booking.com)
   
   **REMAINING:** Calendar per property or shared by region? Update frequency?

**6. External Hotels Integration** ✅ **PARTIALLY ANSWERED**
   - **Hotels integrate via PMS (Property Management System)**
   - **Hotels must create an account on the platform to manage their properties**
   - Settlement rate: NOT SPECIFIED (need clarification)
   - Billing cycle: NOT SPECIFIED (need clarification)
   - Veto power over credit bookings: NOT SPECIFIED (need clarification)
   - PMS integration same as current Mews implementation: ASSUMED

**7. Credit Rate per Room/Night** ✅ **ANSWERED**
   - **All values are EXAMPLES only**
   - **System MUST use the dynamic formula based on multipliers:**
     - Deposit: Credits = [Base_Season] × [Location_Multiplier] × [Room_Type_Multiplier]
     - Booking: Nightly Cost = [Hotel_Base_Rate] × [Room_Type_Multiplier]
   - **"Member Only" credit rate independent of public Booking.com prices**
   - Who sets base rates: NOT SPECIFIED (need clarification - property managers or central admin?)
   - How often can rates be updated: NOT SPECIFIED

**8. Ancillary Services**
   - Initial list of services to include (Half-board, Full-board, Spa, Restaurant, etc.)?
   - Pricing in both credits AND cash for each service?
   - Are services property-specific or platform-wide?
   - Can properties add their own custom services?

**9. Admin Controls & Permissions**
   - What reports does staff need to see?
   - Should admins be able to manually adjust user wallets (add/remove credits)?
   - What events require notifications (low balance, expiring credits, etc.)?
   - Different permission levels for property staff vs. platform admins?

**10. Testing Scenarios & Data**
    - Do you need pre-loaded test data for beta testing?
    - How many test users should we create?
    - How many mock properties?
    - Specific real-world scenarios to test?

---

### ADDITIONAL IMPORTANT CLARIFICATIONS:

**11. Credit Transferability**
    - Can users transfer credits to other users?
    - Can family members pool credits together?
    - Are there transfer fees or limits?

**12. Partial Credit Usage**
    - Can credits be split across multiple bookings?
    - Can a single booking be split between two users' wallets?
    - Minimum credit spend per transaction?

**13. Blackout Dates**
    - Can hotels restrict credit redemption during peak seasons?
    - Who manages blackout dates (property or platform)?
    - Are blackout dates visible to users when depositing weeks?

**14. Member Tiers/Levels**
    - Are there different membership levels affecting credit values?
    - Do VIP members get better conversion rates?
    - Are there loyalty bonuses?

**15. Dispute Resolution**
    - What happens if a user disputes a credit deduction?
    - Process for handling calculation errors?
    - Who has final authority on credit adjustments?

---

## 💰 IMPACTO EN SISTEMA ACTUAL

### Compatibilidad con Sistema Existente

✅ **Mantiene:**
- Sistema P2P swap actual (Track 1)
- Marketplace de reservas con cash
- Staff approval workflows
- PMS sync architecture (abstraction layer)
- Stripe payments

🔄 **PMS Strategy:**
- Current: Mews API (test environment with transaction support)
- Target: HotelCube (production PMS)
- Architecture: PMS-agnostic abstraction layer
- Supports multiple PMS providers simultaneously
- Easy migration path from Mews → HotelCube

🆕 **Agrega:**
- Credit wallet system (Track 2)
- Hybrid payments
- Ancillary services (Track 3)
- Settlement tracking
- Week ownership verification system
- Admin configuration system (dynamic settings)

⚠️ **Modifica:**
- Booking creation (ahora soporta 3 payment methods)
- Week management (ahora puede convertirse a créditos)
- User dashboard (ahora incluye wallet)

### Migration Strategy

**Para Datos Existentes:**
- Bookings actuales quedan como están (payment_method='CASH')
- Weeks existentes NO convertidos automáticamente
- Usuarios tienen wallet iniciado en 0 créditos
- No breaking changes en funcionalidad actual

---

## 📈 MÉTRICAS DE ÉXITO

Para considerar el sistema exitoso en beta testing:

1. **Precisión de Cálculos:** 100% de cálculos correctos verificados
2. **Performance:** Cálculo de créditos < 200ms
3. **Conversión de Semanas:** Al menos 10 conversiones exitosas
4. **Bookings con Créditos:** Al menos 5 reservas completadas
5. **Hybrid Payments:** Al menos 3 pagos mixtos exitosos
6. **Settlement Reports:** Reportes generados correctamente
7. **Zero Discrepancies:** Balance de wallet = Suma de transacciones

---

## 🎯 TIMELINE CONSOLIDADO

```
Semana 1: Database + Core Logic
├─ Día 1-2: Migraciones y seeders
├─ Día 3-4: Services (calculation, wallet)
├─ Día 5-6: Tests unitarios
└─ Día 7: Review & ajustes

Semana 2: Deposit & Credit Booking
├─ Día 8-9: Deposit endpoints + frontend
├─ Día 10-11: Credit booking endpoints
├─ Día 12-13: Frontend booking flow
└─ Día 14: Integration tests

Semana 3: Hybrid Payments & Ancillary
├─ Día 15-17: Hybrid payment system completo
├─ Día 18-19: Ancillary services
└─ Día 20-21: Tests E2E

Semana 4: Settlement & Testing
├─ Día 22-23: Settlement service + dashboard
├─ Día 24-25: Real-world simulations
├─ Día 26-27: Bug fixes & refinement
└─ Día 28: Documentation & handoff

TOTAL: 28 días (4 semanas) para sistema completo
```

---

## 🔧 SETUP TÉCNICO ADICIONAL

### Environment Variables Nuevas
```env
# Credit System
CREDIT_TO_EURO_RATE=1.0
ENABLE_CREDIT_EXPIRATION=true
CREDIT_EXPIRATION_DAYS=180
MIN_CREDIT_TRANSACTION=10
MAX_WALLET_CREDITS=50000

# Settlement
SETTLEMENT_BILLING_CYCLE=MONTHLY
AUTO_SETTLEMENT_ENABLED=false
EXTERNAL_HOTEL_COMMISSION_RATE=0.15
```

### Nuevos Permisos de Usuario
```sql
INSERT INTO permissions (name, description) VALUES
('credits.view', 'View credit wallet and transactions'),
('credits.deposit', 'Convert weeks to credits'),
('credits.spend', 'Use credits for bookings'),
('credits.admin_adjust', 'Manually adjust user credits'),
('settlements.view', 'View settlement reports'),
('settlements.manage', 'Mark settlements as paid'),
('ancillary.manage', 'Create/edit ancillary services');
```

---

## 📚 DOCUMENTACIÓN A CREAR

1. **API Documentation:**
   - Credit Wallet Endpoints
   - Booking with Credits Endpoints
   - Settlement Endpoints
   - Ancillary Services Endpoints

2. **User Guides:**
   - How to Convert Weeks to Credits
   - How to Book with Credits
   - Understanding Hybrid Payments
   - Adding Services to Your Booking

3. **Staff Guides:**
   - Managing Seasonal Calendar
   - Reviewing Settlement Reports
   - Handling Credit-Related Issues
   - Creating Ancillary Services

4. **Technical Documentation:**
   - Credit Calculation Logic
   - Database Schema for Credits System
   - Settlement Flow Diagrams
   - Testing Procedures

---

## 🔌 PMS INTEGRATION STRATEGY

### Current State: Mews (Temporary)
- **Purpose:** Test environment with full transaction support
- **Duration:** Until production ready
- **Benefits:** Established integration, well-documented API, reliable test data

### Target State: HotelCube (Production)
- **Website:** https://www.hotelcube.eu/en/pms-hotelcube/
- **Purpose:** Production PMS for client's properties
- **Timeline:** Migration after credit system testing phase
- **Requirements:** API documentation, test credentials, migration plan

### Implementation Architecture: PMS-Agnostic Layer

```typescript
// Abstract PMS Interface
interface IPMSProvider {
  // Room Operations
  getRooms(propertyId: string): Promise<Room[]>
  getRoomAvailability(roomId: string, dates: DateRange): Promise<Availability>
  getRoomDetails(roomId: string): Promise<RoomDetails>
  
  // Booking Operations
  createBooking(booking: BookingData): Promise<BookingResult>
  updateBooking(bookingId: string, updates: BookingUpdates): Promise<void>
  cancelBooking(bookingId: string): Promise<void>
  
  // Property Operations
  getProperties(): Promise<Property[]>
  getPropertyDetails(propertyId: string): Promise<PropertyDetails>
  
  // Rate Operations
  getRates(roomId: string, dates: DateRange): Promise<RateInfo>
}

// Mews Implementation (Current)
class MewsPMSProvider implements IPMSProvider {
  // Implementación específica de Mews API
}

// HotelCube Implementation (Target)
class HotelCubePMSProvider implements IPMSProvider {
  // Implementación específica de HotelCube API
  // A desarrollar una vez tengamos acceso a la API
}

// PMS Factory
class PMSFactory {
  static getProvider(type: 'mews' | 'hotelcube'): IPMSProvider {
    switch(type) {
      case 'mews': return new MewsPMSProvider()
      case 'hotelcube': return new HotelCubePMSProvider()
    }
  }
}
```

### Migration Checklist

#### Phase 1: Preparation (During Mews testing)
- [ ] Design PMS abstraction interface
- [ ] Refactor current Mews code to use interface
- [ ] Document all PMS operations used
- [ ] Identify HotelCube API endpoints needed
- [ ] Request HotelCube API credentials and documentation

#### Phase 2: HotelCube Integration (Parallel development)
- [ ] Study HotelCube API documentation
- [ ] Implement HotelCubePMSProvider class
- [ ] Create test suite for HotelCube operations
- [ ] Test in isolated environment
- [ ] Compare data consistency between Mews and HotelCube

#### Phase 3: Gradual Migration
- [ ] Setup HotelCube test property
- [ ] Run parallel sync (Mews + HotelCube) for comparison
- [ ] Validate data accuracy
- [ ] Switch one property to HotelCube only
- [ ] Monitor for issues
- [ ] Gradually migrate remaining properties

#### Phase 4: Deprecate Mews
- [ ] All properties on HotelCube
- [ ] Remove Mews dependencies
- [ ] Keep Mews adapter code for reference
- [ ] Update documentation

### Database Considerations

```sql
-- Properties table already supports multiple PMS
ALTER TABLE properties 
ADD COLUMN pms_provider ENUM('mews', 'hotelcube', 'other') DEFAULT 'mews',
ADD COLUMN pms_property_id VARCHAR(255), -- ID in external PMS
ADD COLUMN pms_api_credentials JSON; -- Encrypted credentials

-- Track which PMS synced each room
ALTER TABLE rooms
ADD COLUMN pms_provider ENUM('mews', 'hotelcube', 'other') DEFAULT 'mews',
ADD COLUMN pms_sync_metadata JSON; -- Provider-specific data
```

### Risk Mitigation

**Risk 1:** HotelCube API differs significantly from Mews  
**Mitigation:** Abstraction layer handles differences, each provider implements interface contract

**Risk 2:** Data loss during migration  
**Mitigation:** Parallel running period, data validation, rollback capability

**Risk 3:** Performance differences  
**Mitigation:** Benchmark both APIs, optimize slow operations, implement caching

**Risk 4:** API rate limits  
**Mitigation:** Implement request throttling, batch operations, queue system

### Key Differences to Investigate

Questions for HotelCube API review:
1. Room data structure format
2. Availability check mechanism
3. Booking creation flow
4. Rate/pricing data format
5. Authentication method (OAuth, API key, etc.)
6. Webhook support for real-time updates
7. Rate limits and quotas
8. Error handling and response codes
9. Pagination for large datasets
10. Support for test/sandbox environment

---

## 🎬 CONCLUSIÓN Y PRÓXIMOS PASOS

### Resumen de Cambios

**Sistema Actual:** Night swap P2P con fee fijo  
**Sistema Propuesto:** Triple-track (P2P + Credit booking + Ancillary) con valuación dinámica

**Complejidad Agregada:** Alta  
**Beneficio para el Negocio:** Muy Alto (nuevo revenue stream, mejor utilización de inventario)

### Inmediatos Next Steps

1. **CLIENTE:** Responder preguntas pendientes (arriba)
2. **CLIENTE:** Aprobar o ajustar timeline propuesto
3. **CLIENTE:** Proveer data para seasonal calendar
4. **DESARROLLO:** Comenzar Fase 1 (Foundation) una vez aprobado
5. **DESARROLLO:** Setup environment y permisos

### Recomendaciones

1. **Priorizar MVP:** Empezar con funcionalidad core, luego refinements
2. **Beta Testing:** Grupo cerrado de 5-10 usuarios antes de lanzamiento
3. **Phased Rollout:** Habilitar créditos gradualmente por propiedad
4. **Monitoring:** Dashboard de métricas desde día 1
5. **Support Ready:** Documentar FAQs antes del launch

---

**¿Procedo con implementación al recibir aprobación y respuestas?**

Estoy listo para comenzar inmediatamente con la Fase 1 (Foundation) si el plan es aprobado.
