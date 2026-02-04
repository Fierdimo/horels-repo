# 🏨 Prepaid Inventory Management - Quick Start Guide

## Overview

The **Prepaid Inventory Management System** allows the platform to manage hotel rooms that are already prepaid (through condominium fees, annual contracts, or timeshare weeks).

### 💰 Business Value
- **100% margin** on prepaid inventory (vs ~30% on standard PMS bookings)
- **Zero marginal cost** for already-owned rooms
- **Priority system** automatically prefers prepaid inventory in searches

---

## ✅ Backend Implementation Status

### Completed Components

1. ✅ **Database Model** (`TimeshareAllocation`)
   - Multi-PMS support (Mews, Cloudbeds, Opera, ResNexus)
   - Flexible metadata storage (JSON)
   - Owner assignment tracking
   - Date range validation

2. ✅ **Business Logic** (`PrepaidInventoryService`)
   - CRUD operations with validation
   - Bulk PMS import
   - Statistics & reporting
   - Availability search

3. ✅ **REST API** (`TimeshareAllocationController`)
   - 8 endpoints with role-based access
   - Admin sees all properties
   - Staff sees only their property

4. ✅ **Search Integration** (`UnifiedSearchService`)
   - 3-tier priority system:
     - Priority 1: Prepaid allocations (100% margin)
     - Priority 2: Released inventory (100% margin)
     - Priority 3: Standard PMS rooms (~30% margin)

5. ✅ **Database Migration**
   - Table created successfully
   - 6 indexes for performance
   - MariaDB compatible (JSON type)

---

## 🚀 API Endpoints

Base URL: `/hotels/admin/prepaid-inventory`

### List Allocations
```http
GET /hotels/admin/prepaid-inventory
Query params: property_id, status, room_type, is_released, expiring_soon, page, limit
```

### Get Single Allocation
```http
GET /hotels/admin/prepaid-inventory/:id
```

### Create Allocation
```http
POST /hotels/admin/prepaid-inventory
Body:
{
  "property_id": 1,
  "pms_resource_id": "room_001",
  "pms_provider": "mews",
  "room_number": "305",
  "room_type": "standard",
  "valid_from": "2026-01-01",
  "valid_until": "2026-12-31",
  "allocation_type": "ANNUAL_CONTRACT",
  "prepaid_amount": 6000,
  "currency": "EUR"
}
```

### Update Allocation
```http
PUT /hotels/admin/prepaid-inventory/:id
Body: (partial update supported)
```

### Delete Allocation
```http
DELETE /hotels/admin/prepaid-inventory/:id
```

### Bulk Import from PMS
```http
POST /hotels/admin/prepaid-inventory/bulk-import
Body:
{
  "property_id": 1,
  "resource_ids": ["room_001", "room_002", "room_003"],
  "config": {
    "valid_from": "2026-01-01",
    "valid_until": "2026-12-31",
    "allocation_type": "ANNUAL_CONTRACT",
    "prepaid_amount": 6000,
    "currency": "EUR"
  }
}
```

### Get Statistics
```http
GET /hotels/admin/prepaid-inventory/stats
Query params: property_id (optional)
```

### Sync with PMS
```http
POST /hotels/admin/prepaid-inventory/:id/sync
```

---

## 🔐 Authentication & Authorization

All endpoints require:
1. Valid JWT token (`Authorization: Bearer <token>`)
2. Role: `admin` or `staff`

**Access Rules:**
- **Admin**: Can manage all properties
- **Staff**: Can only manage their assigned property

---

## 🧪 Testing

### Run Test Script
```bash
cd backend
npx ts-node scripts/test-prepaid-inventory.ts
```

This will:
1. Create a test allocation
2. Get statistics
3. List allocations
4. Test unified search (priority system)
5. Find available rooms

### Manual Testing with cURL

