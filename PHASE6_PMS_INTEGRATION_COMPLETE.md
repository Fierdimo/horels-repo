# Phase 6: PMS Integration - Complete ✅

**Status:** Implementation Complete  
**Backend:** ~1,500 lines  
**TypeScript Errors:** 0  
**Date:** January 2026

---

## Overview

Phase 6 integrates the V2 booking system with external Property Management Systems (PMS) like Mews, Cloudbeds, and Opera. When guests create bookings through our platform, reservations are automatically created in the property's PMS system, and vice versa for cancellations.

### Key Objectives

✅ Create unified PMS adapter interface  
✅ Implement Mews API integration (primary PMS)  
✅ Update BookingService to create/cancel PMS reservations  
✅ Add background sync service for status updates  
✅ Provide configuration and error handling utilities

---

## Architecture

### Design Patterns

**1. Strategy Pattern (PMSAdapter Interface)**
- Unified interface for all PMS providers
- Easy to add new providers without modifying existing code
- Each provider implements the same methods with provider-specific logic

**2. Factory Pattern (PMSFactory)**
- Centralized creation of PMS adapters
- Automatically selects correct adapter based on property configuration
- Hides implementation details from consumers

**3. Graceful Degradation**
- PMS errors don't fail entire booking flow
- Bookings still created in our system if PMS fails
- Failed operations can be retried via sync service

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     BookingService                          │
│  (Create/Cancel bookings with credit deduction)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      PMSFactory                             │
│  createFromProperty(property) → PMSAdapter                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┬─────────────┐
        ▼               ▼               ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌─────────┐ ┌──────────┐
│ MewsAdapter  │ │MockPMSAdapter│ │Cloudbeds│ │  Opera   │
│  (370 lines) │ │  (test mode) │ │ (TBD)   │ │  (TBD)   │
└──────┬───────┘ └──────────────┘ └─────────┘ └──────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│             Mews Connector API (REST)                    │
│  /customers/add, /reservations/add, /reservations/cancel │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PMSSyncService                           │
│  Background sync: syncPendingBookings() every 2 hours      │
│  Status updates: CONFIRMED → CHECKED_IN → CHECKED_OUT      │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created

### 1. PMSAdapter.ts (220 lines)
**Path:** `backend/src/services/pms/PMSAdapter.ts`

**Purpose:** Abstract interface and type definitions for all PMS providers.

**Key Exports:**
- `PMSAdapter` interface - 6 methods all providers must implement
- `PMSProvider` type - 'mews' | 'cloudbeds' | 'opera' | 'other'
- `PMSBookingStatus` enum - Unified status across all PMS
- Request/Response interfaces for all operations
- Error classes: PMSError, PMSConnectionError, PMSBookingError, etc.

**Interface Methods:**
```typescript
interface PMSAdapter {
  getProvider(): PMSProvider;
  testConnection(): Promise<boolean>;
  createBooking(request: PMSBookingRequest): Promise<PMSBookingResponse>;
  cancelBooking(request: PMSCancellationRequest): Promise<PMSCancellationResponse>;
  getBookingStatus(pmsBookingId: string): Promise<PMSBookingStatusResponse>;
  getAvailability(request: PMSAvailabilityRequest): Promise<PMSRoomAvailability[]>;
}
```

### 2. MewsAdapter.ts (370 lines)
**Path:** `backend/src/services/pms/MewsAdapter.ts`

**Purpose:** Full implementation of Mews Connector API integration.

**Key Features:**
- Axios HTTP client with automatic auth injection
- 7 Mews API endpoints integrated
- 3-step booking creation: customer → category → reservation
- Status mapping: Mews states → our unified statuses
- Comprehensive error handling with retries

**Endpoints Used:**
- `/api/connector/v1/configuration/get` - Test connection
- `/api/connector/v1/customers/search` - Find existing customer
- `/api/connector/v1/customers/add` - Create new customer
- `/api/connector/v1/resourceCategories/getAll` - Get room types
- `/api/connector/v1/reservations/add` - Create booking
- `/api/connector/v1/reservations/cancel` - Cancel booking
- `/api/connector/v1/reservations/getAll` - Get booking status

**Booking Flow:**
```typescript
// Step 1: Create or find customer
const customer = await createOrGetCustomer({
  firstName: 'Maria',
  lastName: 'Lopez',
  email: 'maria@example.com',
  phone: '+34600000000'
});

// Step 2: Map room category to Mews resource category ID
const categoryId = await getResourceCategoryId('2BR Oceanview');

// Step 3: Create reservation
const reservation = await createReservation({
  customerId: customer.Id,
  resourceCategoryId: categoryId,
  startUtc: '2026-06-01T14:00:00Z',
  endUtc: '2026-06-08T11:00:00Z',
  numberOfGuests: 4
});

// Returns: { Id, Number, State: 'Confirmed' }
```

