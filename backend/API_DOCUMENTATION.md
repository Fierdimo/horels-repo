# SW2 Backend - API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
Most endpoints require authentication via JWT token. The token must be included in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 🎭 User Roles & Permissions

### Role Hierarchy
The SW2 platform uses a role-based access control system with four distinct roles:

#### 1. **Guest** (Default Role)
- **Purpose:** Non-owners who only make regular hotel bookings
- **Capabilities:**
  - Browse public marketplace
  - Make hotel reservations
  - View their own bookings
  - Manage their profile
- **Limitations:**
  - ❌ Cannot access timeshare features (weeks, swaps, night credits)
  - ❌ Cannot view or manage timeshare weeks
  - ❌ Cannot create swap requests
  
#### 2. **Owner** (Timeshare Owners)
- **Purpose:** Users who own timeshare weeks
- **How to become owner:**
  - 🎯 **Automatic Conversion:** When a guest receives their first timeshare week (purchase/gift/transfer), they are automatically upgraded to owner status
  - 💳 **Manual Conversion (paid):** Guests can pay a conversion fee via `/conversion/guest-to-owner` endpoint
- **Capabilities:**
  - All guest capabilities PLUS:
  - ✅ View and manage their timeshare weeks
  - ✅ Confirm week usage for stays
  - ✅ Create and manage swap requests with other owners
  - ✅ Convert weeks to night credits
  - ✅ Use night credits for bookings
- **Note:** The owner role is **permanent** - users cannot be downgraded back to guest

#### 3. **Staff** (Hotel Staff)
- **Purpose:** Hotel employees managing property operations
- **Registration:** Staff register by searching for their hotel in the PMS system
- **Approval:** Must be approved by admin or another approved staff member in the same property
- **Property Visibility:** Properties only appear in marketplace if they have at least one approved staff member
- **Capabilities:**
  - Manage their property's availability
  - Sync property data with PMS
  - View property bookings
  - Approve other staff requests for their property
- **Scope:** Staff can only manage data for their assigned property

#### 4. **Admin** (Platform Administrators)
- **Purpose:** Platform-wide management
- **How to become:** Only created by existing administrators via `POST /admin/create-admin`
- **Cannot self-register:** Admin accounts cannot be created through public registration for security reasons
- **Capabilities:**
  - Full access to all platform features
  - Manage all properties and users
  - Approve staff requests for any property
  - Control PMS sync worker
  - View platform-wide logs and reports
  - Create other admin accounts

### Guest → Owner Conversion Logic

#### Automatic Conversion
When a **guest** user receives their first timeshare week (through purchase, gift, or transfer), the system automatically:
1. Detects the week assignment
2. Checks if user is currently a guest
3. Upgrades user to owner role
4. Logs the conversion for audit trail
5. User immediately gains access to all timeshare features

#### Registration Restrictions
- ❌ Users **cannot** register directly as "owner"
- ❌ Users **cannot** register directly as "admin"
- ✅ Initial registration only allows: `guest`, `staff`
- **Owner Rationale:** You cannot be an owner without owning something - ownership must be earned through week assignment
- **Admin Rationale:** Admin accounts require authorization from existing administrators for security

#### Accessing Timeshare Features
All timeshare endpoints (`/timeshare/*`) require the `owner` role:
- `/timeshare/weeks` - View owned weeks
- `/timeshare/swaps` - Create/manage swaps
- `/timeshare/night-credits` - View/use night credits
- `/timeshare/weeks/:id/convert` - Convert weeks to credits

If a **guest** attempts to access these endpoints, they receive:
```json
{
  "error": "Owner role required",
  "message": "This feature is only available to timeshare owners. You must own at least one week to access timeshare features.",
  "currentRole": "guest",
  "hint": "Purchase or receive a timeshare week to be automatically upgraded to owner status."
}
```

---

## 📋 Table of Contents

