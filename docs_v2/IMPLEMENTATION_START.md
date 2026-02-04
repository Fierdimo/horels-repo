# V2 Implementation - Getting Started

**Status:** Phase 0 Complete - Ready for Phase 1  
**Date:** 2026-02-01  
**Branch:** Create `v2-implementation` branch before starting

---

## ✅ What's Complete (Phase 0)

1. **Specification Documents**
   - ✅ `docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md` - Complete technical specification
   - ✅ `docs_v2/USER_EXPERIENCE_DESIGN.md` - UX/UI requirements
   - ✅ `docs_v2/DATABASE_DESIGN.md` - Database architecture
   - ✅ `docs_v2/ARCHITECTURE_REVIEW.md` - V1 vs V2 analysis

2. **Database Migrations (Clean V2)**
   - ✅ `migrations_v2/` - 9 clean migrations from scratch
   - ✅ All 8 core tables defined (properties, units, ownerships, allocations, credits, bookings, inventory)
   - ✅ Performance indexes on hot tables
   - ✅ Foreign keys and constraints

3. **Scripts**
   - ✅ `scripts/reset-db-v2.ts` - Clean database reset for V2
   - ✅ Package.json scripts updated

---

## 🚀 Quick Start Guide

### Step 1: Create V2 Branch

```bash
cd backend
git checkout -b v2-implementation
git push -u origin v2-implementation
```

### Step 2: Setup Database

```bash
# Option A: Clean start (DEVELOPMENT ONLY!)
npm run db:reset:v2    # Drops V2 tables
npm run migrate:v2     # Run V2 migrations

# Option B: Just run migrations (if DB clean)
npm run migrate:v2
```

### Step 3: Verify Tables Created

```bash
# Connect to MariaDB
mysql -u sw2_user -p sw2_db

# Check tables
SHOW TABLES LIKE 'timeshare_%';
SHOW TABLES LIKE 'credit_%';
SHOW TABLES LIKE 'week_allocations';

# Check indexes on hot table
SHOW INDEX FROM week_allocations;
```

Expected tables:
- ✅ `timeshare_properties`
- ✅ `timeshare_units`
- ✅ `ownerships`
- ✅ `week_allocations` (HOT TABLE - 6+ indexes)
- ✅ `credit_accounts`
- ✅ `credit_transactions` (IMMUTABLE)
- ✅ `v2_bookings`
- ✅ `hotel_inventory`

### Step 4: Next Steps (Phase 1)

Now you're ready to start **Phase 1: Core Domain Model**

1. Create Sequelize models
2. Create repositories
3. Write unit tests

---

## 📋 Implementation Phases

### Phase 0: Preparation ✅ COMPLETE
- [x] Specifications
- [x] Database design
- [x] Migrations
- [x] Scripts

### Phase 1: Core Domain Model (Week 2-3) 👈 **START HERE**
- [ ] Create Sequelize models for 8 core tables
- [ ] Create repository layer (data access)
- [ ] Unit tests for models
- [ ] Integration tests for repositories

### Phase 2: Core Services (Week 4-5)
- [ ] OwnershipService (CRUD operations)
- [ ] WeekAllocationService (generate annual allocations)
- [ ] CreditService (transactions, balance)
- [ ] CreditCalculationStrategy (seasonal + timing)

### Phase 3: Week Release Feature (Week 6)
- [ ] WeekReleaseService (core business logic)
- [ ] API endpoints (POST /owner/release-week)
- [ ] Frontend: Owner dashboard

### Phase 4: Unified Search (Week 7-8)
- [ ] UnifiedSearchService (timeshare + hotel)
- [ ] API endpoints (POST /search)
- [ ] Frontend: Search page

### Phase 5-9: Booking, PMS, Admin, Testing, Migration
See `TIMESHARE_PLATFORM_V2_SPEC.md` for complete plan

---

## 🏗️ Architecture Overview

```
src/
├── models/v2/              # Sequelize models (Phase 1)
│   ├── TimeshareProperty.ts
│   ├── TimeshareUnit.ts
│   ├── Ownership.ts
│   ├── WeekAllocation.ts
│   ├── CreditAccount.ts
│   ├── CreditTransaction.ts
│   ├── V2Booking.ts
│   └── HotelInventory.ts
│
├── repositories/v2/        # Data access layer (Phase 1)
│   ├── OwnershipRepository.ts
│   ├── WeekAllocationRepository.ts
│   ├── CreditRepository.ts
│   └── BookingRepository.ts
│
├── services/v2/            # Business logic (Phase 2+)
│   ├── OwnershipService.ts
│   ├── WeekReleaseService.ts
│   ├── CreditService.ts
│   ├── UnifiedSearchService.ts
│   └── BookingService.ts
│
├── controllers/v2/         # API controllers (Phase 3+)
│   ├── OwnershipController.ts
│   ├── SearchController.ts
│   ├── BookingController.ts
│   └── CreditController.ts
│
└── routes/v2/              # API routes (Phase 3+)
    └── index.ts
```

---

## 🎯 Key Principles (Reminder)

### SOLID Design
- **S**ingle Responsibility: Each service has ONE job
- **O**pen/Closed: Extend via interfaces (PMSAdapter, CreditStrategy)
- **L**iskov Substitution: Booking types interchangeable
- **I**nterface Segregation: No fat interfaces
- **D**ependency Inversion: Depend on abstractions

### Performance Targets
- Search queries: **< 500ms** (p95)
- Credit transactions: **< 50ms**
- Booking creation: **< 200ms** (excluding PMS)

### UX Requirements
All features MUST follow `USER_EXPERIENCE_DESIGN.md`:
- Minimal user input
- Maximum automation
- Progressive disclosure
- One-click actions

---

## 🔗 Critical Documents

Before coding, READ these:

1. **TIMESHARE_PLATFORM_V2_SPEC.md** - What to build
2. **DATABASE_DESIGN.md** - How data is structured
3. **USER_EXPERIENCE_DESIGN.md** - How it should work

---

## 🐛 Debugging & Troubleshooting

### Migration Issues

```bash
# Check migration status
npx sequelize-cli db:migrate:status --migrations-path migrations_v2

# Undo last migration
npm run migrate:undo:v2

# Reset and try again
npm run db:reset:v2 && npm run migrate:v2
```

### Database Connection Issues

Check `.env` file:
```env
DB_HOST=localhost
DB_USER=sw2_user
DB_PASSWORD=sw2_password
DB_NAME=sw2_db
```

### Foreign Key Errors

V2 migrations handle circular dependencies (week_allocations ↔ bookings).
If you see FK errors, ensure migrations run in order.

---

## 📞 Need Help?

1. Check specs: `docs_v2/*.md`
2. Review migrations: `migrations_v2/*.js`
3. Check database design for schema details

---

## ✨ Success Criteria

You'll know Phase 1 is complete when:
- ✅ All 8 models created with proper associations
- ✅ All repositories have CRUD methods
- ✅ Unit tests pass (90%+ coverage)
- ✅ Can create ownership → units → allocations programmatically

**Next:** Move to Phase 2 (Services)

---

**Last Updated:** 2026-02-01  
**Status:** Ready to start Phase 1
