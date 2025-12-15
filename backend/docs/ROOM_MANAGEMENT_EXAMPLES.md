# Room Management - Examples & Testing Guide

This guide provides practical examples for testing the room management and marketplace features.

## Prerequisites

1. **Authentication**: Get tokens for different roles
```bash
# Admin token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Staff token (must be assigned to a property)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@hotel1.com","password":"password123"}'
```

2. **Property Setup**: Ensure property exists with PMS configured (optional)

---

## Staff Workflows

### Workflow 1: Manual Room Creation (No PMS)

**Scenario**: Hotel staff creating rooms manually

```bash
# 1. Create first room
curl -X POST http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Room 101",
    "description": "Standard room with garden view",
    "capacity": 2,
    "type": "Standard",
    "floor": "1",
    "status": "active",
    "amenities": ["wifi", "tv", "minibar", "air_conditioning"],
    "basePrice": 89.00,
    "isMarketplaceEnabled": true,
    "images": ["https://example.com/room101.jpg"]
  }'

# 2. Create deluxe room with custom pricing
curl -X POST http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Room 201",
    "description": "Deluxe room with ocean view and balcony",
    "capacity": 3,
    "type": "Deluxe",
    "floor": "2",
    "amenities": ["wifi", "tv", "minibar", "balcony", "jacuzzi"],
    "basePrice": 150.00,
    "customPrice": 135.00,
    "isMarketplaceEnabled": true
  }'

# 3. Create VIP suite (not in marketplace initially)
curl -X POST http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Presidential Suite",
    "description": "Luxury suite with panoramic views",
    "capacity": 4,
    "type": "Suite",
    "basePrice": 500.00,
    "isMarketplaceEnabled": false
  }'

# 4. List all rooms
curl -X GET http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <staff-token>"
```

---

### Workflow 2: PMS Import & Customization

**Scenario**: Hotel with Mews/Cloudbeds PMS wants to import rooms

```bash
# 1. Import rooms from PMS
curl -X POST http://localhost:3000/api/hotel-staff/rooms/import-from-pms \
  -H "Authorization: Bearer <staff-token>"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "imported": 12,
#     "updated": 0,
#     "rooms": [...]
#   },
#   "message": "Imported 12 new rooms, updated 0 existing rooms"
# }

# 2. View imported rooms (all disabled by default)
curl -X GET http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer <staff-token>"

# 3. Customize imported room
curl -X PUT http://localhost:3000/api/hotel-staff/rooms/5 \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Beautiful standard room with modern amenities",
    "customPrice": 95.00,
    "amenities": ["wifi", "smart_tv", "minibar", "safe"],
    "images": ["https://cdn.hotel.com/room5-1.jpg", "https://cdn.hotel.com/room5-2.jpg"]
  }'

# 4. Enable room in marketplace
curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/5/marketplace \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# 5. Enable multiple rooms at once
for id in 6 7 8 9 10; do
  curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/$id/marketplace \
    -H "Authorization: Bearer <staff-token>" \
    -H "Content-Type: application/json" \
    -d '{"enabled": true}'
done

# 6. Reserve some rooms for direct bookings (disable in marketplace)
curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/11/marketplace \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

---

### Workflow 3: Inventory Management

**Scenario**: Staff managing room availability and pricing

```bash
# 1. Update room pricing for high season
curl -X PUT http://localhost:3000/api/hotel-staff/rooms/5 \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customPrice": 120.00
  }'

# 2. Temporarily disable room (maintenance)
curl -X PUT http://localhost:3000/api/hotel-staff/rooms/7 \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'

# 3. Re-enable room after maintenance
curl -X PUT http://localhost:3000/api/hotel-staff/rooms/7 \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }'

# 4. Update amenities
curl -X PUT http://localhost:3000/api/hotel-staff/rooms/5 \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amenities": ["wifi", "smart_tv", "minibar", "safe", "balcony", "coffee_machine"]
  }'