1. [User Roles & Permissions](#user-roles--permissions)
2. [Authentication](#authentication)
3. [PMS Search (Property Registration)](#pms-search-property-registration)
4. [Public Marketplace](#public-marketplace)
5. [Properties Management](#properties-management)
6. [PMS Sync Worker](#pms-sync-worker)
7. [Staff Management](#staff-management)
8. [Client (Dashboard & Profile)](#client-dashboard--profile)
9. [Timesharing (Owners)](#timesharing-owners)
10. [Night Credit Requests (Owners)](#-night-credit-requests-owners)
11. [Night Credit Requests (Staff)](#-night-credit-requests-staff)
12. [Hotel Guest](#hotel-guest)
13. [Hotel Staff](#hotel-staff)
14. [Admin](#admin)
15. [PMS (Property Management System)](#pms-property-management-system)
16. [Stripe (Payments)](#stripe-payments)
17. [Conversion (Legacy)](#conversion-legacy)
18. [Health Check](#health-check)

---

## 🔐 Authentication

### POST `/auth/register`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "roleName": "guest" // Optional: guest, staff (default: guest)
  // NOTE: "owner" and "admin" are NOT allowed
  // - "owner": Users become owners automatically when they receive their first week
  // - "admin": Admin accounts can only be created by existing administrators via POST /admin/create-admin
}
```

// For staff registration, additional fields required:
```json
{
  "email": "staff@hotel.com",
  "password": "securePassword123",
  "roleName": "staff",
  "pms_property_id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
  "property_data": {
    "name": "API Hotel (Gross Pricing)",
    "city": "London",
    "country": "UK",
    "description": "Test property"
  }
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "userId": 1,
  "status": "approved" // "pending" for staff waiting approval
}
```

**Errors:**
- `400` - User already exists, invalid role, or restricted role (owner/admin)
  ```json
  {
    "error": "Cannot register as admin publicly. Admin accounts can only be created by existing administrators.",
    "allowedRoles": ["guest", "staff"],
    "hint": "Contact an existing administrator to create your admin account."
  }
  ```
- `500` - Registration error

---

### POST `/auth/login`
User login.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "owner"
  }
}
```

**Errors:**
- `401` - Credenciales inválidas
- `500` - Login error

---

### GET `/auth/me`
Get information of the authenticated user authenticated.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "owner"
  }
}
```

---

### DELETE `/auth/me`
Delete own account (user self-deletion).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

**Errors:**
- `401` - User not authenticated
- `500` - Failed to delete account

**Note:** This endpoint allows any authenticated user to delete their own account. The action is logged before deletion. All associated data (weeks, bookings, etc.) should be handled by database cascading rules or separate cleanup logic.

---

## 🔍 PMS Search (Property Registration)

These endpoints allow staff members to search for their hotel in the platform's PMS system during registration. The platform uses its own PMS credentials (stored in .env) to search properties - staff members never handle PMS credentials directly.

### GET `/pms-search/providers`
Get list of available PMS providers.

**Access:** Public (no authentication required)

**Response (200):**
```json
{
  "success": true,
  "providers": [
    {
      "id": "mews",
      "name": "Mews",
      "description": "Mews PMS Integration",
      "requiresCredentials": false
    },
    {
      "id": "cloudbeds",
      "name": "Cloudbeds",
      "description": "Cloudbeds PMS Integration",
      "requiresCredentials": false
    },
    {
      "id": "opera",
      "name": "Opera",
      "description": "Oracle Opera PMS",
      "requiresCredentials": false
    },
    {
      "id": "resnexus",
      "name": "ResNexus",
      "description": "ResNexus PMS",
      "requiresCredentials": false
    }
  ]
}
```

---

### POST `/pms-search/properties`
Search for properties in the platform's PMS account. Uses platform credentials automatically.

**Access:** Public (no authentication required)

**Request Body:**
```json
{
  "search": "hotel"  // Optional: search term to filter properties
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "propertyId": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
    "name": "API Hotel (Gross Pricing) - Do not change",
    "address": "11th Cross Park Avenue",
    "city": "London",
    "country": "GB",
    "timezone": "UTC",
    "alreadyRegistered": false,
    "existingPropertyId": null
  }
}
```

**Note:** 
- Returns the first matching property from the PMS
- `alreadyRegistered`: indicates if this PMS property already exists in the database
- `existingPropertyId`: database ID if property already registered
- Platform PMS credentials are used automatically (from .env)

**Errors:**
- `500` - Failed to fetch PMS properties

---

### POST `/pms-search/validate-property`
Validate that a specific property exists in the PMS.

**Access:** Public (no authentication required)

**Request Body:**
```json
{
  "propertyId": "851df8c8-90f2-4c4a-8e01-a4fc46b25178"
}
```

**Response (200):**
```json
{
  "success": true,
  "exists": true,
  "property": {
    "propertyId": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
    "name": "API Hotel (Gross Pricing) - Do not change",
    "city": "London",
    "country": "GB"
  },
  "alreadyRegistered": false
}
```

**Errors:**
- `404` - Property not found in PMS
- `500` - Validation failed

---

## 🏪 Public Marketplace

Public endpoints for guests and owners to browse available properties. Only shows properties that have at least one approved staff member.

### GET `/public/properties`
List all active, verified properties available for booking.

**Access:** Public (no authentication required)

**Query Parameters:**
- `city` (optional): Filter by city
- `country` (optional): Filter by country
- `stars` (optional): Filter by star rating
- `search` (optional): Search in name, city, or description

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "Grand Hotel Madrid",
      "location": "Madrid, Spain",
      "description": "Luxury hotel in the heart of Madrid...",
      "amenities": "[\"WiFi\",\"Pool\",\"Spa\",\"Restaurant\"]",
      "stars": 5,
      "images": "[\"https://example.com/image1.jpg\"]",
      "city": "Madrid",
      "country": "Spain",
      "latitude": "40.4168",
      "longitude": "-3.7038",
      "check_in_time": "14:00:00",
      "check_out_time": "12:00:00",
      "timezone": "Europe/Madrid",
      "languages": "[\"es\",\"en\",\"fr\"]",
      "pms_provider": "mews"
    }
  ],
  "count": 1
}
```

**Note:**
- Only returns properties with `pms_verified=true`
- Only returns properties that have at least one staff member with `status='approved'`
- Excludes sensitive data (pms_credentials, bank_account_info)

---

### GET `/public/properties/:id`
Get details of a specific property.

**Access:** Public (no authentication required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "Grand Hotel Madrid",
    "location": "Madrid, Spain",
    "description": "Luxury hotel...",
    "amenities": "[\"WiFi\",\"Pool\"]",
    "stars": 5,
    "address": "Calle Gran Via 123",
    "city": "Madrid",
    "country": "Spain",
    "check_in_time": "14:00:00",
    "check_out_time": "12:00:00",
    "timezone": "Europe/Madrid",
    "pms_provider": "mews"
  }
}
```

**Errors:**
- `404` - Property not found

---

### GET `/public/properties/:id/availability`
Check availability for a property (queries PMS if configured).

**Access:** Public (no authentication required)

**Query Parameters:**
- `checkIn` (required): Check-in date (YYYY-MM-DD)
- `checkOut` (required): Check-out date (YYYY-MM-DD)
- `adults` (optional): Number of adults
- `children` (optional): Number of children

**Response (200):**
```json
{
  "success": true,
  "available": true,
  "rooms": [
    {
      "roomId": "room-123",
      "roomType": "Deluxe Suite",
      "maxOccupancy": 2,
      "basePrice": 150.00,
      "currency": "EUR"
    }
  ]
}
```

---

### GET `/public/cities`
Get list of cities with available properties.

**Access:** Public (no authentication required)

**Response (200):**
```json
{
  "success": true,
  "cities": [
    {
      "city": "Madrid",
      "country": "Spain",
      "propertyCount": 3
    },
    {
      "city": "London",
      "country": "GB",
      "propertyCount": 1
    }
  ]
}
```

---

## 🏨 Properties Management

Endpoints for managing properties (hotels). Admin can manage all properties, staff can only manage their assigned property.

### GET `/properties`
List properties (filtered by permissions).

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** 
- Admin: sees all properties
- Staff: sees only their assigned property

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 14,
      "name": "API Hotel (Gross Pricing) - Do not change",
      "location": "London, GB",
      "city": "London",
      "country": "GB",
      "pms_provider": "mews",
      "pms_property_id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
      "pms_sync_enabled": true,
      "pms_verified": true,
      "status": "pending_verification",
      "check_in_time": "15:00:00",
      "check_out_time": "11:00:00"
    }
  ],
  "count": 1
}
```

---

### GET `/properties/:id`
Get details of a specific property.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** 
- Admin: can view any property
- Staff: can only view their assigned property

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 14,
    "name": "API Hotel (Gross Pricing) - Do not change",
    "location": "London, GB",
    "pms_provider": "mews",
    "pms_property_id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
    "pms_configured": true,
    "pms_fields_configured": {
      "provider": true,
      "property_id": true,
      "credentials": true
    }
  }
}
```

**Note:** PMS credentials are never exposed in responses

---

### PUT `/properties/:id`
Update a property.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can update any property
- Staff: can update only their assigned property

**Request Body:**
```json
{
  "name": "Updated Hotel Name",
  "description": "New description",
  "amenities": "[\"WiFi\",\"Pool\",\"Gym\"]",
  "stars": 4,
  "pms_sync_enabled": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated property */ },
  "message": "Property updated successfully"
}
```

**Note:** Cannot update `id`, `created_by`, or `pms_credentials` through this endpoint

---

### POST `/properties/:id/pms/test`
Test PMS connection for a property (uses stored credentials).

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can test any property
- Staff: can test only their assigned property

**Response (200):**
```json
{
  "success": true,
  "propertyInfo": {
    "id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
    "name": "API Hotel (Gross Pricing) - Do not change"
  }
}
```

**Errors:**
- `400` - No PMS provider configured
- `400` - No PMS credentials configured
- `403` - Access denied (wrong property)
- `500` - Connection test failed

---

### PUT `/properties/:id/pms/sync`
Trigger manual PMS synchronization.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can sync any property
- Staff: can sync only their assigned property

**Request Body:**
```json
{
  "sync_type": "availability"  // availability, bookings, prices, or full
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sync triggered successfully"
}
```

---

## �️ Room Management (Staff)

Staff members can manage room inventory for their assigned property. This includes creating rooms manually, importing from PMS, and controlling marketplace visibility.

### GET `/hotel-staff/rooms`
List all rooms for staff's assigned property.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Room 101",
      "description": "Standard room with garden view",
      "capacity": 2,
      "type": "Standard",
      "floor": "1",
      "status": "active",
      "amenities": ["wifi", "tv", "minibar"],
      "basePrice": 89.00,
      "customPrice": null,
      "propertyId": 5,
      "pmsResourceId": "mews-resource-123",
      "isMarketplaceEnabled": true,
      "pmsLastSync": "2025-12-13T10:30:00Z",
      "images": ["https://cdn.example.com/room101.jpg"],
      "createdAt": "2025-12-01T00:00:00Z",
      "updatedAt": "2025-12-13T10:30:00Z"
    }
  ],
  "count": 15
}
```

**Errors:**
- `403` - Staff user must be assigned to a property

---

### POST `/hotel-staff/rooms`
Create a new room for staff's property.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Request Body:**
```json
{
  "name": "Room 102",
  "description": "Deluxe room with ocean view",
  "capacity": 3,
  "type": "Deluxe",
  "floor": "2",
  "status": "active",
  "amenities": ["wifi", "tv", "minibar", "balcony", "safe"],
  "basePrice": 150.00,
  "customPrice": 135.00,
  "isMarketplaceEnabled": true,
  "images": ["https://cdn.example.com/room102-1.jpg", "https://cdn.example.com/room102-2.jpg"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Room 102",
    "propertyId": 5,
    ...
  },
  "message": "Room created successfully"
}
```

**Errors:**
- `400` - Room name is required
- `400` - Valid capacity is required
- `403` - Staff user must be assigned to a property

---

### PUT `/hotel-staff/rooms/:id`
Update an existing room (must belong to staff's property).

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Request Body:** (all fields optional)
```json
{
  "description": "Updated description",
  "customPrice": 120.00,
  "isMarketplaceEnabled": false,
  "amenities": ["wifi", "tv", "minibar", "balcony"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated room */ },
  "message": "Room updated successfully"
}
```

**Errors:**
- `403` - Staff user must be assigned to a property
- `404` - Room not found or not in your property

---

### DELETE `/hotel-staff/rooms/:id`
Delete a room from inventory.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Response (200):**
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

**Errors:**
- `403` - Staff user must be assigned to a property
- `404` - Room not found or not in your property

---

### POST `/hotel-staff/rooms/import-from-pms`
Import rooms automatically from PMS (Mews, Cloudbeds, etc.).

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Requirements:**
- Property must have PMS configured
- PMS credentials must be valid

**Response (200):**
```json
{
  "success": true,
  "data": {
    "imported": 8,
    "updated": 3,
    "errors": 0,
    "rooms": [
      { "id": 1, "name": "Room 101", "pmsResourceId": "mews-res-001" },
      { "id": 2, "name": "Room 102", "pmsResourceId": "mews-res-002" }
    ]
  },
  "message": "Imported 8 new rooms, updated 3 existing rooms"
}
```

**Process:**
1. Queries PMS for `resources` (physical rooms) and `services` (room types)
2. For each resource:
   - Checks if room exists by `pmsResourceId`
   - Updates existing or creates new room
   - Sets `isMarketplaceEnabled=false` by default (staff must enable manually)
   - Records `pmsLastSync` timestamp

**Errors:**
- `400` - No PMS configured for this property
- `400` - PMS credentials not configured
- `403` - Staff user must be assigned to a property
- `404` - No rooms found in PMS

---

### PATCH `/hotel-staff/rooms/:id/marketplace`
Enable or disable room in public marketplace.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Staff or Admin

**Request Body:**
```json
{
  "enabled": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated room */ },
  "message": "Room enabled in marketplace"
}
```

**Use Case:** Staff can reserve certain rooms for direct bookings only (not marketplace).

**Errors:**
- `400` - enabled field is required
- `403` - Staff user must be assigned to a property
- `404` - Room not found or not in your property

---

## 🏨 Public Marketplace (Rooms)

These endpoints are public - no authentication required.

### GET `/public/properties/:id/rooms`
List available rooms for a property in the marketplace.

**Query Parameters:**
- `type` (optional) - Filter by room type (e.g., "Standard", "Deluxe")
- `min_capacity` (optional) - Minimum guest capacity
- `max_price` (optional) - Maximum price

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Room 101",
      "description": "Standard room with garden view",
      "capacity": 2,
      "type": "Standard",
      "floor": "1",
      "amenities": ["wifi", "tv", "minibar"],
      "basePrice": 89.00,
      "customPrice": null,
      "effectivePrice": 89.00,
      "images": ["https://cdn.example.com/room101.jpg"]
    },
    {
      "id": 2,
      "name": "Room 102",
      "description": "Deluxe room with ocean view",
      "capacity": 3,
      "type": "Deluxe",
      "customPrice": 135.00,
      "effectivePrice": 135.00,
      "images": ["https://cdn.example.com/room102.jpg"]
    }
  ],
  "count": 2
}
```

**Notes:**
- Only shows rooms with `isMarketplaceEnabled=true` and `status='active'`
- `effectivePrice` = `customPrice` if set, otherwise `basePrice`
- Does not expose internal fields like `pmsResourceId`, `pmsLastSync`

**Errors:**
- `404` - Property not found

---

### GET `/public/properties/:propertyId/rooms/:roomId`
Get detailed information about a specific room.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Room 101",
    "description": "Spacious standard room with garden view...",
    "capacity": 2,
    "type": "Standard",
    "floor": "1",
    "amenities": ["wifi", "tv", "minibar", "air_conditioning"],
    "effectivePrice": 89.00,
    "images": [
      "https://cdn.example.com/room101-main.jpg",
      "https://cdn.example.com/room101-bathroom.jpg"
    ]
  }
}
```

**Errors:**
- `404` - Room not found or not available

---

### GET `/public/properties/:id/availability`
Check room availability for date range.

**Query Parameters:**
- `start_date` (required) - Check-in date (YYYY-MM-DD)
- `end_date` (required) - Check-out date (YYYY-MM-DD)
- `room_type` (optional) - Filter by room type

**Response (200) - With PMS:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "availableNights": 3,
    "reason": null,
    "source": "pms",
    "pms_provider": "mews"
  }
}
```

**Response (200) - Without PMS:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "totalRooms": 10,
    "occupiedRooms": 3,
    "availableRooms": 7,
    "availableRoomIds": [1, 2, 5, 8, 9, 10, 12],
    "source": "local"
  }
}
```

**Logic:**
1. If property has PMS configured:
   - Query PMS adapter for real-time availability
   - Return PMS availability result
2. If no PMS or PMS fails:
   - Get all marketplace-enabled rooms for property
   - Query bookings table to find which specific rooms are occupied
   - Filter out occupied rooms from available list
   - Return specific room IDs that are available

**Note:** The system now tracks individual room occupancy via `room_id` in bookings table, providing precise availability per room rather than just counting totals.

**Errors:**
- `400` - start_date and end_date are required
- `400` - end_date must be after start_date
- `404` - Property not found

---

## �🔄 PMS Sync Worker

Endpoints for controlling and monitoring the PMS synchronization worker.

### GET `/sync/status`
Get current status of the sync worker.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "interval": 1800000
  }
}
```

---

### POST `/sync/start`
Start the automatic sync worker.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Request Body:**
```json
{
  "interval": 1800000  // Optional: interval in milliseconds (default: 30 min)
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sync worker started",
  "status": {
    "isRunning": true,
    "interval": 1800000
  }
}
```

---

### POST `/sync/stop`
Stop the automatic sync worker.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:** Admin only

**Response (200):**
```json
{
  "success": true,
  "message": "Sync worker stopped",
  "status": {
    "isRunning": false,
    "interval": 1800000
  }
}
```

---

### POST `/sync/trigger`
Trigger a manual synchronization.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can sync any properties
- Staff: can sync only their assigned property

**Request Body:**
```json
{
  "propertyIds": [14],  // Optional: specific properties (admin only)
  "syncType": "full",   // availability, bookings, prices, or full
  "forceSync": true     // Optional: ignore last sync time
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sync triggered successfully",
  "options": {
    "syncType": "full",
    "forceSync": true,
    "propertyIds": [14]
  }
}
```

---

### GET `/sync/logs`
Get synchronization logs.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: sees all logs
- Staff: sees only logs for their property

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `property_id` (optional): Filter by property
- `status` (optional): Filter by status (pending, running, completed, failed)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "property_id": 14,
      "sync_type": "availability",
      "status": "completed",
      "started_at": "2025-12-13T22:15:58.000Z",
      "completed_at": "2025-12-13T22:16:02.000Z",
      "records_processed": 45,
      "records_created": 10,
      "records_updated": 35,
      "errors": null,
      "Property": {
        "id": 14,
        "name": "API Hotel (Gross Pricing) - Do not change",
        "pms_provider": "mews"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
}
```

---

### GET `/sync/logs/:id`
Get details of a specific sync log.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can view any log
- Staff: can view logs for their property only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "property_id": 14,
    "sync_type": "availability",
    "status": "completed",
    "started_at": "2025-12-13T22:15:58.000Z",
    "completed_at": "2025-12-13T22:16:02.000Z",
    "records_processed": 45,
    "error_details": null,
    "Property": {
      "id": 14,
      "name": "API Hotel (Gross Pricing) - Do not change",
      "pms_provider": "mews",
      "pms_property_id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178"
    }
  }
}
```

**Errors:**
- `404` - Sync log not found
- `403` - Access denied

---

## 👥 Staff Management

### Staff Registration Flow

Staff members register by selecting their hotel from the platform's PMS system:

1. **Search for hotel** → `POST /pms-search/properties` with search term
2. **Validate hotel** → `POST /pms-search/validate-property` with propertyId
3. **Register** → `POST /auth/register` with property data and propertyId
4. **Auto-approval or wait** → Depends on admin configuration (see below)
5. **Approval (if needed)** → Admin or existing staff approves via `POST /admin/staff-requests/:userId`
6. **Active** → Staff can login and manage their property

**Auto-Approval Configuration:**

Admins can configure staff auto-approval mode via `PUT /admin/settings/staff-auto-approval`:

- **`none`** (default): All staff require manual approval
- **`first`**: First staff member of each property is auto-approved, subsequent staff need approval
- **`all`**: All staff members are auto-approved immediately upon registration

The configuration applies to new registrations immediately.

**Important Security Notes:**
- Platform PMS credentials are stored in .env (MEWS_CLIENT_ID, MEWS_CLIENT_SECRET)
- Staff never sees or handles PMS credentials
- When staff registers, property is created with encrypted platform credentials
- All PMS operations use the platform's credentials automatically
- Multiple staff members can be assigned to the same property

### POST `/auth/register` (Staff Version)
Register a new staff member for a property.

**Access:** Public (no authentication required)

**Request Body:**
```json
{
  "email": "staff@hotel.com",
  "password": "Staff123",
  "roleName": "staff",
  "pms_property_id": "851df8c8-90f2-4c4a-8e01-a4fc46b25178",
  "property_data": {
    "name": "API Hotel (Gross Pricing) - Do not change",
    "city": "London",
    "country": "GB",
    "address": "11th Cross Park Avenue",
    "timezone": "UTC"
  }
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "userId": 22,
  "status": "approved",
  "propertyId": 14
}
```

**Or if pending approval:**
```json
{
  "message": "Registration submitted. Waiting for admin approval.",
  "userId": 22,
  "status": "pending",
  "propertyId": 14
}
```

**Status depends on auto-approval configuration:**
- If auto-approval mode is `all`: Always `approved`
- If auto-approval mode is `first` and no approved staff exists for property: `approved`
- If auto-approval mode is `first` and approved staff exists: `pending`
- If auto-approval mode is `none`: Always `pending`

**Note:**
- If property doesn't exist, creates it with platform PMS credentials (encrypted)
- If property exists, assigns staff to existing property
- Multiple staff can be registered for the same property

**Errors:**
- `400` - Invalid role or missing required fields
- `409` - Email already registered
- `500` - Registration failed

---

### POST `/admin/staff-requests/:userId`
Approve or reject a staff registration request.

**Headers:**
```
Authorization: Bearer <token>
```

**Access:**
- Admin: can approve/reject any staff
- Staff (approved): can approve/reject staff for their own property only

**Request Body:**
```json
{
  "action": "approve"  // or "reject"
}
```

**Response (200):**
```json
{
  "message": "Staff request approved successfully",
  "user": {
    "id": 22,
    "email": "staff@hotel.com",
    "status": "approved"
  }
}
```

**Errors:**
- `404` - Pending user request not found
- `400` - Only staff users can be approved through this endpoint
- `403` - Insufficient permissions or wrong property

**Permission Rules:**
- Admin can approve any staff member
- Approved staff can approve pending staff for the same property
- Pending staff cannot approve anyone
- Staff from Property A cannot approve staff from Property B

---

### Property Visibility Rules

Properties appear in the public marketplace only if:
1. `pms_verified = true` (admin has verified the property)
2. At least one staff member has `status = 'approved'`

**States:**
- **Property created, all staff pending** → Not visible in marketplace
- **Property created, at least 1 staff approved** → Visible in marketplace
- **All staff rejected/pending** → Not visible in marketplace
- **Property not verified** → Not visible regardless of staff status

**Staff Capabilities by Status:**
- **Pending**: Can edit property details, cannot perform bookings/swaps, property not in marketplace
- **Approved**: Can edit property, test PMS, trigger sync, property visible in marketplace
- **Rejected**: Cannot access system

---

## 📱 Cliente (Dashboard & Profile)

### GET `/api/dashboard`
Get summary of the authenticated user (dashboard).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "owner",
    "memberSince": "2024-01-15T10:30:00Z"
  },
  "recentActivity": [
    {
      "action": "view_weeks",
      "timestamp": "2024-12-03T14:20:00Z",
      "details": {}
    }
  ],
  "stats": {
    "totalActions": 45,
    "role": "owner",
    "memberSince": "2024-01-15T10:30:00Z"
  }
}
```

---

### GET `/api/profile`
Get detailed profile of the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "profile": {
    "id": 1,
    "email": "user@example.com",
    "role": "owner",
    "memberSince": "2024-01-15T10:30:00Z"
  }
}
```

---

### PUT `/api/settings`
Update preferences of the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "language": "es",
  "notifications": true
}
```

**Response (200):**
```json
{
  "message": "Settings updated successfully",
  "settings": {
    "language": "es",
    "notifications": true
  }
}
```

---

### GET `/api/health`
Check connectivity with the API.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-12-03T15:30:00Z",
  "version": "1.0.0"
}
```

---

## 🏠 Timesharing (Owners)

### GET `/timeshare/weeks`
Get owner's weeks.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_weeks`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "owner_id": 1,
      "property_id": 5,
      "start_date": "2025-07-01",
      "end_date": "2025-07-08",
      "color": "red",
      "status": "available",
      "Property": {
        "name": "Hotel Paradise",
        "location": "Cancún, México"
      }
    }
  ]
}
```

---

### POST `/timeshare/weeks/:weekId/confirm`
Confirm use of a week.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `confirm_week`

**Response (200):**
```json
{
  "success": true,
  "message": "Week confirmed successfully",
  "data": {
    "id": 1,
    "status": "confirmed"
  }
}
```

**Errors:**
- `404` - Week not found or not available

---

### POST `/timeshare/swaps`
Create request swap (swap).

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_weeks`

