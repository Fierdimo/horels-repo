# Backend Implementation: Week Swap System

**Status**: ✅ Implemented  
**Date**: December 21, 2025

---

## 📋 Overview

The backend now has a complete system for managing week swaps between owners, including:
- 🔍 Search for compatible weeks
- 📝 Create swap requests
- ✅ Staff approval workflow
- 💳 Stripe payment integration for €10 fee
- 🔄 Atomic swap completion (ownership transfer)

---

## 🏗️ Architecture

### New Services

#### `SwapService` (`src/services/swapService.ts`)
Handles all business logic for swaps:

**Key Methods:**
- `findCompatibleWeeks()` - Search weeks by accommodation type, availability, and exclude peak dates
- `checkWeekAvailability()` - Verify no conflicts (bookings or active swaps)
- `createSwapRequest()` - Create new swap with validation
- `approveSwap()` - Staff approval
- `rejectSwap()` - Staff rejection
- `acceptSwap()` - Responder acceptance
- `rejectSwapRequest()` - Responder rejection
- `completeSwap()` - Atomic transfer of ownership after payment

**Features:**
- ✅ Peak date validation (Christmas, Easter, Summer)
- ✅ Accommodation type matching (sencilla ↔ sencilla only)
- ✅ Conflict detection (overlapping bookings/swaps)
- ✅ Staff workflow (pending → matched → awaiting_payment → completed)
- ✅ Responder acceptance workflow

### Controllers

#### `SwapController` (`src/controllers/swapController.ts`)
HTTP request handlers for swap operations:

**Owner Endpoints:**
- `searchCompatibleWeeks()` - Find compatible weeks
- `createSwapRequest()` - Create new swap
- `getOwnerSwaps()` - List all swaps
- `getSwapDetails()` - Get swap details
- `acceptSwap()` - Accept as responder
- `rejectSwap()` - Reject as responder
- `createPaymentIntent()` - Create Stripe payment for fee
- `confirmPayment()` - Confirm payment and complete swap

---

## 🛣️ API Routes

### Owner Routes (`/hotels/owner/swaps`)

#### Search Compatible Weeks
```
GET /owner/swaps/compatible-weeks/:weekId
Query: propertyId?, limit?

Response:
{
  success: true,
  data: {
    requesterWeek: Week,
    compatibleWeeks: Week[],
    total: number
  }
}
```

#### Create Swap Request
```
POST /owner/swaps
Body: {
  weekId: number (required),
  responderWeekId?: number,
  desiredStartDate?: ISO string,
  desiredEndDate?: ISO string,
  notes?: string
}

Response:
{
  success: true,
  message: "Swap request created successfully",
  data: SwapRequest
}
```

#### Get Owner's Swaps
```
GET /owner/swaps
Query: role? = 'requester' | 'responder' | 'both'

Response:
{
  success: true,
  data: SwapRequest[],
  total: number
}
```

#### Get Swap Details
```
GET /owner/swaps/:swapId

Response:
{
  success: true,
  data: SwapRequest (with related weeks and owners)
}
```

#### Accept Swap (as Responder)
```
POST /owner/swaps/:swapId/accept

Response:
{
  success: true,
  message: "Swap accepted. Please proceed to payment.",
  data: SwapRequest (status: awaiting_payment)
}
```

#### Reject Swap (as Responder)
```
POST /owner/swaps/:swapId/reject

Response:
{
  success: true,
  message: "Swap rejected",
  data: SwapRequest (status: cancelled)
}
```

#### Create Payment Intent
```
POST /owner/swaps/:swapId/payment-intent

Response:
{
  success: true,
  message: "Payment intent created",
  data: {
    swapId: number,
    amount: 10.00,
    currency: "EUR",
    clientSecret: string,
    paymentIntentId: string,
    description: string
  }
}
```

#### Confirm Payment & Complete Swap
```
POST /owner/swaps/:swapId/confirm-payment
Body: {
  paymentIntentId: string (required)
}

Response:
{
  success: true,
  message: "Swap completed successfully! Weeks have been exchanged.",
  data: {
    swap: SwapRequest (status: completed),
    payment: {
      success: true,
      paymentIntentId: string,
      status: "succeeded",
      amount: 10,
      currency: "EUR"
    }
  }
}
```

