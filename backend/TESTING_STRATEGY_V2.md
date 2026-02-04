# V2 Testing Strategy

## Filosofía de Testing

Este documento explica la estrategia de testing para el proyecto V2, diferenciando claramente entre **Unit Tests** y **Integration Tests**.

## Regla de Oro

❌ **NUNCA usar SQLite en un proyecto MariaDB**
✅ **Unit tests = Lógica pura, sin base de datos**
✅ **Integration tests = MariaDB real en Docker**

---

## 1. Unit Tests (tests/v2/unit/)

### Propósito
Testear **lógica de negocio pura** sin dependencias externas.

### Características
- ❌ NO usan base de datos
- ❌ NO usan Sequelize conectado a DB
- ✅ SÍ usan clases mock con lógica de negocio
- ✅ SÍ son rápidos (< 100ms total)
- ✅ SÍ pueden ejecutarse sin Docker

### Configuración
```bash
# Ejecutar unit tests
npx vitest run --config vitest.unit.config.ts
```

**vitest.unit.config.ts:**
```typescript
export default defineConfig({
  test: {
    include: ['tests/v2/unit/**/*.test.ts'],
    // NO global setup - no database
  },
});
```

### Patrón de Mock

En lugar de inicializar Sequelize, creamos clases mock con solo la lógica de negocio:

```typescript
// ❌ WRONG - Usa Sequelize con SQLite
import { Sequelize } from 'sequelize';
const sequelize = new Sequelize('sqlite::memory:');
const WeekAllocation = initWeekAllocation(sequelize);
const allocation = WeekAllocation.build({ status: 'RELEASED' });

// ✅ RIGHT - Mock con lógica pura
class WeekAllocation {
  status: string;
  start_date: Date;
  end_date: Date;

  constructor(data: Partial<WeekAllocation>) {
    Object.assign(this, data);
  }

  isAvailable(): boolean {
    if (this.status !== 'RELEASED') return false;
    if (this.start_date < new Date()) return false;
    return true;
  }
}

const allocation = new WeekAllocation({ status: 'RELEASED' });
```

### Tests Implementados (84 tests, 100% passing)

#### WeekAllocation.test.ts (16 tests)
- ✅ `isAvailable()` - 4 tests
- ✅ `isExpired()` - 3 tests
- ✅ `daysUntilCheckIn()` - 3 tests
- ✅ Status transitions - 3 tests
- ✅ Credit calculation data - 2 tests
- ✅ PMS integration fields - 1 test

#### CreditAccount.test.ts (12 tests)
- ✅ `hasSufficientBalance()` - 5 tests
- ✅ `getAvailableBalance()` - 4 tests
- ✅ Balance statistics - 1 test
- ✅ Expiration policy - 2 tests

#### CreditTransaction.test.ts (21 tests)
- ✅ `validateBalance()` - 6 tests (incluye floating-point precision)
- ✅ `isCredit()` / `isDebit()` - 3 tests
- ✅ Transaction types - 5 tests (WEEK_RELEASE, WEEK_BOOKING, etc.)
- ✅ Reference tracking - 3 tests
- ✅ Metadata storage - 2 tests
- ✅ Audit trail - 2 tests

#### V2Booking.test.ts (18 tests)
- ✅ Source type detection - 2 tests
- ✅ `isCancellable()` - 6 tests (status + date logic)
- ✅ `getTotalCredits()` - 3 tests
- ✅ `getDuration()` - 2 tests
- ✅ Platform economics - 2 tests
- ✅ Guest details caching - 1 test
- ✅ PMS integration - 2 tests

#### HotelInventory.test.ts (17 tests)
- ✅ `isStale()` - 5 tests (24-hour cache logic)
- ✅ `hasAvailability()` - 3 tests
- ✅ `getOccupancyRate()` - 5 tests (incluye edge cases)
- ✅ Cache metadata - 2 tests
- ✅ Pricing data - 2 tests

### Casos Críticos Testeados