**Request Body:**
```json
{
  "weekId": 1,
  "desiredStartDate": "2025-08-01",
  "desiredEndDate": "2025-08-08",
  "notes": "Prefiero hotel en la playa"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Swap request created successfully",
  "data": {
    "id": 10,
    "requester_week_id": 1,
    "requester_id": 1,
    "desired_start_date": "2025-08-01",
    "desired_end_date": "2025-08-08",
    "status": "pending",
    "swap_fee": 10.00
  }
}
```

**Errors:**
- `404` - Week not available for swap

---

### POST `/timeshare/swaps/:swapId/authorize`
Authorize/accept a swap.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `accept_swap`

**Request Body:**
```json
{
  "responderWeekId": 5
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Swap authorized",
  "data": {
    "id": 10,
    "status": "matched",
    "responder_week_id": 5
  }
}
```

**Errors:**
- `404` - Swap no encontrado
- `400` - Swap is not in pending status
- `403` - No permissions for autorizar

---

### GET `/timeshare/swaps`
Get swap requests of the owner.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_weeks`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "status": "pending",
      "swap_fee": 10.00,
      "RequesterWeek": {
        "id": 1,
        "color": "red",
        "Property": {
          "name": "Hotel Paradise"
        }
      },
      "ResponderWeek": null
    }
  ]
}
```