---

### Staff Routes (`/hotels/staff/swaps`)

#### Get Pending Swaps
```
GET /staff/swaps/pending

Response:
{
  success: true,
  data: SwapRequest[],
  total: number
}
```

#### Get All Swaps
```
GET /staff/swaps
Query: status? = 'pending' | 'matched' | 'awaiting_payment' | 'completed' | 'cancelled'

Response:
{
  success: true,
  data: SwapRequest[],
  total: number
}
```

#### Get Swap Details
```
GET /staff/swaps/:swapId

Response:
{
  success: true,
  data: SwapRequest (with full details)
}
```

#### Approve Swap
```
POST /staff/swaps/:swapId/approve
Body: {
  notes?: string
}

Response:
{
  success: true,
  message: "Swap approved. Waiting for responder confirmation.",
  data: SwapRequest (status: awaiting_payment, staff_approval_status: approved)
}
```

#### Reject Swap
```
POST /staff/swaps/:swapId/reject
Body: {
  reason: string (required)
}

Response:
{
  success: true,
  message: "Swap rejected",
  data: SwapRequest (status: cancelled, staff_approval_status: rejected)
}
```

---

## 💳 Stripe Integration

### New StripeService Methods

#### Create Swap Fee Payment Intent
```typescript
async createSwapFeePaymentIntent(
  userId: number,
  swapId: number,
  requesterWeekId: number,
  amount?: number, // default: 10.00 EUR
  email?: string
): Promise<{
  clientSecret: string,
  paymentIntentId: string,
  amount: number,
  currency: "EUR",
  status: string
}>
```

#### Confirm Swap Fee Payment
```typescript
async confirmSwapFeePayment(
  paymentIntentId: string,
  swapId: number
): Promise<{
  success: boolean,
  paymentIntentId: string,
  status: "succeeded",
  amount: number,
  currency: "EUR"
}>
```

**Metadata stored with Stripe:**
```json
{
  "type": "swap_fee",
  "swap_id": "123",
  "week_id": "456",
  "user_id": "789"
}
```

---

## 🔐 Validation & Security

### Peak Date Validation
Swaps blocked during:
- **Christmas**: Dec 15 - Jan 5
- **Easter**: Apr 9 - Apr 16
- **Summer**: Jul 15 - Aug 25

### Accommodation Type Matching
- Weeks only match if both have identical `accommodation_type`
- Examples: "sencilla" ↔ "sencilla", "duplex" ↔ "duplex"

### Availability Checking
- Detects conflicting bookings (overlapping dates)
- Detects active swap requests on the same week
- Prevents double-booking

### Authorization
- Owners can only swap their own weeks
- Responders can only accept/reject their own swaps
- Staff can only manage swaps for their property
- Payment confirmation restricted to requester

---

## 📊 Workflow States

### Swap Status Progression
```
pending
  ↓ (staff approves)
matched
  ↓ (responder accepts)
awaiting_payment
  ↓ (requester pays)
completed
  ↓ (weeks transferred)
[Final State]

OR

[Any state]
  ↓ (staff/owner rejects)
cancelled
```

### Staff Approval Status
- `pending_review` - Waiting for staff review
- `approved` - Staff approved (swaps will continue if responder accepts)
- `rejected` - Staff rejected (swap cancelled)

### Responder Acceptance Status
- `pending` - Waiting for responder response
- `accepted` - Responder accepted
- `rejected` - Responder rejected (swap cancelled)

### Payment Status
- `pending` - Waiting for payment
- `paid` - Payment confirmed (swap can be completed)
- `refunded` - Payment refunded
- `failed` - Payment failed

---

## 🔄 Swap Completion Flow

1. **Request Created** (Requester)
   - `status: pending`
   - `staff_approval_status: pending_review`
   - `responder_acceptance: pending`
   - `payment_status: pending`

2. **Staff Approves** (Staff)
   - `status: matched`
   - `staff_approval_status: approved`
   - Notify responder

