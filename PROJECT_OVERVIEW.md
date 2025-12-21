# Timeshare + Hotel Management App - Project Overview

**Project Name:** Secret World Hotels (Timeshare & Multiproperty Management)  
**Version:** MVP  
**Last Updated:** December 21, 2025 - Accommodation Type System Implemented

---

## 1. Project Goal

Build a lightweight, focused app (not a monster-ERP) to manage timeshare weeks and multiproperty assets while maximizing hotel occupancy and revenue.

### Business Objectives

- **Increase usage of owned weeks** - Enable owners to use, swap, or convert their weeks
- **Fill hotel rooms year-round** - Leverage flexible night credits to fill vacant inventory
- **Generate recurring revenue** - Fees from swaps (€10), extra nights, add-on services
- **Improve user engagement** - Integration with Secret World travel content and experiences

### Target Users

- **Owners:** Timeshare/multiproperty owners managing their annual weeks
- **Hotel Guests:** Light-weight access for reservation guests (no full account)

---

## 2. Core Architecture

### User Roles

| Role | Access | Key Features |
|------|--------|--------------|
| **Owner** | Full account with email/contract login | Week management, swaps, night credits, bookings |
| **Hotel Guest** | Link/QR-based light access | View booking, request services, access travel content |
| **Staff** | PMS-linked staff account | Manage bookings, handle guest requests, view reservations |
| **Admin** | Full platform management | User approvals, logs, settings, revenue reports |

### Key Data Models

```
Week
├── id, owner_id, property_id
├── dates (start_date, end_date)
├── color (Red/Blue/White)
├── status (available, confirmed, converted, used)
└── Property (association)

SwapRequest
├── id, requester_week_id, responder_week_id
├── status (pending, matched, completed, cancelled)
├── swap_fee (€10)
└── timestamps

NightCredit
├── id, owner_id, week_id
├── nights_available, nights_used
├── expires_at
└── history

Booking
├── id, property_id, guest_id
├── check_in, check_out
├── status, room_type
└── external_refs (PMS integration)

HotelService
├── id, property_id
├── name, description, price
├── payment_status
└── booking_association
```

---

## 3. Owner Features (Detailed Flows)

### 3.1 Week Management - "My Weeks"

**Screen Layout:**
- List of owned weeks with cards showing:
  - Dates, property name, color code
  - Current status badge
  - 3 action buttons

**Week Accommodation Type:**

Each timeshare week is tied to a specific **accommodation type** (room type). Owners can only swap weeks with other weeks of the **same accommodation type**.

| Accommodation Type | Example | Swap Rule |
|---|---|---|
| **Sencilla** | Single room, basic amenities | Only swap with other "Sencilla" weeks |
| **Duplex** | 2-level unit, 2 bedrooms | Only swap with other "Duplex" weeks |
| **Suite** | Premium unit, all amenities | Only swap with other "Suite" weeks |
| *Custom types* | Owner-defined room types | Only swap with same custom type |

**Key Rules:**
- ✅ **Accommodation type inherited from room:** When a marketplace booking is approved, a week is created with the room's type
- ✅ **Same-type swaps only:** Sencilla↔Sencilla, Duplex↔Duplex, Suite↔Suite
- ✅ **Set by room definition:** Staff defines room.type when creating/editing rooms (no separate color assignment needed)
- ✅ **Immutable:** Type cannot change after booking approval / week creation
- ✅ **Database structure:** 
  - Rooms table: has `type` column (sencilla, duplex, suite, etc.)
  - Weeks table: inherits `accommodation_type` from room when created

**Implementation Details:**

**Workflow (No API needed for color assignment):**
```
1. Staff creates Property
   ↓
2. Staff creates Rooms with TYPE defined (e.g., "sencilla", "duplex", "suite")
   ↓
3. Room is published to marketplace with its type
   ↓
4. Guest books room via marketplace → Creates BOOKING
   ↓
5. Staff approves booking → Creates WEEK with room's accommodation_type
   ↓
6. Guest (now owner) can use week for:
   - Swaps (only with same-type weeks)
   - Convert to Night Credits
   - Future bookings
```

**Example Scenario:**
```
Property "Beachfront Resort" has:
├── Room 1: "Sencilla Oceanview" (type: "sencilla")
├── Room 2: "Duplex Suite" (type: "duplex")
└── Room 3: "Penthouse" (type: "suite")

Guest books "Sencilla Oceanview" for Jan 1-8
└─→ Booking created (pending approval)
└─→ Staff approves
    └─→ Week created: 
        - owner: guest
        - accommodation_type: "sencilla"
        - dates: Jan 1-8

Later, another guest books different "Sencilla" room
└─→ Week created with accommodation_type: "sencilla"

Owner 1 can SWAP both weeks (same type: sencilla)
Owner 1 CANNOT SWAP with Duplex or Suite weeks
```

---

### 3.2 Feature: Confirm Week + Extra Nights (Upsell)

**Flow:**