---

### POST `/timeshare/weeks/:weekId/convert`
Convert week to night credits night.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_weeks`

**Response (200):**
```json
{
  "success": true,
  "message": "Week converted to 6 night credits",
  "data": {
    "week": {
      "id": 1,
      "status": "converted"
    },
    "nightCredit": {
      "id": 15,
      "total_nights": 6,
      "remaining_nights": 6,
      "expiry_date": "2026-12-03T00:00:00Z",
      "status": "active"
    }
  }
}
```

**Conversion by color:**
- Red: 6 nights
- Blue: 5 nights
- White: 4 nights

**Errors:**
- `404` - Week not available for conversion

---

### GET `/timeshare/night-credits`
Get credits night of the owner.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_weeks`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "credits": [
      {
        "id": 15,
        "total_nights": 6,
        "remaining_nights": 4,
        "expiry_date": "2026-12-03T00:00:00Z",
        "status": "active"
      }
    ],
    "totalRemainingNights": 4
  }
}
```

---

### POST `/timeshare/night-credits/:creditId/use`
Use credits night for reservar.

**Headers:**
```
Authorization: Bearer <token>
Idempotency-Key: unique-key-123 (optional)
```

**Permissions required:** `view_own_weeks`

**Request Body:**
```json
{
  "propertyId": 5,
  "checkIn": "2025-08-15",
  "checkOut": "2025-08-18",
  "roomType": "double",
  "idempotencyKey": "unique-key-123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "3 night credits used successfully",
  "data": {
    "nightsUsed": 3,
    "remainingNights": 1,
    "booking": {
      "id": 45,
      "property_id": 5,
      "check_in": "2025-08-15",
      "check_out": "2025-08-18",
      "status": "confirmed",
      "guest_token": "gt_1733252000_abc123"
    }
  }
}
```

**Errors:**
- `404` - Crédito no encontrado or expirado
- `400` - Créditos insuficientes
- `409` - Without availability

---

## 🌙 Night Credit Requests (Owners)

The Night Credit Request system allows owners to use their night credits with staff approval, and optionally purchase additional nights at marketplace rates. This prevents conflicts with existing bookings and timeshare weeks.

### Business Flow
1. **Owner creates request** → Specifies dates, property, how many credits to use, and optional extra nights to purchase
2. **Staff reviews** → Checks availability (no conflicts with bookings/weeks/swaps)
3. **Staff approves/rejects** → If approved and extra nights requested, payment is required
4. **Owner pays** (if applicable) → Uses Stripe Payment Intent for additional nights only
5. **Booking created automatically** → Credits deducted, booking confirmed

### POST `/hotels/owner/night-credits/requests`
Create a night credit request.

**Headers:**
```
Authorization: Bearer <owner_token>
```

**Access:** Owner role only

**Request Body:**
```json
{
  "creditId": 15,
  "propertyId": 5,
  "checkIn": "2025-08-15",
  "checkOut": "2025-08-23",
  "nightsRequested": 6,
  "additionalNights": 2,
  "roomType": "deluxe"
}
```

**Parameters:**
- `creditId` (required): ID of the night credit to use
- `propertyId` (required): Property where owner wants to stay
- `checkIn` (required): Check-in date (YYYY-MM-DD)
- `checkOut` (required): Check-out date (YYYY-MM-DD)
- `nightsRequested` (required): Number of credits to use (must be ≤ remaining nights in credit)
- `additionalNights` (optional): Extra nights to purchase via marketplace (default: 0)
- `roomType` (optional): Preferred room type

**Response (201):**
```json
{
  "success": true,
  "data": {
    "requestId": 8,
    "status": "pending",
    "usingCredits": 6,
    "buyingNights": 2,
    "estimatedCost": 224.00,
    "breakdown": {
      "basePrice": 200.00,
      "commission": 24.00,
      "total": 224.00
    }
  },
  "message": "Request created successfully. Waiting for staff approval."
}
```

**Cost Calculation:**
- Credits nights: FREE (no payment required)
- Additional nights: Base price (€100/night default) + 12% platform commission
- Example: 2 nights × €100 = €200 + €24 commission = €224 total

**Errors:**
- `400` - Missing required fields or invalid dates
  ```json
  {
    "error": "creditId, propertyId, checkIn, checkOut, and nightsRequested are required"
  }
  ```
- `400` - Insufficient credits
  ```json
  {
    "error": "Insufficient night credits. You have 4 nights remaining but requested 6."
  }
  ```
- `404` - Credit not found or expired
- `403` - Credit belongs to another owner

---

### GET `/hotels/owner/night-credits/requests`
Get all requests created by the owner.

**Headers:**
```
Authorization: Bearer <owner_token>
```

**Access:** Owner role only

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected, expired, completed)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "status": "approved",
      "check_in": "2025-08-15T00:00:00.000Z",
      "check_out": "2025-08-23T00:00:00.000Z",
      "nights_requested": 6,
      "additional_nights": 2,
      "additional_price": 224.00,
      "payment_status": "pending",
      "reviewed_by_staff_id": 47,
      "staff_notes": "Approved - Room available",
      "Property": {
        "id": 28,
        "name": "Test Hotel Night Credits",
        "location": "Test City"
      },
      "Credit": {
        "id": 9,
        "remaining_nights": 6,
        "expiry_date": "2027-12-13T00:00:00.000Z"
      }
    }
  ]
}
```