3. **Responder Accepts** (Responder)
   - `responder_acceptance: accepted`
   - `status: awaiting_payment`
   - Notify requester to pay

4. **Requester Creates Payment Intent**
   - Generate Stripe Payment Intent (€10)
   - Store `payment_intent_id` on swap
   - Return client secret to frontend

5. **Requester Confirms Payment**
   - Verify payment with Stripe
   - Transfer week ownership (atomic transaction)
   - Update both weeks' owner_id
   - `status: completed`
   - `payment_status: paid`
   - `paid_at: timestamp`
   - Notify both owners

---

## 🚀 Usage Examples

### Frontend Integration (TypeScript)

```typescript
// 1. Search compatible weeks
const response = await fetch(
  '/hotels/owner/swaps/compatible-weeks/123?limit=20',
  { headers: { Authorization: `Bearer ${token}` } }
);
const { data } = await response.json();

// 2. Create swap request
const swap = await fetch('/hotels/owner/swaps', {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    weekId: 123,
    responderWeekId: 456,
    notes: 'Looking for a summer swap'
  })
});

// 3. Accept swap (as responder)
await fetch('/hotels/owner/swaps/789/accept', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});

// 4. Create payment intent
const payment = await fetch('/hotels/owner/swaps/789/payment-intent', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const { data: { clientSecret } } = await payment.json();

// 5. Confirm payment (after Stripe confirmation)
const confirmed = await fetch('/hotels/owner/swaps/789/confirm-payment', {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ paymentIntentId: 'pi_...' })
});
```

---

## 📝 Database Schema

### SwapRequest Table
```sql
CREATE TABLE swap_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Basic swap info
  requester_id INT NOT NULL,
  requester_week_id INT NOT NULL,
  responder_week_id INT,
  desired_start_date DATE,
  desired_end_date DATE,
  notes TEXT,
  accommodation_type VARCHAR(100),
  swap_fee DECIMAL(10,2) DEFAULT 10.00,
  property_id INT,
  
  -- Status tracking
  status ENUM('pending', 'matched', 'awaiting_payment', 'completed', 'cancelled'),
  
  -- Staff approval
  staff_approval_status ENUM('pending_review', 'approved', 'rejected'),
  reviewed_by_staff_id INT,
  staff_review_date TIMESTAMP,
  staff_notes TEXT,
  
  -- Responder acceptance
  responder_acceptance ENUM('pending', 'accepted', 'rejected'),
  responder_acceptance_date TIMESTAMP,
  
  -- Payment
  payment_intent_id VARCHAR(255),
  payment_status ENUM('pending', 'paid', 'refunded', 'failed'),
  commission_amount DECIMAL(10,2),
  paid_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_requester (requester_id),
  INDEX idx_responder_week (responder_week_id),
  INDEX idx_property (property_id),
  INDEX idx_status (status)
);
```

---

## ✅ Testing Checklist

- [ ] Search compatible weeks by accommodation type
- [ ] Create swap request with responder week
- [ ] Create swap request without responder (matching later)
- [ ] Staff approves swap
- [ ] Staff rejects swap with reason
- [ ] Responder accepts swap
- [ ] Responder rejects swap
- [ ] Create Stripe payment intent
- [ ] Confirm payment completes swap
- [ ] Verify week ownership transfer
- [ ] Peak date blocking
- [ ] Conflict detection (overlapping bookings)
- [ ] Authorization checks (ownership, property)
- [ ] Idempotency (payment already processed)

---

## 🔌 Integration Notes

### Middleware
- `authenticateToken` - JWT validation
- `requireOwnerRole` - Owner access only
- `requireStaffRole` - Staff access only
- `authorize(['view_own_weeks'])` - Permission check

### Error Handling
- Validation errors: 400
- Authorization errors: 403
- Not found: 404
- Server errors: 500

### Logging
- `logAction()` middleware logs all swap operations to action_logs
- Actions: `create_swap_request`, `approve_swap`, `reject_swap`, `accept_swap`, `complete_swap_payment`

---

**Implementation Date**: December 21, 2025  
**Backend Status**: ✅ Ready for Frontend Integration
