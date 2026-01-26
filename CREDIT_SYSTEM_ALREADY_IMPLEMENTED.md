# ✅ Sistema de Créditos - Estado de Implementación

**Fecha:** 25 de Enero, 2026  
**Estado:** Sistema de cálculo dinámico **YA IMPLEMENTADO**

---

## ✅ LO QUE YA TENEMOS IMPLEMENTADO

### 1. CreditCalculationService (COMPLETO) ✅

**Ubicación:** `backend/src/services/CreditCalculationService.ts`

#### Fórmula Implementada

```
DEPÓSITO DE SEMANA:
Credits = BASE_SEASON × TIER_MULTIPLIER × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER

BOOKING/COSTO:
Cost per night = BASE_RATE × ROOM_MULTIPLIER × TIER_MULTIPLIER × LOCATION_MULTIPLIER
Total Cost = Cost_per_night × nights
```

#### Valores Base Implementados

```typescript
// Season Base Values
RED: 1000     // Alta temporada
WHITE: 600    // Media temporada
BLUE: 300     // Baja temporada

// Property Tiers
DIAMOND: 1.5×       // Propiedades premium
GOLD: 1.3×          // Propiedades alta calidad
SILVER_PLUS: 1.1×   // Sobre estándar
STANDARD: 1.0×      // Estándar

// Room Type Multipliers
PRESIDENTIAL: 2.5×  // Penthouse
SUITE: 2.0×         // 3 habitaciones
DELUXE: 1.5×        // 2 habitaciones
SUPERIOR: 1.2×      // 1 habitación
STANDARD: 1.0×      // Studio
```

#### Métodos Disponibles

```typescript
// 1. Calcular créditos al depositar semana
async calculateDepositCredits(weekId: number): Promise<{
  credits: number;
  breakdown: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
    propertyName: string;
    propertyTier: string;
    roomType: string;
  };
}>;

// 2. Calcular costo de booking
async calculateBookingCost(
  propertyId: number,
  roomType: string,
  seasonType: 'RED' | 'WHITE' | 'BLUE',
  nights: number,
  checkInDate?: Date
): Promise<{
  totalCredits: number;
  creditsPerNight: number;
  nights: number;
  breakdown: {...};
}>;

// 3. Calcular pago híbrido (créditos + cash)
async calculateHybridPayment(
  availableCredits: number,
  requiredCredits: number
): Promise<{
  creditsUsed: number;
  cashRequired: number;  // en euros
  creditShortfall: number;
}>;

// 4. Estimar créditos ANTES de depositar
async estimateCreditsForWeek(
  propertyId: number,
  accommodationType: string,
  seasonType: 'RED' | 'WHITE' | 'BLUE'
): Promise<{
  estimatedCredits: number;
  breakdown: {...};
}>;

// 5. Conversión créditos ↔ euros
async convertCreditsToEuros(credits: number): Promise<number>;
async convertEurosToCredits(euros: number): Promise<number>;

// 6. Calcular diferencia en swaps
async calculateSwapDifference(
  depositedWeekId: number,
  requestedPropertyId: number,
  requestedRoomType: string,
  requestedSeasonType: 'RED' | 'WHITE' | 'BLUE',
  requestedNights: number
): Promise<{
  deposited_credits: number;
  required_credits: number;
  credit_difference: number;
  requires_payment: boolean;
  payment_amount_credits: number;
}>;
```

### 2. Ejemplos de Cálculo Reales

#### Ejemplo 1: Semana Premium en Alta Temporada

```
Datos:
- Season: RED (alta temporada)
- Property: Green Park Hotel (DIAMOND tier, location 1.2×)
- Room: DELUXE (2 bedroom)

Cálculo:
Credits = 1000 (RED) × 1.5 (DIAMOND) × 1.2 (location) × 1.5 (DELUXE)
Credits = 2,700 créditos
```

#### Ejemplo 2: Semana Estándar en Media Temporada

```
Datos:
- Season: WHITE (media temporada)
- Property: Hotel Rimini (STANDARD tier, location 1.0×)
- Room: STANDARD (studio)

Cálculo:
Credits = 600 (WHITE) × 1.0 (STANDARD) × 1.0 (location) × 1.0 (STANDARD)
Credits = 600 créditos
```

#### Ejemplo 3: Booking con Pago Híbrido

```
Escenario:
- Owner tiene: 500 créditos en wallet
- Booking requiere: 800 créditos
- Tasa conversión: 1 crédito = 1 euro

Resultado de calculateHybridPayment():
{
  creditsUsed: 500,
  creditShortfall: 300,
  cashRequired: 300 euros
}

Owner paga: 500 créditos + €300
```

---

## 🆕 LO QUE NECESITAMOS CREAR PARA EL NUEVO SISTEMA

### 1. InventoryService (NUEVO)

**Propósito:** Gestionar pool unificado de semanas disponibles