```
1. Owner views week → Taps "Confirm Week" button
2. System shows confirmation dialog:
   - Week dates & property details
   - "Add extra nights?" prompt (optional)
3. If Owner selects extra nights:
   - Offers choices:
     a) Extra nights BEFORE arrival
     b) Extra nights AFTER departure
   - Special "Owner rate" pricing (TBD)
4. System calls PMS API: checkAvailability()
   - Validates room availability for selected dates
   - Returns pricing
5. If available → Payment Flow:
   - Shows Stripe/Apple Pay/Google Pay options
   - Creates payment intent
   - On success → Week status = "confirmed"
6. Final Checkout Screen displays:
   - Stay summary (dates, property, room)
   - Extra nights cost breakdown
   - Extra hotel services (optional add-ons)
   - Secret World content block ("What to do near your hotel")
7. Creates/updates reservation in PMS via createReservation()
```

**Implementation Status:**
- ✅ Week list & display
- ✅ Confirmation UI
- ⏳ PMS integration (checkAvailability, createReservation)
- ⏳ Stripe payment integration
- ⏳ Extra nights pricing logic

---

### 3.3 Feature: Owner-to-Owner Swap (Dynamic Fee Model)

**Rules:**
- Swaps only between same-color weeks (Red↔Red, Blue↔Blue, White↔White)
- **Fee charged ONLY when swap is successfully completed**
- **Creating and requesting swaps is completely FREE**
- Dynamic fee (configurable per platform, not fixed)
- Both owners must accept the swap

**User Journey - Step by Step (Easy UX)**

#### Step 1: Browse Available Swaps (Free Exploration)

**What the owner sees:**
- "My Weeks" dashboard with their owned weeks
- Each week card shows:
  - Dates, property, color, current status
  - Three action buttons: "Confirm", "Swap", "Convert to Credits"

```
┌─────────────────────────────────────┐
│ My Red Week - Maldives              │
│ Jan 1-7, 2025 | Villa Beachfront    │
│ Status: Available                    │
│ [Confirm] [Swap] [→ Credits]        │
└─────────────────────────────────────┘
```

---

#### Step 2: Create Swap Request (Free - Zero Friction)

**User taps "Swap" button → Simple form:**

```
┌──────────────────────────────────────────┐
│ REQUEST A SWAP                           │
├──────────────────────────────────────────┤
│                                          │
│ Your week:                               │
│ ☑ Red Week (Jan 1-7, 2025)              │
│                                          │
│ What are you looking for?                │
│                                          │
│ 📅 Preferred dates:                      │
│ [From] Jan 15    [To] Jan 22             │
│                                          │
│ 🏨 Preferred property (optional):        │
│ [Dropdown: Any / Maldives / Dubai...]    │
│                                          │
│ 🎨 Color:                                │
│ ☑ Red ☐ Blue ☐ White                     │
│                                          │
│ Notes (optional):                        │
│ [Text: "Looking for beach..."]           │
│                                          │
│ ┌─ ℹ️ INFO ──────────────────────────┐   │
│ │ Creating a swap request is FREE!   │   │
│ │ Fee only charged if swap matches   │   │
│ │ and both owners accept.            │   │
│ └────────────────────────────────────┘   │
│                                          │
│              [CANCEL] [SUBMIT REQUEST]   │
└──────────────────────────────────────────┘
```

**What happens on submit:**
- Request created instantly (NO payment yet)
- Owner gets notification: "✅ Your swap request is live!"
- Request appears in "My Swap Requests" tab with status "Looking for a match..."

---

#### Step 3: Browse Matching Opportunities

**Owner navigates to "Swaps" tab:**

```
┌──────────────────────────────────────────┐
│ FIND SWAPS                               │
│ (Requests from other owners)             │
├──────────────────────────────────────────┤
│                                          │
│ 🔍 [Search] [Filter ⋮]                   │
│ Filters: Color ▼ | Dates ▼ | Property ▼ │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│ ✨ PERFECT MATCH                         │
│ Blue Week → Jan 15-22, Dubai             │
│ Owner: "Ahmed M." ⭐⭐⭐⭐⭐               │
│ Wants: Red Week, Jan 1-7                 │
│ [👁️ VIEW] [✓ ACCEPT SWAP]                │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ Blue Week → Feb 1-8, Maldives            │
│ Owner: "Sofia T." ⭐⭐⭐⭐                │
│ Wants: Red/White week, Feb dates         │
│ [👁️ VIEW] [CONTACT OWNER]                │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ White Week → Mar 5-11, Dubai             │
│ Owner: "Marco R."                        │
│ Wants: Red week any dates                │
│ [👁️ VIEW] [✓ ACCEPT SWAP]                │
│                                          │
└──────────────────────────────────────────┘
```

**Key features:**
- Algorithm shows **best matches first** (matching color, dates, preferences)
- One-tap accept for perfect matches
- "Contact Owner" for interested but non-perfect swaps
- No fee info yet (creating/browsing is free)

---

