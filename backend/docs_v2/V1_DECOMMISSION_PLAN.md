# V1 Decommission Plan - Complete Cutover Strategy

## Overview

**Strategy:** Direct cutover from V1 to V2 (no gradual migration).

**Rationale:**
- Simpler architecture (no dual-system complexity)
- Faster implementation (no V1/V2 compatibility layer)
- Cleaner codebase (remove all legacy code)
- Lower maintenance cost

**Risk Mitigation:**
- Comprehensive testing before cutover
- Data migration dry-run on staging
- Rollback plan with database backup
- Maintenance window for cutover

---

## V1 Components to Remove

### 1. Models (V1 Legacy)

**Files to DELETE:**
```
src/models/TimeshareAllocation.ts  ❌ DELETE - Replaced by week_allocations (V2)
src/models/SwapRequest.ts           ❌ DELETE - Not in V2 scope
```

**Models to KEEP:**
```
src/models/User.ts                  ✅ KEEP - Used in V2
src/models/Property.ts              ✅ KEEP - Used in V2 (or migrate to TimeshareProperty)
src/models/Booking.ts               ✅ KEEP - Check if used by V1 only
```

**Action Items:**
- [ ] Audit all models in `src/models/`
- [ ] Identify V1-only models
- [ ] Check for dependencies before deletion
- [ ] Create V2 equivalents where needed

---

### 2. Services (V1 Legacy)

**Files to DELETE:**
```
src/services/PrepaidInventoryService.ts  ❌ DELETE - Replaced by WeekAllocationService (V2)
src/services/swapService.ts              ❌ DELETE - Swap feature not in V2 initial scope
```

**Services to KEEP:**
```
src/services/UnifiedSearchService.ts     🔄 REFACTOR - Upgrade to use V2 models/repos
src/services/stripeService.ts            ✅ KEEP - Used for payments in V2
src/services/bookingService.ts           🔄 REFACTOR - Check if V1-specific
```

**Action Items:**
- [ ] Map V1 services to V2 equivalents
- [ ] Identify services with mixed V1/V2 logic
- [ ] Refactor or replace with V2 services
- [ ] Remove swap-related services (defer to Phase 10+)

---

### 3. Controllers (V1 Legacy)

**Files to DELETE:**
```
src/controllers/TimeshareAllocationController.ts  ❌ DELETE - Replaced by V2 controllers
```

**Action Items:**
- [ ] Review all controllers in `src/controllers/`
- [ ] Delete V1-specific controllers
- [ ] Create V2 equivalents (Phase 3)

---

### 4. Routes (V1 Legacy)

**Files to DELETE:**
```
src/routes/prepaidInventoryRoutes.ts  ❌ DELETE
src/routes/swapRoutes.ts              ❌ DELETE
src/routes/staffSwapRoutes.ts         ❌ DELETE
```

**app.ts Changes:**
```typescript
// REMOVE these lines:
import swapRoutes from './routes/swapRoutes';
import staffSwapRoutes from './routes/staffSwapRoutes';
import prepaidInventoryRoutes from './routes/prepaidInventoryRoutes';

app.use('/hotels/owner/swaps', authenticateToken, swapRoutes);
app.use('/hotels/staff/swaps', authenticateToken, staffSwapRoutes);
app.use('/hotels/admin/prepaid-inventory', prepaidInventoryRoutes);

// ADD V2 routes (Phase 3):
import weekReleaseRoutes from './routes/v2/weekReleaseRoutes';
import ownershipRoutes from './routes/v2/ownershipRoutes';
import creditRoutes from './routes/v2/creditRoutes';

app.use('/api/v2/weeks', authenticateToken, weekReleaseRoutes);
app.use('/api/v2/ownerships', authenticateToken, ownershipRoutes);
app.use('/api/v2/credits', authenticateToken, creditRoutes);
```

**Action Items:**
- [ ] Remove V1 route imports from app.ts
- [ ] Delete V1 route files
- [ ] Add V2 route imports (after Phase 3)

---

### 5. Database Tables (V1 Legacy)