**Create allocation:**
```bash
curl -X POST http://localhost:3000/hotels/admin/prepaid-inventory \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 1,
    "pms_resource_id": "test_room_001",
    "pms_provider": "mews",
    "room_number": "305",
    "room_type": "standard",
    "valid_from": "2026-01-01",
    "valid_until": "2026-12-31",
    "allocation_type": "ANNUAL_CONTRACT",
    "prepaid_amount": 6000,
    "currency": "EUR"
  }'
```

**Get statistics:**
```bash
curl http://localhost:3000/hotels/admin/prepaid-inventory/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Database Schema

**Table:** `timeshare_allocations`

Key fields:
- `property_id` - Which hotel
- `pms_resource_id` - Room ID in PMS system
- `pms_provider` - mews/cloudbeds/opera/resnexus
- `pms_metadata` - JSON for PMS-specific data
- `room_number` / `room_type` / `floor_number`
- `valid_from` / `valid_until` - Date range
- `allocation_type` - ANNUAL_CONTRACT/TIMESHARE_WEEK/OWNER_WEEK/OTHER
- `status` - active/inactive/expired
- `is_released` - If owner converted to credits
- `current_week_owner_id` - Who owns this week
- `prepaid_amount` / `condominium_fee` - Financial tracking

---

## 🎯 Next Steps

### Frontend Admin Panel (High Priority)
1. **List View** - Table with filters, search, pagination
2. **Create/Edit Form** - PMS resource lookup, date picker
3. **Bulk Import Modal** - Multi-select from PMS, apply config
4. **Statistics Dashboard** - Occupancy, margins, expiring allocations

### Search Integration (High Priority)
1. Update marketplace search to call `UnifiedSearchService`
2. Add visual badges for prepaid vs standard rooms
3. Implement PMS availability verification
4. Test priority sorting

### Availability Alerts (Medium Priority)
1. Create `availability_alerts` table
2. Implement notification service
3. Add waitlist UI for users
4. Trigger alerts when rooms become available

### Additional Features (Low Priority)
1. Allocation history/audit log
2. Automated expiration handling
3. Owner self-service portal
4. Financial reporting by allocation type

---

## 💡 Key Concepts

### Allocation Types
- **ANNUAL_CONTRACT**: Full-year prepaid contract
- **TIMESHARE_WEEK**: Specific week ownership
- **OWNER_WEEK**: Condominium owner's personal week
- **OTHER**: Custom arrangements

### Status Flow
1. **active** - Currently valid and usable
2. **inactive** - Temporarily disabled
3. **expired** - Valid_until date has passed

### Priority System
```
Search Query → 
  1. Prepaid Allocations (100% margin) →
  2. Released Inventory (100% margin) →
  3. Standard PMS Rooms (30% margin)
```

### Owner Credit Conversion
When an owner converts their week to credits:
1. Set `is_released = true`
2. Room moves to "released inventory" (Priority 2)
3. Platform can now sell it in marketplace
4. Still 100% margin (already prepaid)

---

## 🐛 Troubleshooting

### Migration Issues
If you see "Unknown data type: JSONB":
- You're using MariaDB (not PostgreSQL)
- We use `JSON` type (not `JSONB`)
- Already fixed in latest migration

### Docker Connection
Database runs in Docker container:
```bash
# Check if running
docker ps | grep mariadb

# Access database
docker exec -it sw2_mariadb mysql -u root -p
```

### PMS Integration
- `pms_resource_id` must exist in PMS system
- Use bulk import to validate resources exist
- Sync endpoint checks current PMS state

---

## 📚 Related Documentation

- [Backend API Documentation](./API_DOCUMENTATION.md)
- [Credit System Integration](./CREDIT_SYSTEM_API.md)
- [PMS Adapter Guide](../src/services/pms/README.md)
- [Testing Guide](./README_TESTS.md)

---

## ✉️ Support

For questions or issues:
1. Check error messages in console
2. Review API response codes
3. Check authorization (admin/staff roles)
4. Verify property_id matches user's access

---

**Status**: ✅ Backend complete, ready for frontend integration
**Last Updated**: January 30, 2026