# 5. Delete room (careful - permanent)
curl -X DELETE http://localhost:3000/api/hotel-staff/rooms/99 \
  -H "Authorization: Bearer <staff-token>"
```

---

## Guest Workflows

### Workflow 4: Browsing Marketplace

**Scenario**: Guest looking for a hotel room

```bash
# 1. Browse all properties in marketplace
curl -X GET http://localhost:3000/api/public/properties

# 2. View specific property details
curl -X GET http://localhost:3000/api/public/properties/1

# 3. View available rooms at property
curl -X GET http://localhost:3000/api/public/properties/1/rooms

# 4. Filter rooms by type
curl -X GET "http://localhost:3000/api/public/properties/1/rooms?type=Deluxe"

# 5. Filter by capacity and price
curl -X GET "http://localhost:3000/api/public/properties/1/rooms?min_capacity=2&max_price=100"

# 6. View specific room details
curl -X GET http://localhost:3000/api/public/properties/1/rooms/5
```

---

### Workflow 5: Checking Availability

**Scenario**: Guest wants to book for specific dates

```bash
# 1. Check general availability
curl -X GET "http://localhost:3000/api/public/properties/1/availability?start_date=2025-12-20&end_date=2025-12-23"

# Response with PMS:
# {
#   "success": true,
#   "data": {
#     "available": true,
#     "availableNights": 3,
#     "source": "pms",
#     "pms_provider": "mews"
#   }
# }

# Response without PMS:
# {
#   "success": true,
#   "data": {
#     "available": true,
#     "totalRooms": 10,
#     "bookedRooms": 3,
#     "availableRooms": 7,
#     "source": "local"
#   }
# }

# 2. Check availability for specific room type
curl -X GET "http://localhost:3000/api/public/properties/1/availability?start_date=2025-12-20&end_date=2025-12-23&room_type=Standard"
```

---

## Testing Scenarios

### Test 1: PMS Integration

**Objective**: Verify PMS import and sync

```bash
# Setup: Configure property with Mews credentials

# 1. Import rooms
STAFF_TOKEN="<your-staff-token>"
curl -X POST http://localhost:3000/api/hotel-staff/rooms/import-from-pms \
  -H "Authorization: Bearer $STAFF_TOKEN"

# Verify: Check response shows imported rooms

# 2. List rooms
curl -X GET http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer $STAFF_TOKEN"

# Verify: Each room has pmsResourceId and pmsLastSync

# 3. Check public marketplace
curl -X GET http://localhost:3000/api/public/properties/1/rooms

# Verify: No rooms shown (all disabled by default)

# 4. Enable one room
curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/1/marketplace \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"enabled": true}'

# 5. Check public again
curl -X GET http://localhost:3000/api/public/properties/1/rooms

# Verify: Now shows the enabled room
```

---

### Test 2: Selective Marketplace Control

**Objective**: Verify staff can control which rooms appear in marketplace

```bash
STAFF_TOKEN="<your-staff-token>"

# 1. Create 3 rooms
for i in 1 2 3; do
  curl -X POST http://localhost:3000/api/hotel-staff/rooms \
    -H "Authorization: Bearer $STAFF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Room 10$i\",
      \"capacity\": 2,
      \"type\": \"Standard\",
      \"basePrice\": 89.00,
      \"isMarketplaceEnabled\": false
    }"
done

# 2. Check marketplace (should be empty)
curl -X GET http://localhost:3000/api/public/properties/1/rooms

# 3. Enable only room 101
ROOM_ID=$(curl -X GET http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq '.data[] | select(.name=="Room 101") | .id')

curl -X PATCH http://localhost:3000/api/hotel-staff/rooms/$ROOM_ID/marketplace \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"enabled": true}'

# 4. Check marketplace again
curl -X GET http://localhost:3000/api/public/properties/1/rooms

# Verify: Only Room 101 appears
```

---

### Test 3: Custom Pricing

**Objective**: Verify customPrice overrides basePrice

```bash
STAFF_TOKEN="<your-staff-token>"

