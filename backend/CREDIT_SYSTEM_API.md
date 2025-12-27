# Credit System API Documentation

## Overview

Complete REST API documentation for the variable credit system. All endpoints return JSON responses in this format:

```json
{
  "success": true|false,
  "data": { ... },
  "message": "Optional success message",
  "error": "Optional error message"
}
```

---

## Authentication

Most endpoints require authentication. Include JWT token in Authorization header:

```
Authorization: Bearer <token>
```

Admin endpoints require additional admin role verification.

---

## User Credit Endpoints

### Get User Wallet Summary

**GET** `/api/credits/wallet/:userId`

Get complete wallet information including balance and expiring credits.

**Parameters:**
- `userId` (path, required): User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "userId": 123,
      "totalBalance": 5000,
      "totalEarned": 7000,
      "totalSpent": 1500,
      "totalExpired": 500,
      "pendingExpiration": 800
    },
    "expirations": {
      "in30Days": 300,
      "in60Days": 500,
      "in90Days": 800,
      "nextExpirationDate": "2025-07-15T00:00:00.000Z"
    },
    "activeTransactions": [
      {
        "id": 45,
        "amount": 1200,
        "depositedAt": "2025-01-15T10:30:00.000Z",
        "expiresAt": "2025-07-15T10:30:00.000Z",
        "daysUntilExpiration": 171,
        "status": "ACTIVE"
      }
    ]
  }
}
```

---

### Get Transaction History

**GET** `/api/credits/transactions/:userId`

Get paginated transaction history for user.

**Parameters:**
- `userId` (path, required): User ID
- `limit` (query, optional): Results per page (default: 50)
- `offset` (query, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 123,
        "type": "DEPOSIT",
        "amount": 1200,
        "balanceAfter": 5000,
        "status": "ACTIVE",
        "description": "Deposited week #456 for 1200 credits",
        "weekId": 456,
        "bookingId": null,
        "depositedAt": "2025-01-15T10:30:00.000Z",
        "expiresAt": "2025-07-15T10:30:00.000Z",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "metadata": { ... }
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### Deposit Week for Credits

**POST** `/api/credits/deposit`

Convert a timeshare week into credits.

**Request Body:**
```json
{
  "userId": 123,
  "weekId": 456
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "creditsEarned": 1800,
    "expiresAt": "2025-07-25T12:00:00.000Z",
    "wallet": {
      "totalBalance": 6800,
      "totalEarned": 8800
    },
    "transaction": {
      "id": 789,
      "amount": 1800,
      "createdAt": "2025-01-25T12:00:00.000Z"
    }
  },
  "message": "Successfully deposited week #456 for 1800 credits"
}
```

**Calculation:**
- Credits = BASE_SEASON_VALUE × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER
- RED season: 1000 base credits
- WHITE season: 600 base credits
- BLUE season: 300 base credits
- Property tier multipliers: 1.0x - 1.5x
- Room type multipliers: 1.0x - 3.0x
- Expiration: 6 months from deposit

---

### Estimate Credits for Week

**POST** `/api/credits/estimate`

Calculate potential credits without depositing (preview).

**Request Body:**
```json
{
  "propertyId": 10,
  "roomType": "DELUXE",
  "weekStartDate": "2025-07-15"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "estimatedCredits": 1800,
    "seasonType": "RED",
    "breakdown": {
      "baseValue": 1000,
      "locationMultiplier": 1.2,
      "roomTypeMultiplier": 1.5
    },
    "expiresIn": "6 months",
    "expirationDate": "2025-07-25T12:00:00.000Z"
  }
}
```

---

### Calculate Booking Cost

**POST** `/api/credits/calculate-booking-cost`

Calculate total credits required for a booking.

**Request Body:**
```json
{
  "propertyId": 15,
  "roomType": "SUPERIOR",
  "checkInDate": "2025-08-01",
  "checkOutDate": "2025-08-08"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCredits": 5600,
    "nights": 7,
    "breakdown": [
      {
        "date": "2025-08-01",
        "seasonType": "RED",
        "creditsPerNight": 900
      },
      {
        "date": "2025-08-02",
        "seasonType": "RED",
        "creditsPerNight": 900
      }
    ],
    "averagePerNight": 800
  }
}
```

---

### Check Affordability

**POST** `/api/credits/check-affordability`

Check if user can afford a booking (calculates hybrid payment if needed).

**Request Body:**
```json
{
  "userId": 123,
  "creditsRequired": 5600
}
```

**Response (Sufficient Credits):**
```json
{
  "success": true,
  "data": {
    "canAfford": true,
    "availableBalance": 6800,
    "creditsRequired": 5600,
    "shortfall": 0,
    "hybridPayment": null
  }
}
```

**Response (Insufficient Credits):**
```json
{
  "success": true,
  "data": {
    "canAfford": false,
    "availableBalance": 3000,
    "creditsRequired": 5600,
    "shortfall": 2600,
    "hybridPayment": {
      "creditsUsed": 3000,
      "cashRequired": 2600.00,
      "creditShortfall": 2600
    }
  }
}
```

---

### Refund Booking Credits

**POST** `/api/credits/refund`

Refund credits from a cancelled booking.

**Request Body:**
```json
{
  "userId": 123,
  "bookingId": 789,
  "creditsToRefund": 5600,
  "reason": "Booking cancelled by user"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "creditsRefunded": 5600,
    "wallet": {
      "totalBalance": 8600
    },
    "transaction": {
      "id": 890,
      "createdAt": "2025-01-25T15:30:00.000Z"
    }
  },
  "message": "Successfully refunded 5600 credits for booking #789"
}
```

---

### Get Conversion Rate

**GET** `/api/credits/rate`

Get current credit to euro conversion rate.

**Response:**
```json
{
  "success": true,
  "data": {
    "creditToEuroRate": 1.0,
    "oneCredit": "€1.00",
    "oneEuro": "1 credits"
  }
}
```

---

## Admin Credit Endpoints

### Manual Credit Adjustment

**POST** `/api/credits/adjust`

**(Admin Only)** Manually adjust user credits.

**Request Body:**
```json
{
  "userId": 123,
  "amount": 500,
  "reason": "Compensation for system error"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "adjustment": 500,
    "newBalance": 5500,
    "transaction": {
      "id": 901,
      "createdAt": "2025-01-25T16:00:00.000Z"
    }
  },
  "message": "Successfully adjusted credits by 500 for user #123"
}
```

---

### Transfer Credits Between Users

**POST** `/api/credits/transfer`

**(Admin Only)** Transfer credits from one user to another.

**Request Body:**
```json
{
  "fromUserId": 123,
  "toUserId": 456,
  "amount": 1000,
  "reason": "Account consolidation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transferred": 1000,
    "fromUser": {
      "userId": 123,
      "newBalance": 4000
    },
    "toUser": {
      "userId": 456,
      "newBalance": 2500
    },
    "transactions": [
      { "id": 902, "userId": 123, "amount": -1000 },
      { "id": 903, "userId": 456, "amount": 1000 }
    ]
  },
  "message": "Successfully transferred 1000 credits from user #123 to user #456"
}
```

---

## Admin Configuration Endpoints

### Get Property Tiers

**GET** `/api/credits/admin/tiers`

**(Admin Only)** Get all property tiers with multipliers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "DIAMOND",
      "name": "Diamond Properties",
      "multiplier": 1.5,
      "displayOrder": 1
    },
    {
      "id": 2,
      "code": "GOLD_HIGH",
      "name": "Gold High Season",
      "multiplier": 1.3,
      "displayOrder": 2
    }
  ]
}
```

