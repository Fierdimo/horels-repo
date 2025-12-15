# SW2 Backend - Testing Documentation

Comprehensive testing guide for the SW2 Timesharing & Hotel Platform backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Suite Structure](#test-suite-structure)
3. [Running Tests](#running-tests)
4. [Unit Tests](#unit-tests)
5. [Integration Tests](#integration-tests)
6. [E2E Tests](#e2e-tests)
7. [Test Database Setup](#test-database-setup)
8. [Mocking & Test Data](#mocking--test-data)
9. [Troubleshooting](#troubleshooting)
10. [CI/CD Integration](#cicd-integration)
11. [Test Coverage](#test-coverage)

---

## Overview

The SW2 backend uses **Vitest** as the primary testing framework with the following approach:

- **Test-Driven Development (TDD)**: Write tests first, then implement features
- **100+ tests**: Comprehensive coverage of all business logic
- **Sequential execution**: Tests run one file at a time to avoid race conditions
- **Real database**: Tests use a dedicated test database (sw2_db, sw2_e2e_test)
- **Mocked services**: External services (Stripe, PMS) can be mocked or use real APIs

**Test Philosophy:**
- Every feature must have corresponding tests before implementation
- Tests define the requirements and expected behavior
- Red-Green-Refactor cycle: Fail → Pass → Improve

---

## Test Suite Structure

```
tests/
├── unit/                          # Unit tests (isolated functions)
│   ├── cleanupStuckSwaps.spec.ts
│   └── swap-fee-booking.test.ts
├── integration/                   # Integration tests (not yet organized)
├── e2e/                          # End-to-end tests
│   ├── e2e.test.ts              # Complete user workflows
│   ├── e2e-smoke.test.ts        # Quick smoke tests
│   ├── peak-period.test.ts      # Peak period validation
│   └── idempotency-credit.test.ts
├── services/                     # Service layer tests
│   └── adapters/
│       ├── mewsAdapter.test.ts
│       └── mewsAdapter.extended.test.ts
├── concurrency/                  # Concurrency tests
│   └── completeSwap.parallel.test.ts
├── logging.test.ts              # Logging system tests
├── pms-*.test.ts                # PMS integration tests
├── stripe.test.ts               # Stripe payment tests
├── timeshare.test.ts            # Timeshare business logic
├── hotel-guest.test.ts          # Hotel guest features
├── hotelStaffRoutes.test.ts     # Hotel staff endpoints
├── webhooks.test.ts             # Webhook handling
└── securityLogger.test.ts       # Security logging tests
```

**Key Test Files:**
- **e2e.test.ts**: Complete user registration → login → profile workflows
- **timeshare.test.ts**: Week management, swaps, credits (8 tests)
- **stripe.test.ts**: Payment intents, confirmations, refunds (12 tests)
- **logging.test.ts**: Comprehensive audit logging (16 tests)
- **pms-*.test.ts**: PMS integration and mock adapter (15 tests)

---

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test
# or
npx vitest run

# Run tests in watch mode (auto-rerun on changes)
npx vitest watch

# Run specific test file
npx vitest run tests/timeshare.test.ts --reporter=verbose

# Run tests with coverage
npx vitest run --coverage

# Run E2E tests only
npm run test:e2e
# or
npx vitest run tests/e2e.test.ts --reporter=verbose

# Run sequential test suite (recommended for CI)
npm run test:sequential
# or
./scripts/run_tests_sequential.sh

# Run unit tests only
npx vitest run tests/unit --reporter=verbose

# Run service tests
npx vitest run tests/services --reporter=verbose
```

### Sequential Test Runner

The sequential test runner (`scripts/run_tests_sequential.sh`) executes tests one file at a time to avoid database race conditions:

```bash
npm run test:sequential
```

**Benefits:**
- Avoids parallel test conflicts
- Better error isolation
- Consistent test database state
- Logs saved to `tmp/sequential_test_results.txt`

---

## Unit Tests

Unit tests focus on isolated functions and business logic without external dependencies.

### Examples

**Swap Fee Calculation:**
```typescript
// tests/unit/swap-fee-booking.test.ts
it('records fee with booking_id and stripeChargeId when provided', async () => {
  const result = await conversionService.recordSwapFee({
    swapId: 1,
    amount: 10.00,
    currency: 'EUR',
    stripeChargeId: 'ch_test123',
    bookingId: 456
  });
  
  expect(result.booking_id).toBe(456);
  expect(result.stripe_charge_id).toBe('ch_test123');
});
```

**Running Unit Tests:**
```bash
# All unit tests
npx vitest run tests/unit --reporter=verbose

# Specific unit test
npx vitest run tests/unit/swap-fee-booking.test.ts
```

**Mocking in Unit Tests:**
```typescript
import { vi } from 'vitest';

// Mock external service
vi.mock('../services/stripeService', () => ({
  default: vi.fn().mockImplementation(() => ({
    createPaymentIntent: vi.fn().mockResolvedValue({
      paymentIntentId: 'pi_mock123',
      clientSecret: 'secret_mock'
    })
  }))
}));
```

---

## Integration Tests

Integration tests verify that multiple components work together correctly, including database operations and API endpoints.

### Examples

**Timeshare Week Management:**
```typescript
// tests/timeshare.test.ts
describe('Week Management', () => {
  it('should get user weeks', async () => {
    const response = await request(app)
      .get('/timeshare/weeks')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

**Stripe Payment Integration:**
```typescript
// tests/stripe.test.ts
it('should create a payment intent for swap fee', async () => {
  const paymentIntent = await stripeService.createPaymentIntent(
    10.00,
    'EUR',
    'swap_fee',
    { swapId: 1 }
  );
  
  expect(paymentIntent.paymentIntentId).toBeDefined();
  expect(paymentIntent.amount).toBeGreaterThanOrEqual(10.00);
});
```

**Running Integration Tests:**
```bash
# All integration tests (mixed with unit in current structure)
npx vitest run --exclude="tests/e2e/**"

# Specific integration test
npx vitest run tests/timeshare.test.ts --reporter=verbose
npx vitest run tests/stripe.test.ts --reporter=verbose
```

---

## E2E Tests

End-to-end tests validate complete user workflows from start to finish, simulating real user interactions.

### Test Scenarios

**Complete User Flow:**
1. User registration
2. Login with credentials
3. Access protected profile endpoint
4. Admin operations (if applicable)

**Timesharing Owner Flow:**
1. View owned weeks
2. Confirm week usage
3. Create swap request
4. Convert week to night credits
5. Use night credits for booking

**Hotel Guest Flow:**
1. Access booking via guest token
2. Request hotel service
3. View nearby Secret World content

**Payment Flow:**
1. Create payment intent
2. Confirm payment
3. Handle webhooks
4. Process refunds

### Running E2E Tests

```bash
# All E2E tests
npm run test:e2e

# Specific E2E test file
npx vitest run tests/e2e.test.ts --reporter=verbose
npx vitest run tests/e2e-smoke.test.ts --reporter=verbose

# E2E with real Stripe (requires STRIPE_SECRET_KEY in .env)
USE_REAL_STRIPE=true npx vitest run tests/e2e-smoke.test.ts
```

### E2E Test Structure

```typescript
describe('End-to-End User Flows', () => {
  beforeAll(async () => {
    // Setup: create test users, properties, weeks
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup: remove test data
    await cleanupTestData();
  });

  it('should complete full user registration and login flow', async () => {
    // 1. Register
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'pass123' });
    
    expect(registerResponse.status).toBe(201);

    // 2. Login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'pass123' });
    
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.token;

    // 3. Access profile
    const profileResponse = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.user.email).toBe('test@example.com');
  });
});
```

---

## Test Database Setup

Tests use dedicated test databases configured in `config/config.json`:

```json
{
  "test": {
    "username": "sw2_user",
    "password": "your_password",
    "database": "sw2_db",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

### Database Lifecycle

**Global Setup (`tests/globalSetup.ts`):**
1. Run migrations: `npx sequelize-cli db:migrate --env test`
2. Run seeders: `npx sequelize-cli db:seed:all --env test`

**Before Each Test Suite:**
- Tests may clean up their specific data
- Some tests use transactions for isolation

**After Tests:**
- Database state persists for debugging
- Use `beforeEach` cleanup for test isolation

### Manual Database Reset

```bash
# Drop and recreate test database
mysql -u sw2_user -p -e "DROP DATABASE IF EXISTS sw2_db; CREATE DATABASE sw2_db;"

# Run migrations
npx sequelize-cli db:migrate --env test

# Run seeders
npx sequelize-cli db:seed:all --env test
```

### E2E Test Database

E2E tests may use a separate database (`sw2_e2e_test`) to avoid conflicts:

```bash
# Create E2E database
mysql -u sw2_user -p -e "CREATE DATABASE IF NOT EXISTS sw2_e2e_test;"

# Run migrations for E2E
npx sequelize-cli db:migrate --env test --url "mysql://sw2_user:password@127.0.0.1:3306/sw2_e2e_test"
```

---

## Mocking & Test Data

### Mocking Stripe

```typescript
// Mock Stripe service
vi.mock('../services/stripeService', () => ({
  default: class MockStripeService {
    async createPaymentIntent(amount, currency, type, metadata) {
      return {
        paymentIntentId: 'pi_mock_' + Date.now(),
        clientSecret: 'secret_mock_' + Date.now(),
        amount,
        currency
      };
    }
    
    async confirmPayment(paymentIntentId) {
      return {
        paymentIntentId,
        status: 'succeeded',
        amount: 10.50,
        currency: 'EUR'
      };
    }
  }
}));
```

### Mocking PMS (Property Management System)

```typescript
// Force mock PMS mode
beforeAll(() => {
  process.env.PMS_PROVIDER = 'mock';
  process.env.USE_REAL_PMS = 'false';
});

// Mock adapter returns deterministic results based on propertyId
// Example: propertyId % 3 === 0 → no availability
//          propertyId % 3 === 1 → full availability
//          propertyId % 3 === 2 → partial availability
```

### Test Data Creation

```typescript
// Create test user
const testUser = await User.create({
  email: `test_${Date.now()}@example.com`,
  password: await bcrypt.hash('password123', 10),
  role_id: ownerRole.id
});

// Create test property
const testProperty = await Property.create({
  name: 'Test Hotel',
  location: 'Test City',
  coordinates: JSON.stringify({ lat: 40.7128, lng: -74.0060 })
});

// Create test week
const testWeek = await Week.create({
  owner_id: testUser.id,
  property_id: testProperty.id,
  start_date: '2025-07-01',
  end_date: '2025-07-08',
  color: 'red',
  status: 'available'
});
```

### Using Test Seeds

Default test seeds (loaded automatically):
- **Admin user**: `admin@sw2.com` / `Admin123!`
- **Roles**: guest, owner, staff, admin
- **Permissions**: Full RBAC permission set
- **Role-Permission mappings**: Pre-configured access control

---

## Troubleshooting

### Common Issues

**1. Tests fail with "Connection refused" or database errors**

**Solution:**
```bash
# Verify MySQL is running
mysql -u sw2_user -p -e "SELECT 1;"

# Check database exists
mysql -u sw2_user -p -e "SHOW DATABASES LIKE 'sw2_db';"

# Re-run migrations
npx sequelize-cli db:migrate --env test
```

**2. Stripe 401 Unauthorized errors**

**Solution:**
```bash
# Verify .env has Stripe keys
cat .env | grep STRIPE_SECRET_KEY

# Export keys to environment
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_PUBLISHABLE_KEY=pk_test_...

# Use mock Stripe for deterministic tests
export USE_REAL_STRIPE=false
```

**3. PMS API 404 errors (Mews)**

**Solution:**
```bash
# Force mock PMS mode
export PMS_PROVIDER=mock
export USE_REAL_PMS=false

# Or configure real Mews credentials in .env
MEWS_CLIENT_TOKEN=your_token
MEWS_ACCESS_TOKEN=your_access
MEWS_CLIENT_ID=your_client_id
```

**4. Foreign key constraint errors**

**Solution:**
- Ensure migrations run in correct order
- Check that referenced records exist before creating dependent records
- Use transactions for multi-step test data creation

```bash
# Re-run migrations from scratch
npx sequelize-cli db:migrate:undo:all --env test
npx sequelize-cli db:migrate --env test
npx sequelize-cli db:seed:all --env test
```

**5. Test timeouts**

**Solution:**
```typescript
// Increase timeout for slow tests
it('should complete slow operation', async () => {
  // ... test code
}, 30000); // 30 second timeout

// Or in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000
  }
});
```

**6. Flaky tests (inconsistent pass/fail)**

**Solution:**
- Use sequential test runner: `npm run test:sequential`
- Add proper `beforeEach` / `afterEach` cleanup
- Use unique identifiers (timestamps) to avoid conflicts
- Avoid shared mutable state between tests

**7. Property ID type errors (STRING vs INTEGER)**

**Solution:**
- Property.id is INTEGER (autoincrement)
- Always use `property.id` (number) not string IDs
- Fixed in migrations: `20251203210357-add-property-id-to-users.js`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mariadb:10.11
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: sw2_db
          MYSQL_USER: sw2_user
          MYSQL_PASSWORD: password
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Wait for MySQL
        run: |
          until mysqladmin ping -h 127.0.0.1 -u sw2_user -ppassword; do
            echo "Waiting for MySQL..."
            sleep 2
          done
      
      - name: Run migrations
        run: npx sequelize-cli db:migrate --env test
        env:
          DB_HOST: 127.0.0.1
          DB_USER: sw2_user
          DB_PASSWORD: password
          DB_NAME: sw2_db
      
      - name: Run seeders
        run: npx sequelize-cli db:seed:all --env test
      
      - name: Run tests
        run: npm run test:sequential
        env:
          NODE_ENV: test
          USE_REAL_STRIPE: false
          PMS_PROVIDER: mock
          USE_REAL_PMS: false
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tmp/sequential_test_results.txt
```

### Environment Variables for CI

```bash
# Required for all tests
NODE_ENV=test
DB_HOST=127.0.0.1
DB_USER=sw2_user
DB_PASSWORD=password
DB_NAME=sw2_db

# Optional: Use real Stripe (requires secrets)
USE_REAL_STRIPE=true
STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
STRIPE_PUBLISHABLE_KEY=${{ secrets.STRIPE_PUBLISHABLE_KEY }}

# Optional: Use mock services (recommended for CI)
PMS_PROVIDER=mock
USE_REAL_PMS=false
```

---

## Test Coverage

### Current Status

**Total Tests:** 100+ passing
**Coverage:** ~90% of business logic

**Test Breakdown:**
- **Authentication**: 12 tests (login, register, JWT)
- **Timesharing**: 8 tests (weeks, swaps, credits)
- **Hotel Guest**: 11 tests (booking access, services)
- **Payments (Stripe)**: 12 tests (intents, confirmations, refunds)
- **PMS Integration**: 15 tests (availability, bookings)
- **Logging**: 16 tests (action logs, security logs)
- **Security**: 13 tests (middleware, headers, validation)
- **E2E Workflows**: 5 tests (complete user flows)
- **Service Layer**: 23 tests (adapters, business logic)

### Running Coverage Report

```bash
# Generate coverage report
npx vitest run --coverage

# View HTML coverage report
open coverage/index.html
```

### Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

**Areas with full coverage:**
- Authentication and authorization ✅
- Timesharing business logic ✅
- Payment processing ✅
- Logging and audit trails ✅

**Areas needing more coverage:**
- Peak period validation (skipped - not implemented)
- Guest token expiry edge cases
- Concurrency scenarios for swaps
- Error recovery paths

---

## Best Practices

### Writing New Tests

1. **Follow TDD**: Write test first, then implement
2. **Descriptive names**: `it('should reject swap between different color weeks')`
3. **Arrange-Act-Assert**: Clear test structure
4. **Isolated tests**: Each test should be independent
5. **Cleanup**: Use `afterEach` to reset state
6. **Unique data**: Use timestamps to avoid conflicts

### Test Organization

```typescript
describe('Feature Name', () => {
  describe('Subfeature or Method', () => {
    beforeEach(async () => {
      // Setup for this group of tests
    });

    it('should handle success case', async () => {
      // Arrange
      const input = { ... };
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

### Mocking Guidelines

- Mock external services (Stripe, PMS, email)
- Use real database for integration tests
- Mock time-dependent functions for determinism
- Verify mock calls with `expect(mockFn).toHaveBeenCalledWith(...)`

---

## Additional Resources

- **Main README**: [README.md](./README.md) - Project overview and setup
- **API Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Complete endpoint reference
- **Vitest Documentation**: https://vitest.dev/
- **Supertest**: https://github.com/visionmedia/supertest
- **Sequelize Testing**: https://sequelize.org/docs/v6/other-topics/testing/

---

**Last Updated:** December 4, 2025  
**Test Suite Version:** 1.0.0