**Status Mapping:**
| Mews State | Our Status   | Description                    |
|------------|--------------|--------------------------------|
| Confirmed  | CONFIRMED    | Booking confirmed              |
| Optional   | PENDING      | Tentative booking              |
| Started    | CHECKED_IN   | Guest checked in               |
| Processed  | CHECKED_OUT  | Guest checked out              |
| Canceled   | CANCELLED    | Booking cancelled              |

### 3. PMSFactory.ts (176 lines)
**Path:** `backend/src/services/pms/PMSFactory.ts`

**Purpose:** Factory for creating PMS adapters with automatic configuration.

**Key Methods:**
```typescript
// Get adapter from database property
const adapter = await PMSFactory.getAdapter(propertyId);

// Create adapter from property model instance
const adapter = PMSFactory.createFromProperty(property);

// Create adapter by provider name
const adapter = PMSFactory.create('mews', credentials);

// Test connection without saving
const connected = await PMSFactory.testConnection('mews', credentials);
```

**MockPMSAdapter:**
- Used for testing and properties without PMS integration
- Returns fake data without making real API calls
- Logs all operations to console

### 4. BookingService.ts (Updated)
**Path:** `backend/src/services/v2/BookingService.ts`

**Changes:**
- Added PMS integration on booking creation (~60 lines)
- Added PMS cancellation on booking cancel (~40 lines)
- Graceful error handling - PMS failures don't fail booking