---

### Update Property Tier

**PUT** `/api/credits/admin/tiers/:id`

**(Admin Only)** Update tier multiplier.

**Request Body:**
```json
{
  "multiplier": 1.6
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "DIAMOND",
    "name": "Diamond Properties",
    "multiplier": 1.6
  },
  "message": "Successfully updated Diamond Properties multiplier to 1.6"
}
```

---

### Assign Tier to Property

**PUT** `/api/credits/admin/properties/:id/tier`

**(Admin Only)** Assign a tier to a property.

**Request Body:**
```json
{
  "tierId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "propertyId": 10,
    "propertyName": "Luxury Beach Resort",
    "tierId": 1,
    "tierName": "Diamond Properties",
    "multiplier": 1.5
  },
  "message": "Successfully assigned Diamond Properties tier to Luxury Beach Resort"
}
```

---

### Get Room Type Multipliers

**GET** `/api/credits/admin/room-multipliers`

**(Admin Only)** Get all room type multipliers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "roomType": "STANDARD",
      "multiplier": 1.0,
      "isActive": true,
      "displayOrder": 1
    },
    {
      "id": 2,
      "roomType": "DELUXE",
      "multiplier": 1.5,
      "isActive": true,
      "displayOrder": 3
    }
  ]
}
```

---

### Update Room Type Multiplier

**PUT** `/api/credits/admin/room-multipliers/:id`

**(Admin Only)** Update room type multiplier.

**Request Body:**
```json
{
  "multiplier": 1.6
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "roomType": "DELUXE",
    "multiplier": 1.6
  },
  "message": "Successfully updated DELUXE multiplier to 1.6"
}
```

---

### Get Seasonal Calendar

**GET** `/api/credits/admin/seasonal-calendar/:propertyId/:year`

**(Admin Only)** Get seasonal calendar for property and year.

**Parameters:**
- `propertyId` (path, required): Property ID
- `year` (path, required): Year (e.g., 2025)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "propertyId": 10,
      "seasonType": "RED",
      "startDate": "2025-07-01",
      "endDate": "2025-08-31",
      "year": 2025
    },
    {
      "id": 2,
      "propertyId": 10,
      "seasonType": "WHITE",
      "startDate": "2025-05-01",
      "endDate": "2025-06-30",
      "year": 2025
    }
  ]
}
```

