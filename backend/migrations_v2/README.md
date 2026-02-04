# V2 Migrations - Clean Start

This directory contains the **clean V2 migrations** for the Timeshare Exchange Platform.

## Why New Migrations?

The V1 migrations contain conceptual misunderstandings about the timeshare model:
- Confused prepaid allocations with physical room assignments
- Treated timeshare weeks as specific room reservations
- Mixed hotel and timeshare inventory incorrectly

V2 implements the correct model from scratch based on:
- `docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md`
- `docs_v2/DATABASE_DESIGN.md`
- `docs_v2/USER_EXPERIENCE_DESIGN.md`

## Migration Order

1. **20260201000001-create-base-tables.js** - Users table (reuse existing)
2. **20260201000002-create-timeshare-properties.js** - Property master data
3. **20260201000003-create-timeshare-units.js** - Unit categories
4. **20260201000004-create-ownerships.js** - Ownership contracts
5. **20260201000005-create-week-allocations.js** - Weekly inventory (HOT TABLE)
6. **20260201000006-create-credit-accounts.js** - User credit balances
7. **20260201000007-create-credit-transactions.js** - Immutable ledger
8. **20260201000008-create-v2-bookings.js** - Unified bookings
9. **20260201000009-create-hotel-inventory.js** - PMS cache
10. **20260201000010-create-indexes.js** - Performance indexes

## Running Migrations

```bash
# Drop and recreate database (DEVELOPMENT ONLY!)
npm run db:reset:v2

# Run V2 migrations
npm run migrate:v2

# Seed test data
npm run seed:v2
```

## Rollback Plan

If V2 needs rollback:
1. Backup V2 data
2. Restore V1 migrations
3. Import critical data from V2

## Performance Targets

- Search queries: < 500ms (p95)
- Credit transactions: < 50ms
- Booking creation: < 200ms (excluding PMS API)

See `DATABASE_DESIGN.md` for complete schema documentation.