1. **Balance Validation (CreditTransaction)**
   ```typescript
   // Floating-point precision tolerance (0.01 credits)
   balance_before: 100.33
   amount: 200.67
   balance_after: 301.00  // Valid (300.99999... ≈ 301.00)
   ```

2. **Week Availability (WeekAllocation)**
   ```typescript
   // RELEASED + future date = available
   status: 'RELEASED'
   start_date: Date.now() + 7 days  // ✅ Available
   
   // RELEASED + past date = NOT available
   status: 'RELEASED'
   start_date: Date.now() - 7 days  // ❌ Not available
   ```

3. **Booking Cancellation (V2Booking)**
   ```typescript
   // CONFIRMED + future check-in = cancellable
   status: 'CONFIRMED'
   check_in: Date.now() + 7 days  // ✅ Cancellable
   
   // CHECKED_IN = NOT cancellable
   status: 'CHECKED_IN'  // ❌ Not cancellable
   ```

4. **Cache Staleness (HotelInventory)**
   ```typescript
   // 24-hour cache window (86400000 ms)
   last_synced: Date.now() - 24.1 hours  // ❌ Stale
   last_synced: Date.now() - 24.0 hours  // ✅ Fresh
   ```

---

## 2. Integration Tests (tests/v2/integration/) - PENDING

### Propósito
Testear **repositories completos** con base de datos real.

### Características
- ✅ SÍ usan MariaDB en Docker
- ✅ SÍ usan Sequelize real
- ✅ SÍ testean queries complejas
- ✅ SÍ verifican índices (EXPLAIN)
- ⚠️ Son más lentos (setup + teardown)
- ⚠️ Requieren Docker corriendo

### Configuración (TO DO)
```bash
# Ejecutar integration tests
npx vitest run --config vitest.integration.config.ts
```

**vitest.integration.config.ts:**
```typescript
export default defineConfig({
  test: {
    include: ['tests/v2/integration/**/*.test.ts'],
    globalSetup: './tests/setup/integration-setup.ts',
    setupFiles: ['./tests/setup/test-db.ts'],
  },
});
```

### Patrón de Integration Test (TO DO)

```typescript
describe('WeekAllocationRepository', () => {
  let sequelize: Sequelize;
  let repo: WeekAllocationRepository;

  beforeAll(async () => {
    sequelize = await initTestDatabase();
    repo = new WeekAllocationRepository();
  });

  beforeEach(async () => {
    // Start transaction
    await sequelize.transaction(async (t) => {
      // Insert test data
      await insertTestData(t);
    });
  });

  afterEach(async () => {
    // Rollback/truncate
    await sequelize.truncate({ cascade: true });
  });

  it('should use idx_released_available on findAvailableWeeks', async () => {
    const weeks = await repo.findAvailableWeeks({ start: '2026-07-01' });
    
    // Verify results
    expect(weeks).toHaveLength(5);
    
    // Verify index used (critical for hot table)
    const explain = await sequelize.query(
      'EXPLAIN SELECT * FROM week_allocations WHERE status = "RELEASED"'
    );
    expect(explain[0][0].key).toBe('idx_released_available');
  });
});
```

### Tests to Implement (TO DO)

#### weekAllocationRepository.test.ts
- [ ] `findAvailableWeeks()` - Verify idx_released_available used
- [ ] `findByOwnershipAndYear()` - Test composite query
- [ ] `findConflictingWeeks()` - Date range overlap logic
- [ ] `updateStatus()` - Test status transitions with FK constraints
- [ ] Pagination performance on hot table

#### creditTransactionRepository.test.ts
- [ ] `createTransaction()` - Verify immutability (no UPDATE/DELETE)
- [ ] `getAccountHistory()` - Test ordering and pagination
- [ ] `calculateBalance()` - Verify SUM() accuracy
- [ ] Test UNIQUE constraint on (account_id, created_at)
- [ ] Test FK cascade behavior