---

### Create Seasonal Calendar Entry

**POST** `/api/credits/admin/seasonal-calendar`

**(Admin Only)** Create new seasonal calendar entry.

**Request Body:**
```json
{
  "propertyId": 10,
  "seasonType": "RED",
  "startDate": "2025-12-20",
  "endDate": "2026-01-10",
  "year": 2025
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "propertyId": 10,
    "seasonType": "RED",
    "startDate": "2025-12-20",
    "endDate": "2026-01-10",
    "year": 2025
  },
  "message": "Successfully created seasonal calendar entry"
}
```

---

### Get Booking Costs

**GET** `/api/credits/admin/booking-costs/:propertyId`

**(Admin Only)** Get booking costs for a property.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "propertyId": 10,
      "roomType": "DELUXE",
      "seasonType": "RED",
      "creditsPerNight": 900,
      "effectiveFrom": "2025-01-01T00:00:00.000Z",
      "effectiveUntil": null,
      "isActive": true
    }
  ]
}
```

---

### Update Booking Costs

**POST** `/api/credits/admin/booking-costs/:propertyId`

**(Admin Only)** Update booking costs for property.

**Request Body:**
```json
{
  "effectiveFrom": "2025-03-01",
  "prices": [
    { "roomType": "STANDARD", "seasonType": "RED", "creditsPerNight": 700 },
    { "roomType": "STANDARD", "seasonType": "WHITE", "creditsPerNight": 450 },
    { "roomType": "DELUXE", "seasonType": "RED", "creditsPerNight": 1050 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully updated booking costs for property #10",
  "data": {
    "pricesUpdated": 3,
    "effectiveFrom": "2025-03-01"
  }
}
```

---

### Get Platform Settings

**GET** `/api/credits/admin/settings`

**(Admin Only)** Get all platform settings.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "key": "credit_to_euro_rate",
      "value": "1.00",
      "dataType": "DECIMAL",
      "category": "CONVERSION",
      "description": "Conversion rate: 1 credit = X euros",
      "isEditable": true
    },
    {
      "id": 2,
      "key": "credit_expiration_months",
      "value": "6",
      "dataType": "INTEGER",
      "category": "EXPIRATION",
      "description": "Number of months until credits expire",
      "isEditable": true
    }
  ]
}
```

---

### Update Platform Setting

**PUT** `/api/credits/admin/settings/:key`

**(Admin Only)** Update a platform setting value.

**Request Body:**
```json
{
  "value": "1.10",
  "reason": "Adjusted conversion rate for 2025"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "credit_to_euro_rate",
    "value": "1.10",
    "oldValue": "1.00"
  },
  "message": "Successfully updated setting credit_to_euro_rate"
}
```

---

### Get Change Log

**GET** `/api/credits/admin/change-log`

**(Admin Only)** Get audit log of setting changes.

**Parameters:**
- `limit` (query, optional): Number of records (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "settingKey": "credit_to_euro_rate",
      "oldValue": "1.00",
      "newValue": "1.10",
      "changedBy": 1,
      "reason": "Adjusted conversion rate for 2025",
      "changedAt": "2025-01-25T10:00:00.000Z"
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters or missing required fields
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Admin access required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Integration Notes

### Booking Flow with Credits

1. **Calculate Cost**: Call `/api/credits/calculate-booking-cost` with booking details
2. **Check Affordability**: Call `/api/credits/check-affordability` with user ID and required credits
3. **If Insufficient**: Show hybrid payment option (credits + cash)
4. **Process Payment**: Create booking with `payment_method='CREDITS'` or `payment_method='HYBRID'`
5. **Deduct Credits**: System automatically calls `CreditWalletService.spendCredits()`

### Week Deposit Flow

1. **Preview Credits**: Call `/api/credits/estimate` to show user potential earnings
2. **Verify Ownership**: Check `week_claim_requests` table for pending verification
3. **Deposit Week**: Call `/api/credits/deposit` to convert week to credits
4. **Update Wallet**: Credits added with 6-month expiration

### Expiration Management

- **Scheduled Job**: Run `CreditWalletService.expireCredits()` daily
- **Warning Notifications**: Check `expiringIn30Days` from wallet summary
- **FIFO Processing**: Oldest credits spent first when booking

---

## Testing Endpoints

Use Postman or curl to test:

```bash
# Get wallet
curl -X GET http://localhost:3000/api/credits/wallet/123 \
  -H "Authorization: Bearer <token>"

# Estimate credits
curl -X POST http://localhost:3000/api/credits/estimate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "propertyId": 10,
    "roomType": "DELUXE",
    "weekStartDate": "2025-07-15"
  }'

# Calculate booking cost
curl -X POST http://localhost:3000/api/credits/calculate-booking-cost \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "propertyId": 15,
    "roomType": "SUPERIOR",
    "checkInDate": "2025-08-01",
    "checkOutDate": "2025-08-08"
  }'
```

---

## Database Schema Reference

### Key Tables

- **user_credit_wallets**: User balance and totals
- **credit_transactions**: All credit movements (HIGH VOLUME with 7 indexes)
- **property_tiers**: Location multipliers (1.0x - 1.5x)
- **room_type_multipliers**: Room type multipliers (1.0x - 3.0x)
- **seasonal_calendar**: RED/WHITE/BLUE season definitions
- **credit_booking_costs**: Dynamic pricing per property/room/season
- **platform_settings**: System configuration

### Credit Formula

```
DEPOSIT_CREDITS = BASE_SEASON_VALUE × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER

Where:
- BASE_SEASON_VALUE: RED=1000, WHITE=600, BLUE=300
- LOCATION_MULTIPLIER: From property_tiers (1.0 - 1.5)
- ROOM_TYPE_MULTIPLIER: From room_type_multipliers (1.0 - 3.0)

BOOKING_COST = Sum of (credits_per_night for each night in stay)
```

---

## Support

For questions or issues with the Credit System API, contact the development team or refer to:

- **Technical Spec**: `/CREDIT_SYSTEM_ANALYSIS.md`
- **Migration Guide**: `/CREDIT_MIGRATIONS_PRODUCTION_READY.md`
- **Main README**: `/README.md`