#### Step 4: Accept a Swap Match (Fee Disclosed)

**User taps "✓ ACCEPT SWAP" → Payment Confirmation:**

```
┌────────────────────────────────────────────┐
│ CONFIRM SWAP                               │
├────────────────────────────────────────────┤
│                                            │
│ YOU OFFER:                                 │
│ 🔴 Red Week: Jan 1-7, 2025                │
│    Maldives, Villa Beachfront             │
│                                            │
│ THEY OFFER:                                │
│ 🔵 Blue Week: Jan 15-22, 2025              │
│    Dubai, Marina Apartments               │
│                                            │
│ SWAP WITH: Ahmed M. ⭐⭐⭐⭐⭐             │
│                                            │
│ ════════════════════════════════════════  │
│                                            │
│ 💳 PAYMENT DETAILS                         │
│ ─────────────────────────────────────────  │
│ If this swap is confirmed:                │
│                                            │
│ Platform fee: €15                          │
│ (Only charged if both owners accept       │
│  and swap is completed)                   │
│                                            │
│ Payment method: •••• 4242                  │
│ [Change payment method]                    │
│                                            │
│ ════════════════════════════════════════  │
│                                            │
│ ℹ️ HOW IT WORKS:                           │
│ 1. Both owners must accept this swap       │
│ 2. Once both accept, €15 is charged to    │
│    each account                            │
│ 3. Weeks are swapped in your accounts     │
│ 4. Hotels are notified of the new dates   │
│                                            │
│     [CANCEL] [ACCEPT & PAY IF MATCHED]    │
└────────────────────────────────────────────┘
```

**Important UX elements:**
- ✅ **Fee is clearly visible** before confirming
- ✅ **Payment only happens if BOTH accept** (reassurance)
- ✅ **Shows which payment method** will be charged
- ✅ **Explains the flow** in simple terms
- ⚠️ No charge yet - just confirmation

---

#### Step 5: Waiting for Match (Transparent Status)

**After accepting, user sees:**

```
┌──────────────────────────────────────────┐
│ MY SWAP REQUESTS                         │
├──────────────────────────────────────────┤
│                                          │
│ 🔴 Your request: Red Week (Jan 1-7)     │
│ Status: 🔄 Waiting for their acceptance │
│ ⏱️ Pending since: Dec 19, 2025          │
│                                          │
│ ✓ Match found!                           │
│ 🔵 Blue Week (Jan 15-22)                │
│ From: Ahmed M.                           │
│                                          │
│ ⏳ Payment Pending:                       │
│ Both owners must accept.                 │
│ You accepted ✓ on Dec 19                 │
│ Ahmed accepted ✓ on Dec 19               │
│                                          │
│ 💰 Fee: €15 (will be charged when both  │
│    accept this exact swap)               │
│                                          │
│ [👁️ VIEW DETAILS] [WITHDRAW]             │
│                                          │
└──────────────────────────────────────────┘
```

---

#### Step 6: Swap Confirmed - Payment Charged

**When both owners accept same swap:**

```
📬 EMAIL TO OWNER:

Subject: ✅ Swap Confirmed! Your weeks have been swapped.

Hi Sarah,

Great news! Your swap with Ahmed has been confirmed. 

YOUR WEEKS NOW:
🔵 Blue Week: Jan 15-22, 2025 | Dubai Marina

Ahmed's weeks now:
🔴 Red Week: Jan 1-7, 2025 | Maldives

PAYMENT PROCESSED:
Platform Fee: €15 charged to card •••• 4242
Date: Dec 19, 2025

WHAT'S NEXT:
1. Check your new week dates in the app
2. Hotels have been notified of the date change
3. Your confirmation letter will be emailed within 24h

Need help? Contact us at support@...

Thanks for using our platform!
```

**In-app notification:**
```
🎉 SWAP COMPLETED!

Your swap with Ahmed has been confirmed.
€15 fee charged to your account.

Your new week is now:
🔵 Blue Week: Jan 15-22, Dubai

[VIEW MY WEEKS] [REVIEW SWAP DETAILS]
```

---

### UX Design Principles (Key to Easy Adoption)

#### 1. **No Friction on Request Creation**
- ✅ Form is simple (5 fields max)
- ✅ Zero payment until match
- ✅ Takes <2 minutes to create request

#### 2. **Clear Fee Communication**
- ✅ Fee shown ONLY when accepting a match
- ✅ Message: "Fee only charged if both accept"
- ✅ No surprise charges
- ✅ Fee amount is dynamic (shows current configured fee)

#### 3. **Smart Matching**
- ✅ Algorithm surfaces best matches first
- ✅ Filter options (color, dates, property)
- ✅ Owner ratings/reviews visible for trust
- ✅ Contact option for non-perfect matches

#### 4. **Transparency Throughout**
- ✅ Real-time status updates
- ✅ Shows when other owner accepted
- ✅ Clear explanation of pending state
- ✅ Email confirmation with all details

