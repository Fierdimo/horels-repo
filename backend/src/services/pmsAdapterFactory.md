# PMS Adapter Factory Documentation

## Purpose
The `pmsAdapterFactory` provides a unified interface to integrate multiple Property Management Systems (PMS) into the backend. It ensures that all PMS adapters expose the same set of core functionalities, so the rest of the application can interact with any PMS in a consistent way.

## How to Add a New PMS Adapter

1. **Implement the Adapter:**
   - Create a new adapter class in `src/services/adapters/` (e.g., `cloudbedsAdapter.ts`).
   - The adapter **must implement** the `PmsAdapter` interface defined in `pmsAdapterInterface.ts`.
   - All required methods (see below) must be present and return the expected types.

2. **Register the Adapter:**
   - Import your adapter in `pmsAdapterFactory.ts`.
   - Add a new case to the `switch` statement for your PMS provider key (e.g., `'cloudbeds'`).

3. **Supported PMS Key:**
   - Add your PMS key to the `SupportedPMS` type (e.g., `'cloudbeds'`).

4. **Test:**
   - Ensure all existing tests for PMS features pass with your new adapter.
   - Add new tests if your PMS has unique behaviors.

## Required Interface: `PmsAdapter`
All adapters **must** implement the following methods (see `pmsAdapterInterface.ts`):

- `checkAvailability(propertyId, startDate, endDate, requiredNights)`
- `priceReservation(payload)`
- `addReservation(payload)`
- `createBooking(payload, idempotencyKey)`
- `cancelReservation(reservationId)`
- `getReservation(reservationId)`
- (Optional) Catalog endpoints: `configurationGet`, `servicesGetAll`, `ratesGetAll`, `resourcesGetAll`

### Advanced Features (if supported by PMS):
- `purchaseUpgrade({ reservationId, upgradeType, amount, currency })`
- `purchaseAddOn({ reservationId, addOnType, amount, currency })`
- `requestRefundStripe({ paymentIntentId, amount, currency, reason })`
- `requestRefundMews({ reservationId, amount, currency, reason })`
- `sendMessageToStaff(bookingId, message)`
- `startReservation(reservationId)`
- `processReservation(reservationId)`

If a PMS does not support a feature, the method should throw a clear error or return a standardized failure response.

## Example: Adding Cloudbeds
```typescript
import CloudbedsAdapter from './adapters/cloudbedsAdapter';

export type SupportedPMS = 'mews' | 'cloudbeds' | 'resnexus';

export function pmsAdapterFactory(provider: SupportedPMS): any {
  switch (provider) {
    case 'mews':
      return new MewsAdapter();
    case 'cloudbeds':
      return new CloudbedsAdapter();
    // ...
    default:
      throw new Error(`Unsupported PMS provider: ${provider}`);
  }
}
```

## Best Practices
- **Consistency:** All adapters must match the interface and return consistent data structures.
- **Error Handling:** Throw clear errors for unsupported features.
- **Documentation:** Document any PMS-specific quirks in the adapter file.
- **Testing:** Run the full test suite after adding a new adapter.

## Where to Find the Interface
- `src/services/adapters/pmsAdapterInterface.ts`

## Where to Register New Adapters
- `src/services/pmsAdapterFactory.ts`

---
This ensures future PMS integrations are smooth, maintainable, and feature-complete.