**Tables to DROP (after 30-day grace period):**
```sql
DROP TABLE IF EXISTS timeshare_allocations;  -- Old name for prepaid inventory
DROP TABLE IF EXISTS swap_requests;          -- Swap feature (not in V2 initial)
DROP TABLE IF EXISTS swap_transactions;      -- Swap feature (not in V2 initial)
```

**Tables to KEEP:**
```sql
users                    ✅ KEEP
properties               ✅ KEEP (or migrate to timeshare_properties)
bookings                 🔄 CHECK - May need to migrate to v2_bookings
```

**Action Items:**
- [ ] Identify all V1 tables
- [ ] Map to V2 equivalents
- [ ] Create migration script for data
- [ ] Drop V1 tables after grace period

---

### 6. Migrations (V1 Legacy)

**Location:** `backend/migrations/` (old migrations)
**V2 Location:** `backend/migrations_v2/` (clean V2 migrations)

**Action Items:**
- [ ] Keep old migrations for historical reference
- [ ] Do NOT run old migrations on V2 databases
- [ ] Use only migrations_v2/ for V2 schema

---

### 7. UnifiedSearchService (Hybrid - Needs Refactor)

**Current State:** Uses V1 models (`TimeshareAllocation`)
**Target State:** Use V2 models (`WeekAllocation`)

**File:** `src/services/UnifiedSearchService.ts`

**Required Changes:**
```typescript
// BEFORE (V1):
import TimeshareAllocation from '../models/TimeshareAllocation';

const allocations = await TimeshareAllocation.findAll({
  where: {
    is_released: true,
    valid_from: { [Op.lte]: checkIn },
    valid_until: { [Op.gte]: checkOut }
  }
});

// AFTER (V2):
import { WeekAllocationRepository } from '../repositories/v2/WeekAllocationRepository';

const weekRepo = new WeekAllocationRepository();
const allocations = await weekRepo.findAvailableWeeks({
  start: checkIn,
  end: checkOut
});
```

**Action Items:**
- [ ] Refactor UnifiedSearchService to use V2 repositories
- [ ] Update search queries to match V2 schema
- [ ] Test search functionality end-to-end
- [ ] Remove V1 model imports

---

## Data Migration Strategy

### One-Time Migration Script

**Location:** `backend/scripts/migrate-v1-to-v2.ts`