#### 5. **Trust Builders**
- ✅ Owner profiles with ratings
- ✅ Both owners see each other (not anonymous)
- ✅ "Contact owner" for negotiation
- ✅ Clear step-by-step explanation of process

---

### Backend/API Structure for Easy Integration

**Endpoints needed:**

```
POST /timeshare/swaps
  Request: { week_id, desired_dates, preferred_property?, notes? }
  Response: { swap_request_id, status: "pending" }
  Payment: NONE

GET /timeshare/swaps/available
  Query: { color?, dates?, property? }
  Response: [ { id, week_details, owner_info, ratings } ]
  Payment: NONE

POST /timeshare/swaps/{id}/accept
  Request: { swap_request_id, payment_method_id }
  Response: { status: "pending_mutual_acceptance" }
  Payment: PRE-AUTH (not captured yet)

POST /timeshare/swaps/{id}/confirm
  [Triggered when both owners accept]
  Action: CAPTURE pre-auth (charge fee)
  Update both week statuses
  Notify hotels

DELETE /timeshare/swaps/{id}
  Cancel swap request (refund pre-auth if exists)
```

**Dynamic Fee Handling:**

```
GET /platform/settings/swap-fee
  Response: { amount: 15, currency: "EUR" }

// On payment capture:
POST /payments/capture
  {
    pre_auth_id: "...",
    amount: 15  // Pulled from settings at time of capture
  }
```

---

### Configuration for Easy Platform Adjustment

**Admin dashboard setting:**

```
┌─────────────────────────────────────┐
│ PLATFORM SETTINGS → Monetization    │
├─────────────────────────────────────┤
│                                     │
│ Swap Fee Configuration:             │
│                                     │
│ Charge per swap (owner): € [15]     │
│ [Save]                              │
│                                     │
│ ℹ️ This fee is charged to EACH owner│
│    when a swap is completed.        │
│    Total revenue = fee × 2          │
│                                     │
│ Pre-auth Hold Duration:             │
│ [14] days                           │
│                                     │
│ Auto-cancel uncompleted swaps:      │
│ ☑ After [21] days of no match       │
│                                     │
└─────────────────────────────────────┘
```

---

### Implementation Checklist

**Frontend:**
- ✅ Swap request form (simple UI)
- ✅ Swap listing/browsing with filters
- ✅ Match confirmation modal with fee disclosure
- ✅ Status tracking throughout lifecycle
- ⏳ Owner ratings/profiles
- ⏳ Contact owner messaging

**Backend:**
- ✅ SwapRequest CRUD
- ✅ Swap matching algorithm
- ⏳ Stripe pre-auth on accept
- ⏳ Fee capture on mutual acceptance
- ⏳ Notification system (email + push)
- ⏳ Admin settings API for dynamic fee

**Payments:**
- ⏳ Pre-authorization flow
- ⏳ Conditional capture (only on match)
- ⏳ Refund/release pre-auth if swap cancelled
- ⏳ Error handling (failed auth, expired holds, etc.)

---

### Success Metrics for Swap Feature

| Metric | Target | Measurement |
|--------|--------|------------|
| Swap request creation rate | 50+/month | Form completion |
| Match success rate | >60% | Matched vs. total requests |
| Swap completion rate | >80% | Both accepted vs. matched |
| Fee capture success | >95% | Successful charges vs. attempts |
| User satisfaction | 4.5+/5 | Post-swap rating |
| Time to match | <7 days | Avg days from request to match |

---

**Implementation Status:**
- ✅ Swap request creation UI
- ✅ SwapRequest data model
- ✅ Swap listing & filtering
- ✅ Basic matching logic
- ⏳ Stripe pre-authorization logic
- ⏳ Dynamic fee configuration
- ⏳ Notification system (email + push)
- ⏳ Owner contact/messaging feature

---

### 3.4 Feature: Convert Week → Night Credits

**Concept:**
Owner surrenders their week in exchange for flexible night credits usable across the hotel group.

**Conversion Rates:**
- Red Week → 6 nights
- Blue Week → 5 nights
- White Week → 4 nights

**Credit Rules:**
- Expiration: 18-24 months from creation date
- Cannot be used during peak periods (TBD definition)
- Can be split across multiple stays (e.g., 2+2+2 nights)
- No refund if expired

**Using Night Credits:**

```
1. Owner views "My Night Credits" section
   - Shows total nights, remaining balance, expiry date
   - History of usage/expiry
2. Owner taps "Use Credits" or "Book with Credits"
3. Selection form:
   - Choose hotel/property
   - Select check-in/out dates
   - System shows available nights
4. System calls PMS: checkAvailability()
   - Validates room availability
   - Confirms can apply credit
5. If available:
   - System creates booking (status = pending_confirmation)
   - Deducts nights from credit balance
   - Calls PMS: createReservation()
   - Booking confirmed
6. Confirmation screen shows:
   - Reservation details
   - Updated credit balance
   - QR code for check-in
```