---

### GET `/hotels/owner/night-credits/requests/:id`
Get details of a specific request.

**Headers:**
```
Authorization: Bearer <owner_token>
```

**Access:** Owner role only (can only view own requests)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 8,
    "status": "approved",
    "check_in": "2025-08-15T00:00:00.000Z",
    "check_out": "2025-08-23T00:00:00.000Z",
    "nights_requested": 6,
    "additional_nights": 2,
    "additional_price": 224.00,
    "additional_commission": 24.00,
    "payment_status": "pending",
    "payment_intent_id": null,
    "booking_id": null,
    "reviewed_by_staff_id": 47,
    "staff_notes": "Approved - Room available",
    "created_at": "2025-12-13T15:30:00.000Z"
  }
}
```

**Errors:**
- `404` - Request not found or doesn't belong to owner

---

### POST `/hotels/owner/night-credits/requests/:id/pay`
Create payment intent for additional nights (only if request is approved and has additional nights).

**Headers:**
```
Authorization: Bearer <owner_token>
```

**Access:** Owner role only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_3Se4440Jnhj43wzq0NuhFOt4_secret_xxx",
    "paymentIntentId": "pi_3Se4440Jnhj43wzq0NuhFOt4",
    "amount": 224.00,
    "currency": "EUR"
  },
  "message": "Use the clientSecret with Stripe Elements to complete payment"
}
```