# 1. Create room with basePrice
curl -X POST http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{
    "name": "Test Room",
    "capacity": 2,
    "basePrice": 100.00,
    "isMarketplaceEnabled": true
  }'

# 2. Check marketplace price
curl -X GET http://localhost:3000/api/public/properties/1/rooms | jq '.data[] | select(.name=="Test Room") | .effectivePrice'

# Verify: effectivePrice = 100.00

# 3. Set custom price
ROOM_ID=$(curl -X GET http://localhost:3000/api/hotel-staff/rooms \
  -H "Authorization: Bearer $STAFF_TOKEN" | jq '.data[] | select(.name=="Test Room") | .id')

curl -X PUT http://localhost:3000/api/hotel-staff/rooms/$ROOM_ID \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"customPrice": 85.00}'

# 4. Check marketplace again
curl -X GET http://localhost:3000/api/public/properties/1/rooms | jq '.data[] | select(.name=="Test Room") | .effectivePrice'

# Verify: effectivePrice = 85.00
```

---

### Test 4: Availability Logic

**Objective**: Verify availability calculation

```bash
# 1. Create property with 5 rooms
# 2. Create 3 bookings for overlapping dates
# 3. Check availability

curl -X GET "http://localhost:3000/api/public/properties/1/availability?start_date=2025-12-20&end_date=2025-12-23"

# Verify response shows:
# {
#   "totalRooms": 5,
#   "bookedRooms": 3,
#   "availableRooms": 2,
#   "available": true
# }
```

---

## Common Issues & Solutions

### Issue 1: "Staff user must be assigned to a property"

**Cause**: Staff user doesn't have property_id set

**Solution**:
```sql
-- In database
UPDATE users SET property_id = 1 WHERE email = 'staff@hotel.com';
```

### Issue 2: "No rooms found in PMS"

**Cause**: PMS doesn't have resources configured or API returned empty

**Solution**:
- Verify PMS configuration in property
- Test PMS connection: `GET /properties/:id/pms/test`
- Check PMS credentials are valid

### Issue 3: Imported rooms not visible in marketplace

**Cause**: By default, imported rooms have `isMarketplaceEnabled=false`

**Solution**: Enable rooms manually via PATCH endpoint

### Issue 4: Availability always returns "available: true"

**Cause**: No bookings exist or date range is far in future

**Solution**: Create test bookings to verify logic

---

## Database Queries for Debugging

```sql
-- Check all rooms for a property
SELECT * FROM rooms WHERE property_id = 1;

-- Check marketplace-enabled rooms
SELECT * FROM rooms WHERE property_id = 1 AND is_marketplace_enabled = true;

-- Check rooms with PMS mapping
SELECT * FROM rooms WHERE pms_resource_id IS NOT NULL;

-- Check rooms with custom pricing
SELECT name, base_price, custom_price FROM rooms WHERE custom_price IS NOT NULL;

-- Check bookings overlapping with date range
SELECT * FROM bookings 
WHERE property_id = 1 
AND status IN ('confirmed', 'pending')
AND (
  check_in_date BETWEEN '2025-12-20' AND '2025-12-23'
  OR check_out_date BETWEEN '2025-12-20' AND '2025-12-23'
  OR (check_in_date <= '2025-12-20' AND check_out_date >= '2025-12-23')
);
```

---

## Performance Considerations

1. **Indexes**: The migration creates indexes on:
   - `(property_id, is_marketplace_enabled)` - for marketplace queries
   - `pms_resource_id` - for PMS lookups

2. **Caching**: Consider caching marketplace room lists (Redis)

3. **PMS Calls**: Availability checks hit PMS in real-time - consider rate limiting

4. **Image Optimization**: Store image URLs, not binary data

---

## Next Steps

1. Implement dynamic pricing calendar
2. Add room-specific availability calendar
3. Implement booking flow with room selection
4. Add review/rating system per room type
5. Analytics dashboard for occupancy rates