**Steps:**
1. **Backup V1 database**
   ```bash
   mysqldump -u root -p hotels_db > backup_v1_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run migration script**
   ```bash
   npm run migrate:v1-to-v2
   ```

3. **Validation checks**
   - Row counts match (users, properties, bookings)
   - Week allocations migrated correctly
   - Credit accounts created for all owners
   - No orphaned records

4. **Rollback if needed**
   ```bash
   mysql -u root -p hotels_db < backup_v1_YYYYMMDD_HHMMSS.sql
   ```

**Migration Mappings:**

| V1 Table | V2 Table | Notes |
|----------|----------|-------|
| `timeshare_allocations` | `week_allocations` | Map `is_released` → `status`, `valid_from` → `start_date` |
| `swap_requests` | ❌ Drop | Not in V2 initial scope |
| `bookings` | `v2_bookings` | Add `source`, `confirmation_code` |
| `properties` | `timeshare_properties` | Add V2 fields (`pms_provider`, etc.) |

**Action Items:**
- [ ] Write migration script
- [ ] Test on staging with production data copy
- [ ] Validate data integrity
- [ ] Document rollback procedure

---

## Cutover Plan

### Pre-Cutover Checklist (Week 14)

- [ ] All Phase 1-3 tests passing (unit + integration + E2E)
- [ ] Migration script tested on staging
- [ ] Rollback plan documented and tested
- [ ] Monitoring dashboards ready
- [ ] Customer communication sent (maintenance window)
- [ ] Backup verification complete

### Cutover Day (Week 15 - Saturday 2AM-6AM)

**Timeline:**

| Time | Task | Owner | Duration |
|------|------|-------|----------|
| 2:00 AM | Enable maintenance mode | DevOps | 5 min |
| 2:05 AM | Backup V1 database | DevOps | 15 min |
| 2:20 AM | Run migration script | Backend | 30 min |
| 2:50 AM | Deploy V2 code | DevOps | 15 min |
| 3:05 AM | Smoke tests | QA | 20 min |
| 3:25 AM | Disable maintenance mode | DevOps | 5 min |
| 3:30 AM | Monitor for 30 min | All | 30 min |
| 4:00 AM | Go/No-Go decision | CTO | - |

**Rollback Trigger:** Any critical issue (authentication, booking, payment)

**Rollback Procedure:**
1. Enable maintenance mode
2. Restore V1 database from backup
3. Deploy V1 code (from `v1-archive` branch)
4. Smoke tests
5. Disable maintenance mode
6. Post-mortem meeting

### Post-Cutover Monitoring (48 hours)

**Metrics to Watch:**
- API response times (p95 < 2s)
- Error rates (< 0.1%)
- Booking success rate (> 99%)
- Search performance (< 1s)
- Database query times

**On-Call Rotation:**
- First 24 hours: Full team available
- Next 24 hours: Reduced team

---

## Code Cleanup Timeline

### Immediate (Day 1 - Post-Cutover)
- [ ] Comment out V1 routes in app.ts (don't delete yet)
- [ ] Update README to reflect V2 only
- [ ] Update API documentation

### Week 1 (Grace Period)
- [ ] Monitor for any issues
- [ ] No code deletions yet
- [ ] Keep V1 code for emergency rollback

### Week 2-4 (Gradual Cleanup)
- [ ] Delete V1 controllers
- [ ] Delete V1 services
- [ ] Delete V1 routes
- [ ] Update tests to remove V1 references

### Day 30 (Final Cleanup)
- [ ] Drop V1 database tables
- [ ] Delete V1 models
- [ ] Archive V1 code to `v1-archive` branch
- [ ] Delete V1 code from main branch
- [ ] Update dependencies (remove unused packages)

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration script fails | Low | High | Test on staging 3x, have rollback ready |
| Data loss during migration | Very Low | Critical | Multiple backups, validation checks |
| Performance degradation | Medium | Medium | Load testing before cutover, monitoring |
| Authentication issues | Low | High | Test auth flow extensively |
| PMS integration breaks | Medium | Medium | Keep PMS adapters compatible, test with sandbox |

---

## Success Criteria

**Cutover is successful if:**
- ✅ Zero data loss (all V1 data migrated)
- ✅ All critical features working (auth, booking, search)
- ✅ No rollback needed within 48 hours
- ✅ Error rate < 0.1%
- ✅ Customer complaints < 5 (minor issues only)

**Decommission is complete when:**
- ✅ All V1 code removed from codebase
- ✅ All V1 tables dropped from database
- ✅ V2-only documentation published
- ✅ Team trained on V2 architecture
- ✅ No V1 references in monitoring/logs

---

## Team Responsibilities

**Backend Lead:**
- Write migration script
- Review all V1 code for deletion
- Update app.ts routes

**QA Lead:**
- Test migration on staging
- Create smoke test checklist
- Monitor post-cutover

**DevOps:**
- Database backups
- Deployment automation
- Monitoring setup

**CTO:**
- Final Go/No-Go decision
- Customer communication
- Rollback authority

---

## Next Steps (After Phase 2 Complete)

1. **Phase 2.5:** Integration tests for services
2. **Phase 3:** API controllers (V2 routes)
3. **Week 14:** Migration script + staging test
4. **Week 15:** Cutover weekend
5. **Week 16:** V1 code cleanup begins
6. **Day 30:** V1 fully decommissioned

---

## Questions for Stakeholders

1. **Maintenance Window:** Is Saturday 2AM-6AM acceptable?
2. **Customer Communication:** How much notice do we give customers?
3. **Rollback Threshold:** What defines a "critical issue" requiring rollback?
4. **Grace Period:** Is 30 days enough before dropping V1 tables?
5. **Team Availability:** Can full team be available for 48-hour monitoring?

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Owner:** Backend Team  
**Status:** Draft (pending stakeholder approval)