**Process:**
1. Owner initiates payment
2. System creates Stripe Payment Intent with metadata: `{ type: 'night_credit_extension', requestId: 8 }`
3. Owner completes payment using Stripe Elements on frontend
4. Stripe webhook receives `payment_intent.succeeded`
5. System automatically:
   - Updates payment_status to 'paid'
   - Creates booking in database
   - Deducts night credits
   - Sets request status to 'completed'

**Errors:**
- `400` - Request not approved yet
  ```json
  {
    "error": "Request must be approved before payment"
  }
  ```
- `400` - No payment required
  ```json
  {
    "error": "No payment required for this request (no additional nights)"
  }
  ```
- `404` - Request not found
- `409` - Payment already in progress

---

### DELETE `/hotels/owner/night-credits/requests/:id`
Cancel a pending request (only allowed if status is 'pending').

**Headers:**
```
Authorization: Bearer <owner_token>
```

**Access:** Owner role only

**Response (200):**
```json
{
  "success": true,
  "message": "Request cancelled successfully"
}
```

**Errors:**
- `400` - Cannot cancel request in current state
  ```json
  {
    "error": "Can only cancel pending requests"
  }
  ```
- `404` - Request not found

---

## 👔 Night Credit Requests (Staff)

Staff endpoints for reviewing and approving night credit requests.

### GET `/hotels/staff/night-credits/requests`
Get pending requests for staff's property.

**Headers:**
```
Authorization: Bearer <staff_token>
```

**Access:** Staff or Admin with `view_bookings` permission

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "owner_id": 50,
      "check_in": "2025-08-15T00:00:00.000Z",
      "check_out": "2025-08-23T00:00:00.000Z",
      "nights_requested": 6,
      "additional_nights": 2,
      "room_type": "deluxe",
      "status": "pending",
      "created_at": "2025-12-13T15:30:00.000Z",
      "Owner": {
        "id": 50,
        "email": "owner@example.com"
      },
      "Credit": {
        "id": 9,
        "remaining_nights": 6,
        "expiry_date": "2027-12-13T00:00:00.000Z"
      },
      "Property": {
        "id": 28,
        "name": "Test Hotel Night Credits",
        "location": "Test City"
      }
    }
  ]
}
```

**Errors:**
- `400` - Staff must be assigned to a property

---

### GET `/hotels/staff/night-credits/requests/:id`
Get request details with availability check.

**Headers:**
```
Authorization: Bearer <staff_token>
```

**Access:** Staff or Admin with `view_bookings` permission

**Response (200):**
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 8,
      "owner_id": 50,
      "check_in": "2025-08-15T00:00:00.000Z",
      "check_out": "2025-08-23T00:00:00.000Z",
      "nights_requested": 6,
      "additional_nights": 2,
      "status": "pending"
    },
    "availability": {
      "available": true,
      "conflicts": {
        "bookings": 0,
        "weeks": 0,
        "swaps": 0
      },
      "message": "No conflicts detected"
    }
  }
}
```

**Availability Check Logic:**
1. Queries confirmed/pending bookings for overlapping dates
2. Queries timeshare weeks (status: available, confirmed) for overlapping dates
3. Queries active swap requests for overlapping dates
4. Returns conflict summary

**Errors:**
- `404` - Request not found or doesn't belong to staff's property

---

### PATCH `/hotels/staff/night-credits/requests/:id/approve`
Approve a night credit request.

**Headers:**
```
Authorization: Bearer <staff_token>
```

**Access:** Staff or Admin with `manage_bookings` permission

**Request Body:**
```json
{
  "notes": "Approved - Deluxe room 205 reserved"
}
```

**Parameters:**
- `notes` (optional): Staff notes about the approval

**Response (200):**
```json
{
  "success": true,
  "message": "Request approved successfully",
  "data": {
    "id": 8,
    "status": "approved",
    "reviewed_by_staff_id": 47,
    "staff_approval_date": "2025-12-13T15:45:00.000Z",
    "staff_notes": "Approved - Deluxe room 205 reserved"
  }
}
```

**Process:**
1. Staff reviews request and availability
2. Staff approves with optional notes
3. System re-validates availability (prevents race conditions)
4. If no additional nights: Booking created immediately, credits deducted
5. If additional nights: Status set to 'approved', owner must pay before booking creation

**Errors:**
- `404` - Request not found or wrong property
- `400` - Request not in pending state
- `400` - Availability conflict detected
  ```json
  {
    "error": "Cannot approve: availability conflict detected",
    "conflicts": {
      "bookings": 2,
      "weeks": 0,
      "swaps": 1
    }
  }
  ```

---

### PATCH `/hotels/staff/night-credits/requests/:id/reject`
Reject a night credit request.

**Headers:**
```
Authorization: Bearer <staff_token>
```

**Access:** Staff or Admin with `manage_bookings` permission

**Request Body:**
```json
{
  "reason": "Room type unavailable for selected dates. Please choose standard room or different dates."
}
```

**Parameters:**
- `reason` (required): Explanation for rejection