**Implementation Status:**
- ✅ Night Credit model
- ✅ Credit balance display
- ✅ Credit usage UI
- ✅ Expiration warnings (UI/Calendar view)
- ⏳ PMS availability check integration
- ⏳ Booking creation workflow
- ⏳ Peak period blocking logic

---

## 4. Hotel Guest Features (Light Role)

### 4.1 My Booking
**Access:** Via QR code or direct link (no login required initially)

**Displays:**
- Reservation dates, room type, confirmation number
- Check-in/check-out times and procedures
- Property address, contact info
- Amenities & rules

**Implementation Status:**
- ✅ Booking details page
- ✅ Guest-accessible routes
- ⏳ QR code generation & linking

---

### 4.2 Extra Services Request
**Simple MVP approach:**

- List of available services:
  - Late check-out
  - Early check-in
  - Baby cot / extra bed
  - Extra cleaning
  - Parking
- Guest selects → Simple form with request
- Submitted to staff backoffice (no automated processing in MVP)

**Implementation Status:**
- ✅ HotelService model
- ✅ Guest service request form
- ⏳ Staff backoffice to manage/fulfill requests

---

### 4.3 Secret World Integration
**Goal:** Show nearby travel cards, experiences, itineraries

**Integration Options:**
1. API call to Secret World service (if available)
2. Deep link to Secret World app
3. Embedded content block showing recommendations

**Expected Content:**
- Things to do near your hotel
- Local restaurants, attractions
- Curated itineraries
- Seasonal experiences

**Implementation Status:**
- ⏳ API integration (requires Secret World API details)
- ⏳ Content display component
- ⏳ Deep linking setup

---

## 5. Technical Stack & Architecture

### Frontend (React + TypeScript + Vite)

```
hotels-new/frontend/
├── src/
│   ├── pages/
│   │   ├── owner/          # Owner features
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Weeks.tsx
│   │   │   ├── Swaps.tsx
│   │   │   ├── Credits.tsx
│   │   │   └── Profile.tsx
│   │   ├── guest/          # Guest features
│   │   │   ├── BookingDetails.tsx
│   │   │   ├── Services.tsx
│   │   │   └── GuestDashboard.tsx
│   │   ├── staff/          # Staff features
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Services.tsx
│   │   │   └── Bookings.tsx
│   │   └── admin/          # Admin features
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── owner/
│   │   ├── guest/
│   │   └── staff/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSwaps.ts
│   │   ├── useWeeks.ts
│   │   ├── useProfile.ts
│   │   └── ... (custom logic)
│   ├── api/                # API clients
│   │   ├── client.ts       # Axios instance
│   │   ├── auth.ts
│   │   ├── timeshare.ts    # Week, Swap, Credit APIs
│   │   ├── booking.ts
│   │   └── services.ts
│   ├── stores/             # State (Zustand)
│   │   ├── authStore.ts
│   │   ├── themeStore.ts
│   │   └── ...
│   ├── types/              # TypeScript models
│   │   ├── models.ts       # Data structures
│   │   └── api.ts          # Request/Response types
│   ├── utils/              # Utilities
│   │   ├── constants.ts
│   │   └── helpers.ts
│   └── locales/            # i18n translations
│       ├── en/
│       ├── es/
│       ├── de/
│       ├── fr/
│       └── it/
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

**Key Libraries:**
- React Router: Navigation & protected routes
- TanStack Query: Server state management & caching
- Zustand: Client state (auth, theme)
- Stripe.js: Payment processing
- axios: HTTP client
- date-fns: Date utilities
- react-i18next: Translations (EN, ES, DE, FR, IT)
- TailwindCSS: Styling
- Lucide React: Icons
- React Hot Toast: Notifications

---

### Backend (Node.js + Express + TypeScript + Sequelize)

```
backend/
├── src/
│   ├── models/             # Sequelize models
│   │   ├── Week.ts
│   │   ├── SwapRequest.ts
│   │   ├── NightCredit.ts
│   │   ├── Booking.ts
│   │   ├── HotelService.ts
│   │   ├── User.ts
│   │   ├── Property.ts
│   │   └── ...
│   ├── routes/
│   │   ├── authRoutes.ts   # Login, register, profile
│   │   ├── timeshareRoutes.ts # Week, Swap, Credit APIs
│   │   ├── bookingRoutes.ts    # Booking APIs
│   │   ├── serviceRoutes.ts    # Service request APIs
│   │   └── adminRoutes.ts
│   ├── middleware/
│   │   ├── authMiddleware.ts
│   │   ├── authorizationMiddleware.ts
│   │   ├── ownerOnly.ts
│   │   ├── loggingMiddleware.ts
│   │   └── errorHandler.ts
│   ├── services/
│   │   ├── pmsServiceFactory.ts # PMS integration wrapper
│   │   ├── mewsService.ts       # Mews PMS implementation
│   │   ├── paymentService.ts    # Stripe integration
│   │   └── notificationService.ts
│   ├── migrations/         # Database migrations
│   ├── seeders/            # Seed data
│   └── server.ts
├── package.json
└── tsconfig.json
```

**Key Libraries:**
- Express: Web framework
- Sequelize: ORM
- JWT: Authentication
- Stripe API: Payment processing
- Axios: HTTP client for PMS integration
- Winston: Logging

---

### Database (PostgreSQL)

**Core Tables:**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| users | User accounts | id, email, role, status, firstName, lastName |
| roles | Role definitions | id, name, permissions |
| permissions | Access control | id, name, description |
| weeks | Timeshare weeks | id, owner_id, property_id, dates, color, status |
| swap_requests | Swap proposals | id, requester_week_id, responder_week_id, status, fee |
| night_credits | Flexible nights | id, owner_id, nights_available, nights_used, expires_at |
| bookings | Reservations | id, user_id, property_id, dates, status, external_refs |
| properties | Hotel properties | id, name, location, pms_id |
| hotel_services | Service catalog | id, property_id, name, price, type |
| action_logs | Audit trail | id, user_id, action, timestamp |

---

## 6. External Integrations

### 6.1 PMS (Property Management System)

**Current Implementation:** Mews PMS (with factory pattern for swappable implementations)

**Required APIs:**

| Endpoint | Purpose | Called When |
|----------|---------|-------------|
| `checkAvailability(dates, property)` | Verify rooms available | Before confirming week or booking credits |
| `createReservation(booking_data)` | Create PMS reservation | Week confirmed or credits used |
| `modifyReservation(booking_id, changes)` | Update existing reservation | Owner extends stay, changes dates |
| `getAvailableDates(property, range)` | Query availability calendar | Owner selecting credit booking dates |

**Authentication:** API key/token (stored securely)

**Implementation Status:**
- ✅ Mews service client (basic structure)
- ⏳ Full API endpoint implementations
- ⏳ Error handling & retry logic
- ⏳ Availability caching

---

### 6.2 Payment Processing (Stripe)

**Use Cases:**

| Scenario | Flow | Amount |
|----------|------|--------|
| Extra nights payment | Intent → Payment → Capture | Variable (nightly rate × nights) |
| Swap fee | Pre-auth → Capture on match | €10 per owner |
| Paid services | Intent → Capture | Variable per service |

**Implementation Status:**
- ✅ Stripe.js integration (frontend)
- ⏳ Backend payment endpoints
- ⏳ Webhook handling for payment status updates
- ⏳ PCI compliance review

---

### 6.3 Secret World Integration

**Goal:** Display travel content & experiences

**Implementation Options:**
1. **API Integration** (if Secret World provides API)
   - Endpoint: `/api/nearby?lat=X&lon=Y&radius=km`
   - Response: List of cards/itineraries
2. **Deep Linking** (redirect to Secret World app)
   - `secretworld://property/{property_id}`