```typescript
class InventoryService {
  // Agregar semana al inventario (cuando owner la libera)
  async addWeekToInventory(
    weekId: number,
    creditPrice: number  // ← Usar CreditCalculationService.calculateDepositCredits()
  ): Promise<InventoryItem>;

  // Buscar semanas disponibles
  async searchAvailableWeeks(filters: {
    startDate?: Date;
    endDate?: Date;
    propertyId?: number;
    accommodationType?: string;
    minCredits?: number;
    maxCredits?: number;
  }): Promise<InventoryItem[]>;

  // Reservar temporalmente (durante checkout)
  async reserveWeek(
    inventoryItemId: number,
    ownerId: number,
    expiresInMinutes: number = 15
  ): Promise<void>;

  // Confirmar booking
  async confirmBooking(
    inventoryItemId: number,
    bookingId: number
  ): Promise<void>;
}
```

### 2. WeekReleaseService (NUEVO)

**Propósito:** Convertir semanas en créditos (wrapper del sistema existente)

```typescript
class WeekReleaseService {
  /**
   * Calcula valor de semana
   * ✅ INTERNAMENTE USA: CreditCalculationService.calculateDepositCredits()
   */
  async calculateWeekValue(weekId: number): Promise<{
    credits: number;
    breakdown: {...};
  }> {
    // ✅ Delegar al servicio existente
    const result = await CreditCalculationService.calculateDepositCredits(weekId);
    return {
      credits: result.credits,
      breakdown: result.breakdown
    };
  }

  /**
   * Libera semana y asigna créditos
   * ✅ USA: CreditCalculationService + CreditWalletService (existentes)
   */
  async releaseWeek(
    weekId: number,
    ownerId: number
  ): Promise<ReleaseResult> {
    return sequelize.transaction(async (tx) => {
      // 1. Calcular créditos (✅ usa servicio existente)
      const { credits } = await CreditCalculationService.calculateDepositCredits(weekId);
      
      // 2. Agregar a inventario (🆕 nuevo)
      const item = await InventoryService.addWeekToInventory(weekId, credits, tx);
      
      // 3. Asignar créditos a wallet (✅ usa servicio existente)
      await CreditWalletService.deposit(
        ownerId,
        credits,
        'WEEK_RELEASE',
        `Released week #${weekId}`,
        tx
      );
      
      return { credits, itemId: item.id };
    });
  }

  /**
   * Estimación SIN liberar
   * ✅ USA: CreditCalculationService.estimateCreditsForWeek() existente
   */
  async estimateReleaseValue(weekId: number): Promise<number> {
    const week = await Week.findByPk(weekId);
    // ✅ Delegar al servicio existente
    const result = await CreditCalculationService.estimateCreditsForWeek(
      week.property_id,
      week.accommodation_type,
      week.season_type
    );
    return result.estimatedCredits;
  }
}
```

### 3. CreditBookingService (NUEVO)

**Propósito:** Booking con créditos (wrapper del sistema existente)

```typescript
class CreditBookingService {
  /**
   * Calcula opciones de pago
   * ✅ USA: CreditCalculationService y CreditWalletService existentes
   */
  async calculatePaymentOptions(
    ownerId: number,
    creditPrice: number
  ): Promise<{
    availableCredits: number;
    requiredCredits: number;
    difference: number;
    options: PaymentOption[];
  }> {
    // ✅ Obtener balance (servicio existente)
    const wallet = await CreditWalletService.getWallet(ownerId);
    const available = wallet.available_balance;
    
    const difference = available - creditPrice;
    
    // ✅ Si faltan créditos, calcular cash (servicio existente)
    let cashOption = null;
    if (difference < 0) {
      const hybrid = await CreditCalculationService.calculateHybridPayment(
        available,
        creditPrice
      );
      cashOption = {
        type: 'credits_plus_cash',
        creditsUsed: hybrid.creditsUsed,
        cashAmount: hybrid.cashRequired,
        description: `Use ${hybrid.creditsUsed} credits + €${hybrid.cashRequired}`
      };
    }
    
    return { availableCredits: available, requiredCredits: creditPrice, difference, options: [...] };
  }