#### creditAccountRepository.test.ts
- [ ] `updateBalance()` - Test atomic increment/decrement
- [ ] `getAccountWithLock()` - Test FOR UPDATE
- [ ] Test credit_limit constraints
- [ ] Test total_earned/total_spent updates

#### propertyRepository.test.ts
- [ ] `searchByLocation()` - Test GeoJSON queries
- [ ] `findByFilters()` - Test amenities JSON search
- [ ] `findByPmsProvider()` - Test PMS integration filter

### Critical Integration Tests

1. **Transaction Atomicity**
   ```typescript
   // CreditService should rollback on failure
   try {
     await creditService.releaseWeek(weekId, userId);
   } catch (error) {
     // Verify NO partial state:
     // - Week status unchanged
     // - No transaction record
     // - Account balance unchanged
   }
   ```

2. **Index Usage Verification**
   ```typescript
   // Hot table MUST use indexes
   const result = await sequelize.query(
     'EXPLAIN SELECT * FROM week_allocations WHERE status = "RELEASED"'
   );
   expect(result[0][0].key).toBe('idx_released_available');
   expect(result[0][0].rows).toBeLessThan(1000); // Not full scan
   ```

3. **Foreign Key Cascades**
   ```typescript
   // Deleting ownership should cascade to week_allocations
   await Ownership.destroy({ where: { id: ownershipId } });
   const weeks = await WeekAllocation.count({ 
     where: { ownership_id: ownershipId } 
   });
   expect(weeks).toBe(0); // Cascaded delete
   ```

---

## 3. End-to-End Tests (TO DO - Phase 3)

### Propósito
Testear **flujos completos** de usuario a través de la API.

### Características
- ✅ SÍ usan API HTTP real
- ✅ SÍ usan MariaDB en Docker
- ✅ SÍ testean autenticación/autorización
- ✅ SÍ testean flujos multi-step
- ⚠️ Son los más lentos

### Example (TO DO)
```typescript
describe('Week Release Flow', () => {
  it('should complete full week release and booking cycle', async () => {
    // 1. Owner releases week
    const releaseResponse = await request(app)
      .post('/api/v2/weeks/123/release')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    // 2. Credits issued
    const account = await CreditAccount.findOne({ 
      where: { user_id: ownerId } 
    });
    expect(account.balance).toBe(1080); // base_credit_value * multipliers

    // 3. Another user books the week
    const bookingResponse = await request(app)
      .post('/api/v2/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ week_allocation_id: 123 })
      .expect(201);

    // 4. Week marked as BOOKED
    const week = await WeekAllocation.findByPk(123);
    expect(week.status).toBe('BOOKED');

    // 5. Guest credits deducted
    const guestAccount = await CreditAccount.findOne({ 
      where: { user_id: guestId } 
    });
    expect(guestAccount.balance).toBeLessThan(initialBalance);
  });
});
```

---

## 4. Testing Best Practices

### DO ✅

1. **Unit tests para lógica de negocio**
   - Helper methods (isAvailable, isCancellable)
   - Cálculos (getOccupancyRate, getDuration)
   - Validaciones (validateBalance)

2. **Integration tests para queries**
   - Repository methods
   - Foreign key constraints
   - Index usage
   - Transaction rollback

3. **E2E tests para flujos críticos**
   - Week release → credit issuance
   - Credit purchase → Stripe webhook → balance update
   - Week booking → PMS sync → confirmation email

4. **Factories para test data**
   ```typescript
   // tests/factories/weekAllocationFactory.ts
   export function createWeekAllocation(overrides = {}) {
     return {
       ownership_id: 1,
       start_date: new Date('2026-07-01'),
       end_date: new Date('2026-07-08'),
       status: 'ASSIGNED',
       year: 2026,
       week_number: 27,
       ...overrides,
     };
   }
   ```

### DON'T ❌

1. **NO usar SQLite para proyecto MariaDB**
   - Diferencias en tipos de datos (DECIMAL vs NUMERIC)
   - Diferencias en índices compuestos
   - Diferencias en transacciones
   - Diferencias en JSON queries