3. **Embedded Content**
   - Static content blocks per property

**Implementation Status:**
- ⏳ Requires Secret World API details
- ⏳ Component development
- ⏳ Testing with sample data

---

## 7. Monetization & Revenue Model

### Philosophy: Free Access, Transaction-Based Monetization

**Core Principle:** Keep the app completely free for owners to encourage adoption and build critical mass. Monetization comes from successful transactions and partnerships, not access restrictions.

### Revenue Streams (Prioritized)

#### 1. **Swap Fees (Owner → App)** ⭐ Primary

**How it works:**
- Owners request swaps **completely free**
- No charge for creating or viewing swap requests
- Fee only charged when a swap is **successfully matched and confirmed**
- Fixed fee: **€10 per completed swap** (per owner, so €20 total per swap transaction)

**Payment flow:**
- During swap request creation: Pre-authorization of €10 on owner's saved payment method
- No charge yet (hold only, 7-14 days)
- When swap is matched: Capture the €10
- If no match found: Release the pre-authorization, no charge

**Rationale:**
- Zero friction for exploring swaps
- Owners only pay when they get value (successful swap)
- Builds trust and encourages app adoption
- Simple to implement, no hotel involvement needed

**Projected Revenue:**
- Conservative: 100 swaps/month × €20 (both owners) = **€2,000/month**
- Optimistic: 500 swaps/month × €20 = **€10,000/month**

**Implementation Status:** ⏳ Stripe pre-auth/capture flow pending

---

#### 2. **Extra Nights Commission (Hotel → App)** 🏨 Growth Driver

**How it works:**
- Owner confirms week + selects extra nights (before/after arrival)
- App checks availability & pricing via PMS
- Owner pays hotel rate + books through app
- **Hotel gets full room revenue**
- **App gets commission from hotel**: ~5-10% per night (to be negotiated per hotel)

**Payment flow:**
1. Owner selects extra nights
2. PMS returns availability & nightly rate
3. Owner authorizes payment via Stripe (full amount to hotel)
4. Booking created in PMS
5. Monthly invoice from hotels to app for commissions