  /**
   * Ejecuta booking con créditos
   * ✅ USA: CreditWalletService existente
   */
  async bookWithCredits(request: BookingRequest): Promise<BookingResult> {
    return sequelize.transaction(async (tx) => {
      // 1. Validar y reservar inventario (🆕 nuevo)
      await InventoryService.reserveWeek(request.inventoryItemId, request.ownerId, tx);
      
      // 2. Deducir créditos (✅ servicio existente)
      await CreditWalletService.deduct(
        request.ownerId,
        request.useCredits,
        'BOOKING_PAYMENT',
        `Booking payment for inventory #${request.inventoryItemId}`,
        tx
      );
      
      // 3. Procesar pago cash si necesario (✅ servicio existente - Stripe)
      if (request.additionalPayment) {
        // Stripe payment...
      }
      
      // 4. Crear booking (🆕 nuevo)
      const booking = await Booking.create({...}, { tx });
      
      // 5. Confirmar inventario (🆕 nuevo)
      await InventoryService.confirmBooking(request.inventoryItemId, booking.id, tx);
      
      return { bookingId: booking.id, creditsUsed: request.useCredits, ... };
    });
  }
}
```

---

## 📊 Resumen: Qué Reutilizamos vs Qué Creamos

### ✅ REUTILIZAR (Ya Implementado)

| Componente | Función | Estado |
|------------|---------|--------|
| `CreditCalculationService` | Cálculo dinámico de créditos | ✅ Completo |
| `CreditWalletService` | Gestión de wallets y transacciones | ✅ Completo |
| Modelos de créditos | BD y Sequelize models | ✅ Completo |
| Fórmulas de cálculo | BASE × TIER × LOCATION × ROOM | ✅ Completo |
| Conversión €↔créditos | Tasa configurable | ✅ Completo |
| Pago híbrido | Créditos + cash | ✅ Completo |

### 🆕 CREAR (Nuevo para Sistema Simplificado)

| Componente | Función | Complejidad |
|------------|---------|-------------|
| `InventoryService` | Pool unificado de semanas | Media |
| `WeekReleaseService` | Wrapper de liberación | Baja (usa existentes) |
| `CreditBookingService` | Wrapper de booking | Baja (usa existentes) |
| `inventory_items` tabla | BD para inventario | Baja |
| Frontend: ReleaseModal | UI para liberar semana | Media |
| Frontend: InventorySearch | UI búsqueda tipo Booking.com | Alta |
| Frontend: CreditCheckout | UI checkout con créditos | Media |

---

## 🎯 Respuesta a Antonio

### ✅ Sobre el Pricing Dinámico

**Tu comentario:** "esto ya se había planteado anteriormente como una tarifa dinámica que depende de aspectos como la temporada y ya debe estar en alguno de los documentos de referencia como una fórmula, que ya está implementada"

**Confirmación:** ✅ CORRECTO

El sistema de cálculo dinámico **está completamente implementado** en:
- `backend/src/services/CreditCalculationService.ts`
- Fórmula: `Credits = BASE_SEASON × TIER × LOCATION × ROOM_TYPE`
- Base values: RED=1000, WHITE=600, BLUE=300
- Multiplicadores configurados y funcionales

**Lo que falta:**
- No falta lógica de cálculo ✅
- Solo falta:
  1. Crear `InventoryService` (pool de semanas)
  2. Crear wrappers (`WeekReleaseService`, `CreditBookingService`)
  3. Crear frontend (search + checkout)

**Beneficio:** Como el cálculo ya está implementado, el desarrollo del nuevo sistema será **MÁS RÁPIDO** de lo estimado inicialmente (6-7 semanas en lugar de 8-10).

---

## 📋 Preguntas Actualizadas para Antonio

### ✅ Ya No Necesitamos Preguntar:

1. ~~¿Cómo se calcula el pricing dinámico?~~ → YA IMPLEMENTADO ✅
2. ~~¿Qué factores afectan el cálculo?~~ → YA DEFINIDOS ✅
3. ~~¿Tabla de multiplicadores?~~ → YA EXISTE ✅

### ❓ Solo Necesitamos Confirmar:

1. **Reglas de Liberación**
   - ¿Todas las semanas pueden liberarse?
   - ¿Restricciones de tiempo? (ej: no liberar <30 días antes)
   - ¿Peak dates tienen reglas especiales?

2. **Monetización Externa**
   - ¿Semanas liberadas pueden venderse a guests externos?
   - ¿Qué comisión?
   - ¿Pricing diferente para guests vs owners?

3. **Migración**
   - ¿Qué hacer con SwapRequests activos?
   - ¿Timeline para deprecar sistema viejo?

---

## 🚀 Impacto en Timeline

### Timeline Original: 8-10 semanas

**Actualización:** 6-7 semanas (más rápido)

**Por qué:**
- ✅ CreditCalculationService ya implementado (-1 semana)
- ✅ Fórmulas ya probadas y funcionales (-1 semana)
- 🆕 Solo crear wrappers y frontend

### Nuevo Timeline Estimado

```
Semana 1:     Setup + InventoryService (Backend)
Semana 2:     WeekReleaseService + CreditBookingService (Backend)
Semana 3:     APIs + Testing Backend
Semana 4-5:   Frontend (Search + Checkout)
Semana 6:     Testing E2E + Integration
Semana 7:     Rollout + Migration
```

---

## 📚 Documentación de Referencia

Para más detalles sobre el sistema actual de créditos:

1. **Implementación:**
   - `backend/src/services/CreditCalculationService.ts`
   - `CREDIT_SYSTEM_ANALYSIS.md`
   - `INTEGRACION_CREDITOS_COMPLETA.md`

2. **API:**
   - `backend/CREDIT_SYSTEM_API.md`

3. **Migraciones:**
   - `CREDIT_MIGRATIONS_PRODUCTION_READY.md`

---

**Conclusión:** El sistema de cálculo dinámico YA FUNCIONA. Solo necesitamos crear la capa de simplificación por encima (inventario unificado + UI tipo Booking.com). ✅

---

_Documento actualizado: 25 de Enero, 2026_