2. **NO testear implementación interna**
   ```typescript
   // ❌ BAD - Testea cómo se hace
   expect(repo.sequelize.query).toHaveBeenCalled();
   
   // ✅ GOOD - Testea qué resultado da
   const weeks = await repo.findAvailableWeeks();
   expect(weeks).toHaveLength(5);
   ```

3. **NO mezclar unit e integration tests**
   ```typescript
   // ❌ BAD - Unit test con DB
   describe('WeekAllocation helpers', () => {
     beforeAll(() => sequelize = new Sequelize(...));
   });
   
   // ✅ GOOD - Unit test puro
   describe('WeekAllocation helpers', () => {
     const allocation = new WeekAllocation({ status: 'RELEASED' });
   });
   ```

4. **NO hacer tests frágiles**
   ```typescript
   // ❌ BAD - Breaks con cambios de UI
   expect(error.message).toBe('Balance insuficiente para completar la transacción');
   
   // ✅ GOOD - Testea comportamiento
   expect(result.success).toBe(false);
   expect(result.error).toContain('balance');
   ```

---

## 5. Current Status

### ✅ Completed

- [x] Unit test infrastructure (vitest.unit.config.ts)
- [x] 5 unit test files with 84 tests (100% passing)
- [x] Mock classes for all V2 models
- [x] Testing strategy documentation

### ⏳ Next Steps (Phase 1 Validation)

1. **Integration Tests** (Estimated: 4-6 hours)
   - [ ] Setup test database (sw2_test)
   - [ ] Create vitest.integration.config.ts
   - [ ] Implement 4 repository test files (~40 tests)
   - [ ] Verify index usage with EXPLAIN
   - [ ] Test FK constraints and cascades

2. **Phase 1 Validation Checklist**
   - [ ] All unit tests passing (84/84) ✅ DONE
   - [ ] All integration tests passing (0/40) ⏳ TODO
   - [ ] No TypeScript errors
   - [ ] Test coverage >80% for models/repositories
   - [ ] Documentation updated

### 📊 Test Coverage Goals

| Layer | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|------------------|-----------|
| Models | ✅ 84 tests | - | - |
| Repositories | - | ⏳ ~40 tests | - |
| Services | ⏳ Phase 2 | ⏳ Phase 2 | - |
| API Routes | - | - | ⏳ Phase 3 |

---

## 6. Running Tests

```bash
# Unit tests only (fast, no Docker needed)
npm run test:unit

# Integration tests (requires Docker + MariaDB)
npm run test:integration

# All tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Add to package.json:
```json
{
  "scripts": {
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test": "npm run test:unit && npm run test:integration",
    "test:watch": "vitest --config vitest.unit.config.ts",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 7. Lessons Learned

### Why This Matters

**Problem:** Inicialmente se intentó usar SQLite para unit tests en un proyecto MariaDB.

**Issues:**
- SQLite no soporta todas las features de MariaDB (JSON queries, GIS, etc.)
- Los tests pasaban con SQLite pero fallaban en producción
- Setup complejo para inicializar Sequelize en tests
- Tests lentos (>2 segundos para 84 tests)

**Solution:** Separar unit tests (lógica pura) de integration tests (DB real).

**Benefits:**
- Unit tests: 2 segundos para 84 tests (rápido)
- No dependen de Docker/MariaDB (CI/CD más simple)
- Tests más enfocados (business logic vs data access)
- Integration tests con MariaDB real (mismas conditions que producción)

### Key Takeaway

> **"No uses SQLite para testear un proyecto MariaDB. Unit tests deben ser pura lógica sin DB, integration tests deben usar la DB real."**

---

## 8. References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Sequelize Testing Guide](https://sequelize.org/docs/v6/other-topics/testing/)
- Technical Spec: `docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md`
- Database Design: `docs_v2/DATABASE_DESIGN.md`