**Why hotels accept this:**
- Fills rooms that might otherwise be empty
- No complex integration needed (they get paid the full rate)
- App handles all guest communication & service
- Hotels can incentivize owners with "owner rates" (discounted vs. public rate)

**Projected Revenue:**
- Conservative: 50 extra nights/month × €100/night × 7% = **€350/month**
- Optimistic: 300 extra nights/month × €120/night × 8% = **€2,880/month**

**Future Extension:**
- Regular hotel guests can also extend stays through app
- Same commission model applies
- Incentivizes building a strong guest-facing feature

**Implementation Status:** ⏳ PMS integration & nightly rate logic pending

---

#### 3. **Hotel Services Commission (Mixed Model)** 🛎️ Long-tail Revenue

**Bucket A: Hotel Internal Services** (Hotel pays commission)
- Parking, spa treatments, late checkout, breakfast add-ons, etc.
- Guest/owner pays hotel the service price
- Hotel pays app a **service commission** or **revenue share** (e.g., 10-15%) when:
  - Service is booked through the app (not at reception)
  - Booking is made via mobile (higher value for hotel)

**Bucket B: Third-party Services** (App/partner pays or user pays)
- Transfers, tour bookings, special packages
- App partners with service providers
- Revenue models:
  - **Margin model**: User pays €50, we take €10 commission
  - **Referral model**: Partner pays us €5 per booking
  - **Revenue share**: We get 20% of total booking value

**Payment flow:**
- Services listed in app during booking flow
- Guest/owner selects & pays via Stripe
- Funds split according to agreement (hotel, provider, app)
- Monthly accounting & reconciliation

**Rationale:**
- Low friction for users (just adding optional items to booking)
- Multiple monetization angles
- Enhances guest experience (they get relevant offers at booking time)
- Hotels appreciate the extra revenue opportunity

**Projected Revenue:**
- Conservative: 100 service bookings/month × €5 average commission = **€500/month**
- Optimistic: 500 service bookings/month × €8 average commission = **€4,000/month**

**Implementation Status:** ✅ Service request UI done | ⏳ Payment integration pending

---

### Revenue Summary Table

| Stream | Transaction | Recipient | App Revenue | Volume Target |
|--------|-------------|-----------|-------------|----------------|
| **Swap Fees** | Successful swap | Both owners | €10/owner | 100+ swaps/month |
| **Extra Nights** | Night booking | Hotel (revenue), App (commission) | 5-10% per night | 50+ nights/month |
| **Hotel Services** | Service booking | Hotel/Partner/App | 10-15% or €X/booking | 100+ bookings/month |
| **Guest Extensions** | Stay extension | Hotel (revenue), App (commission) | 5-10% per night | Future growth |
| **Paid Services** | Partner services | Partner/App | Commission or margin | TBD |

---

### Pricing Philosophy

**Keep it simple:**
- Fixed swap fee (€10) - no negotiations, no tiers
- Percentage commissions (5-10%) - transparent, scalable
- "Owner rate" discounts - incentivize bookings but don't cut into hotel revenue

**No subscription:**
- No monthly fees for owners
- No tiered access levels
- No premium features (everything is free)

**Transparent pricing:**
- Show fees upfront before payment
- Clear breakdown: "€10 swap fee will be charged if swap is completed"
- Show commission structure to hotels in partnership agreements

---

### Financial Model (Year 1 Targets)

**Conservative Scenario** (Months 1-12):

| Month | Swaps | Swap Revenue | Extra Nights | Night Commission | Services | Total |
|-------|-------|--------------|--------------|------------------|----------|--------|
| Month 3 | 25 | €500 | 15 | €150 | €100 | **€750** |
| Month 6 | 60 | €1,200 | 40 | €400 | €300 | **€1,900** |
| Month 12 | 150 | €3,000 | 100 | €1,000 | €800 | **€4,800/mo** |
| **Year 1 Total** | - | - | - | - | - | **€28,000** |

**Optimistic Scenario** (with marketing push):

| Month | Swaps | Swap Revenue | Extra Nights | Night Commission | Services | Total |
|-------|-------|--------------|--------------|------------------|----------|--------|
| Month 3 | 100 | €2,000 | 60 | €600 | €400 | **€3,000** |
| Month 6 | 300 | €6,000 | 180 | €1,800 | €1,500 | **€9,300** |
| Month 12 | 600 | €12,000 | 400 | €4,000 | €3,200 | **€19,200/mo** |
| **Year 1 Total** | - | - | - | - | - | **€92,000** |

---

### Monetization Rollout Phases

**Phase 1 (MVP - Now):** Swap fees only
- Free app access
- €10 swap fee when swap completes
- Stripe pre-auth/capture setup
- Goal: Validate swap feature & establish revenue

**Phase 2 (Weeks 6-12):** Extra nights commission
- PMS integration complete
- Hotel partnerships established
- Commission negotiated (e.g., 7-10%)
- Goal: Fill empty rooms, grow hotel partnerships