**Response (200):**
```json
{
  "success": true,
  "message": "Request rejected",
  "data": {
    "id": 8,
    "status": "rejected",
    "reviewed_by_staff_id": 47,
    "staff_notes": "Room type unavailable for selected dates..."
  }
}
```

**Errors:**
- `400` - Reason is required
- `404` - Request not found or wrong property
- `400` - Request not in pending state

---

### GET `/hotels/staff/availability`
Get unified availability view (placeholder - future implementation).

**Headers:**
```
Authorization: Bearer <staff_token>
```

**Access:** Staff or Admin with `view_bookings` permission

**Query Parameters:**
- `start_date` (required): Start date for availability check
- `end_date` (required): End date for availability check

**Future Response (200):**
```json
{
  "success": true,
  "data": {
    "totalRooms": 50,
    "available": 35,
    "breakdown": {
      "bookings": 10,
      "timeshareWeeks": 3,
      "swapRequests": 1,
      "creditRequests": 1
    },
    "timeline": [
      {
        "date": "2025-08-15",
        "available": 40,
        "occupied": 10
      }
    ]
  }
}
```

**Note:** This endpoint is planned for future implementation to provide a comprehensive availability dashboard for staff.

---

## 🏨 Hotel Guest (Guests)

### GET `/hotel/booking/:token`
Get booking details via token (access for guests).

**URL Params:**
- `token`: Guest token (guest_token)

**Response (200):**
```json
{
  "booking": {
    "id": 45,
    "property": {
      "name": "Hotel Paradise",
      "location": "Cancún, México",
      "coordinates": {"lat": 21.1619, "lng": -86.8515}
    },
    "checkIn": "2025-08-15",
    "checkOut": "2025-08-18",
    "roomType": "double",
    "status": "confirmed",
    "guest_name": "John Doe",
    "guest_email": "john@example.com"
  },
  "hotel": {
    "name": "Hotel Paradise",
    "location": "Cancún, México"
  },
  "services": []
}
```

**Errors:**
- `404` - Reserva not found
- `403` - Expired access (>30 days post check-out)

---

### POST `/hotel/services`
Request hotel service.

**Request Body:**
```json
{
  "bookingToken": "gt_1733252000_abc123",
  "serviceType": "late_checkout",
  "description": "Necesito salida tardía hasta las 2pm",
  "urgency": "normal",
  "amount": 25.00,
  "currency": "EUR"
}
```

**Response (201):**
```json
{
  "message": "Service request submitted",
  "serviceRequest": {
    "id": 78,
    "service_type": "late_checkout",
    "status": "requested",
    "notes": "Necesito salida tardía hasta las 2pm",
    "requested_at": "2025-08-17T10:30:00Z",
    "price": 25.00
  },
  "payment": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx"
  }
}
```

**Service types:**
- `late_checkout` - Salida tardía
- `early_checkin` - Entrada temprana
- `baby_cot` - Cuna for bebé
- `extra_towels` - Toallas extra
- `room_service` - Room service
- `housekeeping` - Limpieza adicional

**Errors:**
- `400` - Token invalid or tipo service required
- `404` - Reserva not found

---

### GET `/hotel/services/:token`
Get requests service of a booking.

**URL Params:**
- `token`: Guest token

**Response (200):**
```json
{
  "services": [
    {
      "id": 78,
      "service_type": "late_checkout",
      "status": "confirmed",
      "notes": "Necesito salida tardía hasta las 2pm",
      "requested_at": "2025-08-17T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

### GET `/hotel/nearby/:token`
Get nearby content from Secret World (cards and itineraries).

**URL Params:**
- `token`: Guest token

**Query Params:**
- `radius`: Radius in km (default: 5)

**Response (200):**
```json
{
  "content": [
    {
      "id": "card1",
      "title": "City Walking Tour",
      "description": "Explore the historic center",
      "type": "itinerary",
      "distance": "0.5km"
    }
  ],
  "location": {
    "name": "Cancún, México",
    "latitude": 21.1619,
    "longitude": -86.8515
  }
}
```

---

## 👔 Hotel Staff (Hotel Staff)

### GET `/hotel-staff/services`
List requests service of the hotel.

**Headers:**
```
Authorization: Bearer <token>
```

**Roles permitidos:** `staff`, `admin`

**Query Params:**
- `status`: Filter by status (requested, confirmed, completed, cancelled)

**Response (200):**
```json
{
  "services": [
    {
      "id": 78,
      "booking_id": 45,
      "service_type": "late_checkout",
      "status": "requested",
      "notes": "Necesito salida tardía hasta las 2pm",
      "requested_at": "2025-08-17T10:30:00Z"
    }
  ]
}
```

---

### PATCH `/hotel-staff/services/:id/status`
Update estado request service.

**Headers:**
```
Authorization: Bearer <token>
```

**Roles permitidos:** `staff`, `admin`

**Request Body:**
```json
{
  "status": "confirmed"
}
```

**Valid statuses:**
- `requested` - Requested
- `confirmed` - Confirmed
- `completed` - Completed
- `cancelled` - Cancelled

**Response (200):**
```json
{
  "message": "Service status updated",
  "service": {
    "id": 78,
    "status": "confirmed"
  }
}
```

---

### GET `/hotel-staff/services/history`
Get history services of the hotel.

**Headers:**
```
Authorization: Bearer <token>
```

**Roles permitidos:** `staff`, `admin`

**Response (200):**
```json
{
  "services": [...]
}
```

---

## 🔧 Admin (Administration)

### POST `/admin/create-admin`
Create a new admin account (admin only).

**Security:** Only existing administrators can create new admin accounts. This prevents unauthorized admin account creation.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Permissions required:** `create_user` (admin role)

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201):**
```json
{
  "message": "Admin account created successfully",
  "admin": {
    "id": 42,
    "email": "newadmin@example.com",
    "role": "admin",
    "status": "approved"
  }
}
```

**Errors:**
- `400` - Invalid input, weak password, or email already exists
  ```json
  {
    "error": "Password must be at least 8 characters long"
  }
  ```
- `403` - Not an admin
  ```json
  {
    "error": "Only administrators can create admin accounts"
  }
  ```
- `500` - Failed to create admin

**Note:** Admin accounts are immediately approved and have full platform access. Use this endpoint carefully.

---

### GET `/admin/logs`
Get system action logs.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_users`

**Query Params:**
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50)
- `user_id`: Filter by user
- `action`: Filter by action
- `start_date`: Start date (ISO 8601)
- `end_date`: End date (ISO 8601)

**Response (200):**
```json
{
  "logs": [
    {
      "id": 1234,
      "user_id": 1,
      "action": "view_weeks",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "details": {},
      "createdAt": "2024-12-03T14:20:00Z",
      "User": {
        "id": 1,
        "email": "user@example.com"
      }
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 50,
    "pages": 10
  }
}
```

---

### GET `/admin/logs/stats`
Get log statistics.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_users`

**Query Params:**
- `period`: Periodo (1d, 7d, 30d) (default: 7d)

**Response (200):**
```json
{
  "period": "7d",
  "actionStats": [
    {
      "action": "view_weeks",
      "count": 125
    },
    {
      "action": "create_swap_request",
      "count": 45
    }
  ],
  "dailyStats": [
    {
      "date": "2024-12-01",
      "count": 89
    },
    {
      "date": "2024-12-02",
      "count": 102
    }
  ]
}
```

---

### DELETE `/admin/users/:userId`
Delete a user (admin only).

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_users`