**Booking Creation Flow:**
```typescript
async createBooking(request: BookingRequest): Promise<BookingResult> {
  const transaction = await sequelize.transaction();
  try {
    // ... existing code: validate, check credits, create booking ...

    // NEW: Create PMS reservation
    if (property && property.pms_provider) {
      try {
        const adapter = PMSFactory.createFromProperty(property);
        const pmsResponse = await adapter.createBooking({...});
        
        await booking.update({
          pms_booking_id: pmsResponse.pmsBookingId,
          pms_confirmation_code: pmsResponse.pmsConfirmationCode,
          pms_provider: property.pms_provider,
          pms_synced_at: new Date()
        }, { transaction });
        
      } catch (pmsError) {
        // Log error but continue - booking still valid
        console.error('[BookingService] PMS booking failed:', pmsError);
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

**Cancellation Flow:**
```typescript
async cancelBooking(bookingId, userId, reason): Promise<V2Booking> {
  const transaction = await sequelize.transaction();
  try {
    // ... existing code: validate, update status, refund credits ...

    // NEW: Cancel PMS reservation
    if (booking.pms_booking_id && booking.pms_provider) {
      try {
        const adapter = PMSFactory.createFromProperty(property);
        await adapter.cancelBooking({
          pmsBookingId: booking.pms_booking_id,
          reason: reason || 'Guest cancellation'
        });
      } catch (pmsError) {
        // Log error but continue - cancellation still valid
        console.error('[BookingService] PMS cancellation failed:', pmsError);
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### 5. PMSSyncService.ts (370 lines)
**Path:** `backend/src/services/v2/PMSSyncService.ts`

**Purpose:** Background service for syncing booking status from PMS.

**Key Methods:**

**syncBooking(bookingId)** - Sync individual booking
```typescript
const syncService = new PMSSyncService();
const result = await syncService.syncBooking(5001);

// Result:
{
  bookingId: 5001,
  success: true,
  updated: true,
  changes: {
    status: 'CHECKED_IN',
    roomAssigned: 'ROOM-201'
  }
}
```

**syncPendingBookings(hoursThreshold)** - Batch sync (for cron job)
```typescript
// Sync all bookings not synced in last 2 hours
const results = await syncService.syncPendingBookings(2);

// Logs: "Sync complete: 45 successful, 12 updated, 2 failed"
```

**syncPropertyBookings(propertyId)** - Sync all bookings for property
```typescript
// Useful after changing PMS credentials
const results = await syncService.syncPropertyBookings(123);
```

**retryFailedOperations()** - Retry bookings that failed to create in PMS
```typescript
// Finds bookings with pms_booking_id = null
// Attempts to create them in PMS
const results = await syncService.retryFailedOperations();
```

**Recommended Cron Schedule:**
```bash
# Every 2 hours: sync pending bookings
0 */2 * * * node scripts/pms-sync.js

# Daily at 3 AM: retry failed operations
0 3 * * * node scripts/pms-retry-failed.js
```

### 6. PMSConfig.ts (280 lines)
**Path:** `backend/src/services/pms/PMSConfig.ts`

**Purpose:** Configuration utilities and validation for PMS providers.

**Key Classes:**

**PMSConfig** - Validation and configuration
```typescript
// Validate credentials
const result = PMSConfig.validate('mews', {
  clientToken: 'abc123',
  accessToken: 'xyz789',
  serviceId: 'service-uuid'
});
// Returns: { valid: true, errors: [] }

// Get required fields
const fields = PMSConfig.getRequiredFields('mews');
// Returns: ['clientToken', 'accessToken', 'serviceId']

// Get provider config
const config = PMSConfig.getProviderConfig('mews');
// Returns: { provider: 'mews', name: 'Mews', requiredFields: [...], ... }

// Sanitize for logging
const sanitized = PMSConfig.sanitizeForLogging(credentials);
// Returns: { clientToken: 'abc1***x789', ... }
```

**PMSEnvironment** - Load from environment variables
```typescript
// Get Mews config from env vars
const mewsConfig = PMSEnvironment.getMewsConfig();
// Reads: MEWS_CLIENT_TOKEN, MEWS_ACCESS_TOKEN, MEWS_SERVICE_ID

// Check if PMS enabled
const enabled = PMSEnvironment.isEnabled();
```

**PMS_CONFIGS** - Provider configurations
```typescript
{
  mews: {
    provider: 'mews',
    name: 'Mews',
    requiredFields: ['clientToken', 'accessToken', 'serviceId'],
    optionalFields: ['environment', 'propertyId'],
    sandboxUrl: 'https://api.mews-demo.com',
    productionUrl: 'https://api.mews.com',
    documentation: 'https://mews-systems.gitbook.io/connector-api/'
  },
  // ... cloudbeds, opera, other
}
```

---

## Database Integration

### Fields Used in v2_bookings

| Field                   | Type        | Description                           |
|-------------------------|-------------|---------------------------------------|
| pms_booking_id          | VARCHAR(255)| Reservation ID in PMS (e.g., UUID)    |
| pms_provider            | VARCHAR(50) | Provider: 'mews', 'cloudbeds', etc.   |
| pms_confirmation_code   | VARCHAR(255)| PMS confirmation number (if different)|
| pms_synced_at           | DATETIME    | Last sync timestamp (null = failed)   |

### Fields Used in timeshare_properties

| Field                   | Type        | Description                           |
|-------------------------|-------------|---------------------------------------|
| pms_provider            | ENUM        | 'mews', 'cloudbeds', 'opera', 'other' |
| pms_property_id         | VARCHAR(255)| Property ID in PMS system             |
| pms_credentials         | LONGTEXT    | Encrypted JSON with API keys          |

**Example Encrypted Credentials (Mews):**
```json
{
  "clientToken": "E0D7608C85584EE18D30BA2D85B68E31",
  "accessToken": "C3B988EC-A95E-4DA3-B5C2-B6A8AB8C1CDE",
  "serviceId": "1234abcd-5678-90ef-ghij-klmnopqrstuv",
  "environment": "production"
}
```

---

## Configuration

### Environment Variables

Add to `.env`:
```bash
# Mews PMS Configuration
MEWS_CLIENT_TOKEN=your_client_token_here
MEWS_ACCESS_TOKEN=your_access_token_here
MEWS_SERVICE_ID=your_service_id_here
MEWS_ENVIRONMENT=sandbox  # or 'production'

# Cloudbeds PMS Configuration (future)
# CLOUDBEDS_PROPERTY_ID=your_property_id
# CLOUDBEDS_CLIENT_ID=your_client_id
# CLOUDBEDS_CLIENT_SECRET=your_client_secret

# Opera PMS Configuration (future)
# OPERA_HOTEL_ID=your_hotel_id
# OPERA_USERNAME=your_username
# OPERA_PASSWORD=your_password
# OPERA_ENDPOINT=https://opera-api.example.com
```

### Property Configuration

Configure PMS for a property via database:
```sql
UPDATE timeshare_properties
SET 
  pms_provider = 'mews',
  pms_property_id = 'property-uuid-in-mews',
  pms_credentials = '<encrypted-json>'
WHERE id = 123;
```

Or via Admin UI (Phase 7):
- Property Settings → PMS Integration
- Select Provider: Mews
- Enter Credentials
- Test Connection
- Save

---

## API Examples

### Test Connection
```typescript
import { PMSFactory } from './services/pms/PMSFactory';

const connected = await PMSFactory.testConnection('mews', {
  provider: 'mews',
  clientToken: 'E0D7608C...',
  accessToken: 'C3B988EC...',
  serviceId: '1234abcd...',
  environment: 'sandbox'
});

console.log(connected); // true or false
```

### Create Booking
```typescript
import { PMSFactory } from './services/pms/PMSFactory';
import TimeshareProperty from './models/v2/TimeshareProperty';

// Get property with PMS config
const property = await TimeshareProperty.findByPk(123);

// Create adapter
const adapter = PMSFactory.createFromProperty(property);

// Create booking
const response = await adapter.createBooking({
  checkIn: new Date('2026-06-01'),
  checkOut: new Date('2026-06-08'),
  guest: {
    firstName: 'Maria',
    lastName: 'Lopez',
    email: 'maria@example.com',
    phone: '+34600000000'
  },
  numberOfGuests: 4,
  roomCategory: '2BR Oceanview',
  specialRequests: 'Early check-in if possible',
  internalBookingId: 5001,
  internalConfirmationCode: 'AAA-4567-2026'
});

console.log(response);
// {
//   success: true,
//   pmsBookingId: 'abc123-def456-...',
//   pmsConfirmationCode: 'MEWS-12345',
//   status: 'CONFIRMED',
//   roomAssigned: null,  // Assigned later by property
//   message: 'Booking created successfully in Mews'
// }
```

### Cancel Booking
```typescript
const response = await adapter.cancelBooking({
  pmsBookingId: 'abc123-def456-...',
  reason: 'Guest request'
});

console.log(response);
// {
//   success: true,
//   pmsBookingId: 'abc123-def456-...',
//   status: 'CANCELLED',
//   message: 'Booking cancelled successfully in Mews'
// }
```

### Get Booking Status
```typescript
const status = await adapter.getBookingStatus('abc123-def456-...');

console.log(status);
// {
//   pmsBookingId: 'abc123-def456-...',
//   status: 'CHECKED_IN',
//   checkIn: 2026-06-01T14:00:00.000Z,
//   checkOut: 2026-06-08T11:00:00.000Z,
//   roomAssigned: 'ROOM-201',
//   lastUpdated: 2026-06-01T14:05:00.000Z
// }
```

### Sync Booking
```typescript
import PMSSyncService from './services/v2/PMSSyncService';

const syncService = new PMSSyncService();
const result = await syncService.syncBooking(5001);

console.log(result);
// {
//   bookingId: 5001,
//   success: true,
//   updated: true,
//   changes: {
//     status: 'CHECKED_IN',
//     roomAssigned: 'ROOM-201'
//   }
// }
```

---

## Error Handling

### Error Classes

**PMSError** (base class)
```typescript
throw new PMSError('Connection failed', 'MEWS_CONNECTION_ERROR');
```

**PMSConnectionError** - Connection/auth failures
```typescript
throw new PMSConnectionError('Invalid credentials');
```

**PMSBookingError** - Booking operation failures
```typescript
throw new PMSBookingError('Room category not available');
```

**PMSCancellationError** - Cancellation failures
```typescript
throw new PMSCancellationError('Booking already cancelled in PMS');
```

**PMSValidationError** - Invalid data/credentials
```typescript
throw new PMSValidationError('Missing required field: serviceId');
```

### Error Handling in BookingService

```typescript
// PMS errors are logged but don't fail the booking
try {
  const pmsResponse = await adapter.createBooking({...});
  // Update booking with PMS data
} catch (pmsError) {
  console.error('[BookingService] PMS booking failed:', pmsError);
  // Booking still created in our system
  // Mark as needs manual PMS sync
}
```

### User-Friendly Error Messages

```typescript
import { getPMSErrorMessage } from './services/pms/PMSConfig';

try {
  await adapter.createBooking({...});
} catch (error) {
  const userMessage = getPMSErrorMessage(error.code);
  res.status(500).json({ error: userMessage });
}
```

---

## Testing

### Manual Testing via API

**1. Test PMS Connection**
```bash
curl -X POST http://localhost:3000/api/pms/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "mews",
    "credentials": {
      "clientToken": "E0D7608C...",
      "accessToken": "C3B988EC...",
      "serviceId": "1234abcd...",
      "environment": "sandbox"
    }
  }'

# Response:
# { "connected": true }
```

**2. Create Booking (with PMS integration)**
```bash
curl -X POST http://localhost:3000/api/v2/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "source": "HOTEL_PMS",
    "guestId": 1,
    "guestName": "Maria Lopez",
    "guestEmail": "maria@example.com",
    "guestPhone": "+34600000000",
    "propertyId": 123,
    "roomCategory": "2BR Oceanview",
    "checkIn": "2026-06-01",
    "checkOut": "2026-06-08",
    "nights": 7,
    "guests": 4,
    "creditsToUse": 700,
    "specialRequests": "Early check-in"
  }'

# Check response includes pms_booking_id
```

**3. Cancel Booking (with PMS cancellation)**
```bash
curl -X DELETE http://localhost:3000/api/v2/bookings/5001 \
  -H "Authorization: Bearer <token>" \
  -d '{ "reason": "Guest request" }'

# Verify booking cancelled in Mews dashboard
```

**4. Sync Booking Status**
```bash
curl -X POST http://localhost:3000/api/pms/sync/5001 \
  -H "Authorization: Bearer <admin-token>"

# Response:
# { "bookingId": 5001, "success": true, "updated": true, "changes": {...} }
```

### Automated Tests (Phase 8)

Create: `tests/services/pms/MewsAdapter.test.ts`
```typescript
describe('MewsAdapter', () => {
  it('should create booking in Mews', async () => {
    const adapter = new MewsAdapter(credentials);
    const response = await adapter.createBooking({...});
    expect(response.success).toBe(true);
    expect(response.pmsBookingId).toBeDefined();
  });

  it('should cancel booking in Mews', async () => {
    const adapter = new MewsAdapter(credentials);
    const response = await adapter.cancelBooking({...});
    expect(response.success).toBe(true);
    expect(response.status).toBe('CANCELLED');
  });
});
```

---

## Monitoring and Maintenance

### Logs to Monitor

**Successful PMS Operations:**
```
[BookingService] PMS booking created: abc123-def456 for booking 5001
[BookingService] PMS booking cancelled: abc123-def456 for booking 5001
[PMSSyncService] Sync complete: 45 successful, 12 updated, 2 failed
```

**Failed PMS Operations:**
```
[BookingService] PMS booking failed: {
  bookingId: 5001,
  propertyId: 123,
  provider: 'mews',
  error: 'Connection timeout'
}
```

### Dashboard Metrics (Future)

- Total PMS bookings created today
- PMS sync success rate (%)
- Failed operations needing retry
- Average PMS response time
- PMS by provider breakdown

### Troubleshooting

**Problem:** Booking created but no pms_booking_id

**Solution:**
1. Check logs for PMS error
2. Verify property PMS credentials are valid
3. Run `retryFailedOperations()` to retry

**Problem:** Status not syncing from PMS

**Solution:**
1. Check pms_synced_at timestamp - if > 6 hours, sync may be failing
2. Manually run `syncBooking(bookingId)` to see error
3. Verify PMS API is accessible
4. Check property PMS credentials haven't expired

**Problem:** Room not assigned in our system

**Solution:**
1. Run `syncBooking(bookingId)` to pull latest from PMS
2. Room assignments happen in PMS, not our system
3. Property staff assign rooms in Mews dashboard
4. Sync will pull the assignment back to our DB

---

## Next Steps

### Phase 7: Admin Tools (Week 12)
- Property management UI with PMS configuration
- Test PMS connection from admin panel
- View PMS sync status for bookings
- Manually trigger PMS sync/retry

### Phase 8: Testing & Refinement (Week 13-14)
- Create automated tests for PMS adapters
- Load testing with concurrent PMS calls
- Security audit of credential storage
- Rate limiting for PMS APIs

### Future Enhancements
- Implement Cloudbeds adapter
- Implement Opera adapter
- Add webhook support for PMS push notifications
- Real-time availability sync
- Two-way rate sync (PMS → our system)

---

## Summary

✅ **PMSAdapter Interface:** 220 lines, unified abstraction  
✅ **MewsAdapter:** 370 lines, full Mews integration  
✅ **PMSFactory:** 176 lines, adapter creation and mocking  
✅ **BookingService Integration:** ~100 lines added  
✅ **PMSSyncService:** 370 lines, background sync  
✅ **PMSConfig:** 280 lines, validation and utilities  

**Total Backend Code:** ~1,516 lines  
**TypeScript Errors:** 0  
**PMS Providers:** Mews (implemented), Cloudbeds (stub), Opera (stub)  

**Phase 6 Status:** ✅ **COMPLETE**

Frontend integration will be tested manually as requested ("frontend siempre se probara manualmente la integracion").

---

**Next:** Phase 7 - Admin Tools for property/unit management and PMS configuration UI.