**Phase 3 (Months 4+):** Hotel services & third-party integrations
- Service catalog per hotel
- Partner integrations (transfers, tours, etc.)
- Revenue share agreements finalized
- Goal: Diversify income, enhance guest experience

---

### Competitive Advantages

1. **Free for owners** - Lower barrier to entry than competitors with subscription fees
2. **Transaction-based** - Revenue scales with success, not gatekeeping
3. **Simple for hotels** - No complex integrations, commission-based only
4. **Guest-focused** - Extra nights and services improve experience vs. pure admin tools
5. **Viral potential** - Free + rewarding (successful swaps) encourages sharing

---



### ✅ Completed

**Authentication & Authorization:**
- Login/Register with role-based access
- JWT token handling
- Protected routes by role
- Profile management (owners can edit basic info)

**Owner Features:**
- Week list & display with color coding
- Week confirmation flow (UI complete)
- Swap request creation & listing
- Swap filtering by status, property, type
- Night credit display with expiry tracking
- Credit usage interface
- Calendar view of credit expiry dates
- Profile page with 4 sections (Personal, Banking, Property, Account)

**Guest Features:**
- Booking details page
- Service request form (basic)
- Access via booking link

**UI/UX:**
- Responsive design (mobile + desktop)
- Dark/light theme toggle
- Multilingual support (EN, ES, DE, FR, IT)
- Loading states & error handling
- Toast notifications
- Empty state messages

**Technical:**
- React Query caching & synchronization
- Zustand state management
- TypeScript type safety
- Error boundaries
- API client with interceptors
- Middleware for auth checks

---

### ⏳ In Progress

**Owner Features:**
- PMS integration for availability checks
- Extra nights pricing & booking
- Swap fee payment (pre-auth/capture flow)
- Swap matching algorithm
- Notification system

**Admin/Staff:**
- Service request management interface
- Booking approval workflow
- Revenue/usage reports
- Activity logs dashboard
- **Auto-create weeks on booking approval** ← Implementation complete: creates weeks with room's accommodation_type

---

### 📋 Not Started

**Owner Features:**
- Real-time swap matching notifications
- Banking details secure storage
- Property management interface

**Guest Features:**
- Secret World content integration
- Advanced service request options

**Staff/Admin:**
- Advanced analytics
- Bulk operations
- User approval workflows

---

## 8. Deployment & DevOps

### Local Development

```bash
# Frontend
cd hotels-new/frontend
npm install
npm run dev              # Starts Vite on http://localhost:5173

# Backend
cd backend
npm install
npm run dev              # Starts on http://localhost:3000
```

### Production Setup
- ⏳ Docker containerization
- ⏳ CI/CD pipeline (GitHub Actions)
- ⏳ Environment configuration
- ⏳ Database migrations deployment
- ⏳ SSL/TLS certificates

---

## 9. Success Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Week utilization rate | +40% | Confirmed weeks vs. available |
| Swap completion rate | >60% | Successful swaps vs. requests |
| Night credit usage | >70% | Credits used before expiry |
| Hotel occupancy | +25% | Rooms booked via credits |
| Revenue from swaps | €500+/month | €10 × completed swaps |
| User satisfaction | >4.2/5 | App store ratings |

---

## 10. Future Enhancements (Post-MVP)

1. **Advanced Matching** - ML-based swap recommendations
2. **Dynamic Pricing** - Variable swap fees based on demand
3. **Loyalty Program** - Points/perks for frequent users
4. **Mobile App** - Native iOS/Android versions
5. **API for Partners** - 3rd-party integrations (travel agencies, etc.)
6. **Analytics Dashboard** - Owner insights on week usage trends
7. **Multi-language Support** - Additional languages beyond MVP
8. **Social Features** - Share experiences, ratings, reviews

---

## 11. Appendix: API Endpoints Summary

### Authentication
- `POST /auth/login` - Owner/guest login
- `POST /auth/register` - New account registration
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user profile
- `PUT /auth/profile` - Update profile

### Timeshare (Weeks, Swaps, Credits)
- `GET /timeshare/weeks` - Owner's weeks list
- `POST /timeshare/weeks/{id}/confirm` - Confirm week usage
- `POST /timeshare/weeks/{id}/convert` - Convert week to night credits
- `GET /timeshare/swaps` - Owner's swap requests
- `POST /timeshare/swaps` - Create new swap request
- `POST /timeshare/swaps/{id}/authorize` - Accept swap
- `GET /timeshare/night-credits` - Owner's night credits
- `POST /timeshare/night-credits/{id}/use` - Use credits for booking

### Bookings
- `GET /bookings` - User's bookings
- `GET /bookings/{id}` - Booking details
- `POST /bookings` - Create booking
- `PUT /bookings/{id}` - Modify booking

### Services
- `GET /services` - Available services
- `POST /services/requests` - Request a service
- `GET /services/requests` - User's service requests

---

**Document Version:** 1.0  
**Last Updated:** December 19, 2025  
**Next Review:** After Phase 1 (PMS integration complete)