**URL Params:**
- `userId`: ID of the user to delete

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "deletedUser": {
    "id": "5",
    "email": "user@example.com",
    "role": "guest"
  }
}
```

**Errors:**
- `400` - Cannot delete your own account (use DELETE /auth/me)
- `404` - User not found
- `500` - Failed to delete user

**Note:** Admins cannot delete their own account using this endpoint. They must use `DELETE /auth/me` instead for self-deletion.

---

### GET `/admin/settings/staff-auto-approval`
Get staff auto-approval configuration (admin only).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Permissions required:** `manage_permissions` (admin role)

**Response (200):**
```json
{
  "mode": "first",
  "description": {
    "none": "All staff require manual approval",
    "first": "First staff member of each property is auto-approved",
    "all": "All staff members are auto-approved"
  }
}
```

**Modes:**
- `none`: Default - all staff registrations require manual approval
- `first`: First staff member of each property is automatically approved, subsequent staff require approval
- `all`: All staff members are automatically approved upon registration

---

### PUT `/admin/settings/staff-auto-approval`
Update staff auto-approval configuration (admin only).

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Permissions required:** `manage_permissions` (admin role)

**Request Body:**
```json
{
  "mode": "first"
}
```

**Response (200):**
```json
{
  "message": "Staff auto-approval settings updated successfully",
  "mode": "first",
  "description": "First staff member of each property is auto-approved"
}
```

**Errors:**
- `400` - Invalid mode (must be: none, first, all)
  ```json
  {
    "error": "Invalid mode. Must be one of: none, first, all",
    "validModes": ["none", "first", "all"]
  }
  ```
- `403` - Not authorized (requires admin role)
- `500` - Failed to update settings

**Use Cases:**
- **none**: Maximum security - every staff must be manually vetted
- **first**: Balanced approach - first staff member is trusted (they found the hotel), but additional staff need approval
- **all**: Open registration - useful for trusted hotel chains or development environments

**Note:** This setting is stored in the `platform_settings` table and takes effect immediately for new registrations.

---

## 🏢 PMS (Property Management System)

### GET `/pms/availability/:propertyId`
Check availability de rooms.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_availability`

**Query Params:**
- `checkIn`: Fecha check-in (YYYY-MM-DD)
- `checkOut`: Fecha check-out (YYYY-MM-DD)
- `guests`: Number of guests

**Response (200):**
```json
{
  "available": true,
  "rooms": [
    {
      "type": "double",
      "available": 5,
      "price": 120.00
    }
  ]
}
```

---

### POST `/pms/bookings`
Create nueva reserva en PMS.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `create_booking`

**Request Body:**
```json
{
  "propertyId": 5,
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "checkIn": "2025-08-15",
  "checkOut": "2025-08-18",
  "roomType": "double"
}
```

**Response (201):**
```json
{
  "booking": {
    "id": 45,
    "pms_booking_id": "PMS-12345",
    "status": "confirmed"
  }
}
```

---

### GET `/pms/bookings/:bookingId`
Get booking details.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_booking`

---

### PUT `/pms/bookings/:bookingId`
Update reserva.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `update_booking`

---

### DELETE `/pms/bookings/:bookingId`
Cancel reserva.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `cancel_booking`

---

### GET `/pms/properties/:propertyId`
Get information of the property.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_property`

---

### GET `/pms/properties`
List properties of the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Permissions required:** `view_own_properties`

---

## 💳 Stripe (Payments)

### POST `/payments/intent`
Create payment intent.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 10.00,
  "currency": "EUR",
  "purpose": "swap_fee",
  "metadata": {
    "swapId": 10
  }
}
```

**Response (200):**
```json
{
  "paymentIntentId": "pi_xxx",
  "clientSecret": "pi_xxx_secret_xxx",
  "amount": 10.50,
  "currency": "EUR"
}
```

**Nota:** Se aplica un cargo extra del 5% automáticamente.

---

### GET `/payments/:paymentIntentId/confirm`
Confirm payment.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "status": "succeeded",
  "paymentIntentId": "pi_xxx"
}
```

---

### POST `/payments/refund`
Create reembolso.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_xxx",
  "amount": 10.00,
  "reason": "requested_by_customer"
}
```

**Response (200):**
```json
{
  "refundId": "re_xxx",
  "status": "succeeded",
  "amount": 10.00
}
```

---

### DELETE `/payments/:paymentIntentId`
Cancel payment.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "status": "cancelled",
  "paymentIntentId": "pi_xxx"
}
```

---

### POST `/payments/webhook`
Webhook from Stripe (no authentication required, uses signature from Stripe).

**Headers:**
```
stripe-signature: <stripe_signature>
```

**Supported events:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

---

## 🔄 Conversión (Legacy)

### POST `/conversion/convert-guest`
Convert guest user a owner.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userId": 5,
  "paymentIntentId": "pi_xxx"
}
```

---

### POST `/conversion/swap-request`
Create request de swap for guest.

**Headers:**
```
Authorization: Bearer <token>
```

---

### GET `/conversion/matching-swaps/:propertyId`
Buscar swaps compatibles.

**Headers:**
```
Authorization: Bearer <token>
```

---

### POST `/conversion/complete-swap`
Complete swap with payment.

**Headers:**
```
Authorization: Bearer <token>
```

---

### GET `/conversion/swap-fee`
Get monto de tarifa de swap.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "swapFee": 10.00,
  "currency": "EUR"
}
```

---

### POST `/conversion/swap-fee`
Update tarifa de swap (solo admin).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 12.00
}
```

---

## ✅ Health Check

### GET `/health`
Check estado del servidor.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-12-03T15:30:00Z"
}
```

---

## 🔒 Seguridad y Rate Limiting

### Rate Limits
- **General API**: 100 requests / 15 minutos
- **Auth endpoints**: 5 requests / 15 minutos
- **Admin endpoints**: 20 requests / 15 minutos

### Headers de Seguridad
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### CORS
- Configurado for permitir orígenes específicos
- Credentials permitidos

---

## 📝 Common Error Codes

| Code | Description |
|--------|-------------|
| 400 | Bad Request - Invalid data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Conflict (e.g.: without availability) |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

---

## 🧪 Testing

For testing, use the following admin user created by seeders:

```json
{
  "email": "admin@sw2.com",
  "password": "Admin123!"
}
```

---

## 📚 Additional Resources

- **Sequelize ORM**: Database MariaDB/MySQL
- **JWT**: Tokens with expiration of 24 hours
- **Stripe**: Payment processing with webhook support
- **PMS Adapters**: Mock and Mews supported
- **Logging**: All actions are logged in `action_logs`

---

## 🚀 Upcoming Features

- [ ] Validation of peak periods for night credits
- [ ] Automatic swap matching system
- [ ] Push notifications for mobile
- [ ] Full integration with Secret World API
- [ ] Multi-language (i18n)
- [ ] Advanced metrics and analytics

---

**API Version:** 1.0.0  
**Last updated:** 13 December 2025
