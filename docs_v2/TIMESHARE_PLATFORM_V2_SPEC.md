# Timeshare Exchange Platform - V2 Specification

**Date:** 2026-02-01  
**Status:** Planning Phase  
**Approach:** Spec-Driven Development  
**Principles:** SOLID, KISS, DRY

---

## Executive Summary

### What We're Building

A **timeshare exchange platform** that creates liquidity in an illiquid market by allowing owners to:
1. Exchange weeks with other owners (P2P swaps)
2. Convert unused weeks to credits and use them anywhere
3. Rent out weeks to non-owners
4. Book from a unified marketplace (timeshare + hotel inventory)

### Business Model

**Primary Revenue:** Monetizing prepaid timeshare inventory (100% margin)
- Weeks already paid via condominium fees
- Platform facilitates reallocation
- Credits create pricing flexibility (decay, upgrades, commissions)

**Secondary Revenue:** Standard hotel inventory (30% commission)
- Fallback when timeshare inventory insufficient
- Traditional OTA model

**Key Insight:** We're not an OTA that competes with Booking.com. We're an RCI/Interval competitor with hotel inventory as a fallback.

### Related Documentation

**⚠️ IMPORTANT:** This technical specification must be read in conjunction with companion documents:

### 📄 **[USER_EXPERIENCE_DESIGN.md](USER_EXPERIENCE_DESIGN.md)**
Defines user experience principles, workflows, and minimum input requirements.

**Critical constraints:**
- **Minimum Friction Principle:** Each user action requires minimal input
- **Maximum Automation:** System pre-fills, auto-detects, and suggests whenever possible
- **User Flows:** Detailed journeys showing how each feature should work from user perspective
- **Input Requirements:** What data is required vs auto-filled for each operation

**Implementation Rule:** All features in this spec must be implemented according to the UX guidelines. Technical feasibility should not compromise user experience - if a feature cannot meet UX standards, it should be redesigned, not simplified.

### 🗄️ **[DATABASE_DESIGN.md](DATABASE_DESIGN.md)**
Comprehensive database schema design optimized for performance and scalability.

**Key aspects:**
- **Complete Schemas:** All 8 core tables with indexes, constraints, and foreign keys
- **Query Optimization:** Critical paths (search < 500ms, transactions < 50ms)
- **Partitioning Strategy:** Tables partitioned by year/month for 100K+ ownerships
- **Caching Layer:** Redis + MySQL query cache strategies
- **Hot Tables:** `week_allocations` optimized for search queries (6+ indexes)

**Implementation Rule:** All data access must follow the indexing strategy and query patterns defined in the database design. Performance targets (search < 2s, booking < 5s) are mandatory requirements, not aspirational goals.

---

## Domain Model

### Core Entities

#### 1. **Timeshare Property**
```
A property that has sold timeshare units/weeks
- Has physical rooms that rotate among owners
- Integrates with PMS for operational bookings
- NOT owned by platform, owned by condominium/resort
```

**Attributes:**
- Property info (name, location, amenities)
- PMS integration details (provider, credentials)
- Timeshare program type (fixed week, floating, points)
- Condominium fee structure

#### 2. **Timeshare Unit**
```
A category of timeshare (not physical room)
Represents the type of ownership sold
```

**Attributes:**
- Property FK
- Unit category (Studio, 1BR, 2BR, Penthouse)
- Capacity (max guests)
- Quantity (how many physical rooms in this category)
- Amenities specific to category

**Example:**
- Property: "Beach Resort Marbella"
- Unit: "2-Bedroom Oceanview"
- Quantity: 10 physical rooms rotate
- 52 weeks × 10 units = 520 week-slots per year

#### 3. **Ownership**
```
Who owns which weeks
Represents the timeshare purchase/contract
```

**Attributes:**
- Owner (User FK)
- Timeshare Unit FK
- Ownership type:
  - FIXED_WEEK (owns week 25 every year)
  - FLOATING (52 points, can book any week)
  - POINTS_BASED (RCI-style points)
- Contract details (purchase date, annual fee)
- Status (ACTIVE, SUSPENDED, SOLD)

#### 4. **Week Allocation**
```
Specific week assignments for current year
Generated annually from ownerships
```

**Attributes:**
- Ownership FK
- Year
- Week number (1-52) OR specific dates
- Status:
  - ASSIGNED (owner has it, not using yet)
  - RESERVED (owner made PMS booking)
  - RELEASED (converted to credits)
  - BOOKED (someone else booked it)
  - USED (checked out)
  - EXPIRED (past, not used)

**State Machine:**
```
ASSIGNED → RESERVED (owner books for self)
         ↓
         RELEASED (owner converts to credits)
         ↓
         BOOKED (another user books it)
         ↓
         USED (checkout complete)
         
ASSIGNED → EXPIRED (week passed, unused)
```

#### 5. **Credit Account**
```
Owner's credit balance (timeshare currency)
```

**Attributes:**
- Owner FK
- Balance (current credits)
- Transactions (ledger)

**Transaction Types:**
- WEEK_RELEASE (+credits)
- WEEK_BOOKING (-credits)
- CONDOMINIUM_PAYMENT (-credits)
- UPGRADE_FEE (-credits)
- EXPIRATION (-credits)
- LATE_RELEASE_PENALTY (reduced credits)

#### 6. **Booking**
```
Actual reservation (timeshare or hotel)
```

**Attributes:**
- Guest (User FK)
- Property FK
- Room category
- Check-in, check-out
- Guests count
- Source:
  - TIMESHARE (from released week)
  - HOTEL_PMS (standard hotel)
- Payment:
  - Credits used
  - Cash paid
  - Currency
- Status (PENDING, CONFIRMED, CANCELLED, COMPLETED)
- PMS booking reference

**Key:** One Booking = One PMS Reservation (1:1 mapping at reservation time)

#### 7. **Hotel Inventory** (Secondary)
```
Standard hotel rooms (not timeshare)
For when timeshare inventory insufficient
```

**Attributes:**
- Property FK
- Available rooms (via PMS API)
- Rate (what we pay hotel)
- Markup (our commission)

#### 8. **User Roles**
```
Different types of users with specific permissions
```

**Role Types:**

**OWNER:**
- Has timeshare ownerships
- Can release weeks to get credits
- Can book using credits (no card required)
- Can list weeks for rent
- Has credit account

**GUEST:**
- No timeshare ownerships
- Can only book via marketplace
- **MUST pay with card** (no credit system for guests)
- Can view their booking history
- Can manage their profile/settings
- Cannot release weeks or earn credits

**ADMIN:**
- Platform management
- Property/ownership management
- Reports and analytics

**Attributes (users table):**
- User FK
- Role (OWNER | GUEST | ADMIN)
- Email, name, phone
- Preferences (language, currency, notifications)
- Created/updated timestamps

---

## User Stories

### Owner Personas

#### Persona 1: Active Owner
"I own week 25 in Marbella. I want to go to Lisbon instead."

**User Stories:**
1. As an owner, I can view my allocated weeks for the year
2. As an owner, I can convert my week to credits
3. As an owner, I can search available weeks at other properties
4. As an owner, I can book using credits
5. As an owner, I can see credit decay warnings (late release = fewer credits)

#### Persona 2: Renting Owner
"I can't travel this year. I want to rent out my week for cash."

**User Stories:**
1. As an owner, I can list my week for rent (set price)
2. As an owner, I receive payment when non-owner books
3. Platform takes commission

#### Persona 3: Guest (Non-owner)
"I don't own a timeshare. I just want to book vacations on the marketplace."

**User Stories:**
1. As a guest, I can register/login with email + password
2. As a guest, I can search the unified marketplace (timeshare + hotel inventory)
3. As a guest, I can book available rooms **paying with credit/debit card**
4. As a guest, I can view my booking history (upcoming + past)
5. As a guest, I can view booking details (confirmation, check-in/out dates, property info)
6. As a guest, I can cancel my bookings (subject to cancellation policy)
7. As a guest, I can update my profile (name, email, phone, password)
8. As a guest, I can manage my preferences (language, currency, notifications)
9. As a guest, I can save payment methods for faster checkout
10. As a guest, I **CANNOT** see or use credits (no credit system for guests)

**Key Differences from Owner:**
- ❌ No credit account
- ❌ Cannot release weeks
- ❌ Cannot earn credits
- ✅ Must pay with card for ALL bookings
- ✅ Same search experience (unified marketplace)
- ✅ Same booking flow (but payment always card)

### Admin Personas

#### Admin 1: Platform Manager
"I need to manage timeshare properties and ownerships."

**User Stories:**
1. As admin, I can add new timeshare properties
2. As admin, I can define timeshare units (categories)
3. As admin, I can import ownership data
4. As admin, I can generate year allocations
5. As admin, I can view financial reports (margins by source)

#### Admin 2: Operations
"I need to sync with PMS and handle issues."

**User Stories:**
1. As admin, I can trigger PMS sync
2. As admin, I can view booking conflicts
3. As admin, I can manually assign physical rooms
4. As admin, I can handle cancellations

---

## Functional Requirements

### FR1: Ownership Management

**FR1.1** System shall import timeshare ownership contracts  
**FR1.2** System shall generate week allocations annually  
**FR1.3** System shall support fixed-week and floating models  
**FR1.4** System shall track ownership status changes  

### FR2: Week Release (Core Feature)

**FR2.1** Owner can release allocated week  
**FR2.2** System calculates credits based on:
- Week value (seasonality)
- Release timing (early = full credits, late = decay)
- Unit type (2BR > Studio)

**FR2.3** System updates week status: ASSIGNED → RELEASED  
**FR2.4** System cancels owner's PMS booking (if exists)  
**FR2.5** System credits owner account  
**FR2.6** Released week enters public inventory  

**Credit Calculation Formula:**
```javascript
baseValue = unit.baseValue * seasonalityFactor;
daysInAdvance = (weekStart - releaseDate) / days;

if (daysInAdvance > 180) {
  creditValue = baseValue; // 100%
} else if (daysInAdvance > 90) {
  creditValue = baseValue * 0.9; // 90%
} else if (daysInAdvance > 30) {
  creditValue = baseValue * 0.7; // 70%
} else {
  creditValue = baseValue * 0.5; // 50%
}
```

### FR3: Unified Search

**FR3.1** User searches by: location, dates, guests  
**FR3.2** System queries:
1. Released timeshare weeks (RELEASED status)
2. Hotel PMS availability (via API)

**FR3.3** System returns unified results with:
- Property name, location
- Room category (NOT room number)
- Price in credits
- Price in cash
- Availability count

**FR3.4** System prioritizes internally:
- Priority 1: Timeshare (100% margin)
- Priority 2: Hotel (30% margin)

**FR3.5** User sees NO visual distinction (unified experience)

### FR4: Booking Creation

**FR4.1** User selects result, enters guest details  
**FR4.2** System determines source (timeshare vs hotel)  

**If timeshare:**
- FR4.2.1 Update week_allocation: RELEASED → BOOKED
- FR4.2.2 Deduct credits from user account
- FR4.2.3 Assign physical room dynamically
- FR4.2.4 Create PMS booking (new, not transfer)
- FR4.2.5 Platform margin = 100% (no hotel payment)

**If hotel:**
- FR4.2.6 Reserve room via PMS API
- FR4.2.7 Deduct credits + cash from user
- FR4.2.8 Schedule payment to hotel
- FR4.2.9 Platform margin = commission %

**FR4.3** Create Booking record  
**FR4.4** Send confirmation to user  

### FR5: Credit System

**FR5.1** Credits are platform currency (1 credit ≈ €1 nominal)  
**FR5.2** Credits can be:
- Earned (week release)
- Purchased (cash → credits)
- Spent (bookings)
- Expired (time-limited)

**FR5.3** Credit transactions are immutable (ledger)  
**FR5.4** Credits tied to owner account (non-transferable, except via swap)  

### FR6: PMS Integration

**FR6.1** System supports multiple PMS providers (abstraction layer)  
**FR6.2** For each booking, system creates PMS reservation  
**FR6.3** Physical room assignment delegated to PMS  
**FR6.4** System syncs booking status (confirmed, checked-in, cancelled)  
**FR6.5** NO booking transfers in PMS (cancel old + create new)  

### FR7: Guest Management (Non-owners)

**FR7.1** Guest Registration & Authentication
- FR7.1.1 Guest can register with email/password
- FR7.1.2 System validates email uniqueness
- FR7.1.3 System sends verification email
- FR7.1.4 Guest can login with credentials
- FR7.1.5 System issues JWT token with role=GUEST

**FR7.2** Guest Profile Management
- FR7.2.1 Guest can view/update profile (name, email, phone)
- FR7.2.2 Guest can change password
- FR7.2.3 Guest can update preferences (language, currency, notifications)
- FR7.2.4 Guest can manage saved payment methods
- FR7.2.5 System encrypts sensitive data

**FR7.3** Guest Booking Flow
- FR7.3.1 Guest searches marketplace (same as owner)
- FR7.3.2 Guest sees pricing in EUR/USD (NO credits displayed)
- FR7.3.3 Guest must pay 100% with credit/debit card
- FR7.3.4 System processes payment via Stripe/payment gateway
- FR7.3.5 System creates booking record with source=GUEST_BOOKING
- FR7.3.6 System sends confirmation email

**FR7.4** Guest Booking History
- FR7.4.1 Guest can view list of all bookings (upcoming + past)
- FR7.4.2 Guest can view booking details (property, dates, guests, total paid)
- FR7.4.3 Guest can download booking confirmation PDF
- FR7.4.4 Guest can cancel booking (if within cancellation window)
- FR7.4.5 System processes refund based on cancellation policy

**FR7.5** Guest Restrictions
- FR7.5.1 Guest CANNOT see credit system (no credit balance, no credit prices)
- FR7.5.2 Guest CANNOT release weeks (no ownerships)
- FR7.5.3 Guest CANNOT convert weeks to credits
- FR7.5.4 Guest CANNOT see "My Weeks" section

---

## Non-Functional Requirements

### NFR1: Performance
- Search response: < 2 seconds
- Booking creation: < 5 seconds
- Credit calculation: < 100ms

### NFR2: Scalability
- Support 100K+ ownerships
- Handle 10K concurrent searches
- Process 1K bookings/hour

### NFR3: Reliability
- 99.9% uptime
- PMS failures don't break platform
- Idempotent booking creation

### NFR4: Security
- Owner data encrypted
- Payment PCI compliant
- Role-based access control

### NFR5: Auditability
- All credit transactions logged
- All status changes tracked
- PMS sync logs retained

---

## System Architecture (SOLID Principles)

### Layered Architecture

```
┌─────────────────────────────────────┐
│   Presentation Layer (Frontend)     │
│   - React SPA                        │
│   - Unified Search UI                │
│   - Owner Dashboard                  │
└─────────────────────────────────────┘
             ↕ HTTP/REST
┌─────────────────────────────────────┐
│   API Layer (Controllers)            │
│   - OwnershipController              │
│   - SearchController                 │
│   - BookingController                │
│   - CreditController                 │
└─────────────────────────────────────┘
             ↕
┌─────────────────────────────────────┐
│   Business Logic Layer (Services)    │
│   - OwnershipService                 │
│   - WeekReleaseService               │
│   - UnifiedSearchService             │
│   - BookingService                   │
│   - CreditService                    │
│   - PMSOrchestrator                  │
└─────────────────────────────────────┘
             ↕
┌─────────────────────────────────────┐
│   Data Access Layer (Repositories)   │
│   - OwnershipRepository              │
│   - WeekAllocationRepository         │
│   - BookingRepository                │
│   - CreditRepository                 │
└─────────────────────────────────────┘
             ↕
┌─────────────────────────────────────┐
│   Infrastructure Layer               │
│   - Database (MySQL/MariaDB)         │
│   - PMS Adapters (Mews, Cloudbeds)   │
│   - Payment Gateway                  │
│   - Notification Service             │
└─────────────────────────────────────┘
```

### SOLID Principles Applied

#### S - Single Responsibility Principle

**Each service has ONE reason to change:**

- `WeekReleaseService`: Handles ONLY week release logic
- `CreditService`: Handles ONLY credit transactions
- `BookingService`: Handles ONLY booking creation
- `PMSOrchestrator`: Handles ONLY PMS communication

**Anti-pattern (current):**
```typescript
// ❌ PrepaidInventoryService does too much
class PrepaidInventoryService {
  create() { /* CRUD */ }
  search() { /* Search logic */ }
  syncPMS() { /* PMS logic */ }
  calculateMargin() { /* Business logic */ }
}
```

**Correct (V2):**
```typescript
// ✅ Each service focused
class OwnershipService {
  create(ownership) { /* CRUD only */ }
  findByOwner(ownerId) { /* Query only */ }
}

class WeekReleaseService {
  releaseWeek(allocationId, ownerId) {
    // 1. Validate ownership
    // 2. Calculate credits
    // 3. Update allocation status
    // 4. Credit account
    // 5. Cancel PMS booking
  }
}

class PMSOrchestrator {
  cancelBooking(pmsProvider, bookingId) { /* PMS only */ }
  createBooking(pmsProvider, details) { /* PMS only */ }
}
```

#### O - Open/Closed Principle

**PMS Providers:**

```typescript
// Abstract interface (closed for modification)
interface PMSAdapter {
  createBooking(details: BookingDetails): Promise<PMSBooking>;
  cancelBooking(bookingId: string): Promise<void>;
  getAvailability(filters: SearchFilters): Promise<Room[]>;
}

// Open for extension (new providers)
class MewsAdapter implements PMSAdapter { /* ... */ }
class CloudbedsAdapter implements PMSAdapter { /* ... */ }
class OperaAdapter implements PMSAdapter { /* ... */ }

// PMSFactory selects adapter
class PMSFactory {
  static create(provider: string): PMSAdapter {
    switch(provider) {
      case 'mews': return new MewsAdapter();
      case 'cloudbeds': return new CloudbedsAdapter();
      default: throw new Error('Unsupported PMS');
    }
  }
}
```

**Credit Calculation:**

```typescript
// Strategy pattern for credit calculation
interface CreditCalculationStrategy {
  calculate(week: WeekAllocation, releaseDate: Date): number;
}

class SeasonalCreditStrategy implements CreditCalculationStrategy {
  calculate(week, releaseDate) {
    const baseValue = this.getBaseValue(week);
    const seasonFactor = this.getSeasonFactor(week.weekNumber);
    const timingFactor = this.getTimingFactor(week.startDate, releaseDate);
    return baseValue * seasonFactor * timingFactor;
  }
}

class FixedCreditStrategy implements CreditCalculationStrategy {
  calculate(week, releaseDate) {
    return week.unit.creditValue; // Fixed, no decay
  }
}
```

#### L - Liskov Substitution Principle

**Booking types interchangeable:**

```typescript
abstract class Booking {
  abstract createPMSReservation(): Promise<void>;
  abstract calculateCost(): Cost;
}

class TimeshareBooking extends Booking {
  createPMSReservation() {
    // Assign physical room dynamically
    // Create new PMS booking
  }
  
  calculateCost() {
    return {
      credits: this.creditPrice,
      cash: 0,
      platformCost: 0 // Prepaid
    };
  }
}

class HotelBooking extends Booking {
  createPMSReservation() {
    // Reserve room via PMS API
  }
  
  calculateCost() {
    return {
      credits: this.creditPrice,
      cash: this.cashPrice,
      platformCost: this.hotelRate // Pay hotel
    };
  }
}

// Usage: doesn't care which subclass
function confirmBooking(booking: Booking) {
  const cost = booking.calculateCost();
  await booking.createPMSReservation();
  // Works for both types
}
```

#### I - Interface Segregation Principle

**Don't force services to implement unused methods:**

```typescript
// ❌ Fat interface
interface InventoryService {
  search();
  create();
  update();
  delete();
  syncPMS();
  calculateMargin();
  generateReport();
}

// ✅ Segregated interfaces
interface Searchable {
  search(filters: SearchFilters): Promise<SearchResult[]>;
}

interface CRUDService<T> {
  create(entity: T): Promise<T>;
  update(id: number, entity: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
}

interface PMSSyncable {
  syncWithPMS(): Promise<SyncResult>;
}

interface Reportable {
  generateReport(params: ReportParams): Promise<Report>;
}

// Services implement only what they need
class UnifiedSearchService implements Searchable {
  search(filters) { /* ... */ }
}

class OwnershipService implements CRUDService<Ownership> {
  create(ownership) { /* ... */ }
  update(id, ownership) { /* ... */ }
  delete(id) { /* ... */ }
}
```

#### D - Dependency Inversion Principle

**Depend on abstractions, not concretions:**

```typescript
// ❌ Direct dependency
class BookingService {
  private mewsAPI = new MewsAPI(); // Concrete
  
  async createBooking(details) {
    await this.mewsAPI.createBooking(details); // Coupled to Mews
  }
}

// ✅ Dependency injection
class BookingService {
  constructor(
    private pmsAdapter: PMSAdapter, // Abstract
    private creditService: CreditService, // Abstract
    private bookingRepository: BookingRepository // Abstract
  ) {}
  
  async createBooking(details) {
    // Works with any PMS
    await this.pmsAdapter.createBooking(details);
  }
}

// Injected at runtime
const bookingService = new BookingService(
  PMSFactory.create('mews'),
  new CreditService(),
  new BookingRepository()
);
```

---

## Database Schema (V2)

### Core Tables

#### `timeshare_properties`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database (`npm run document:schema`)

```sql
CREATE TABLE timeshare_properties (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  
  -- Location
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  address TEXT,
  postal_code VARCHAR(20),
  
  -- PMS Integration
  pms_provider ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other') NOT NULL,
  pms_property_id VARCHAR(255),
  pms_credentials_encrypted BLOB, -- ⚠️ ENCRYPTED, not JSON
  pms_last_sync DATETIME,
  pms_sync_status ENUM('OK', 'ERROR', 'DISABLED') DEFAULT 'OK',
  
  -- Program Configuration
  program_type ENUM('FIXED_WEEK', 'FLOATING', 'POINTS') NOT NULL,
  weeks_per_year TINYINT(3) UNSIGNED DEFAULT 52,
  check_in_day ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') DEFAULT 'SATURDAY',
  
  -- Content
  description TEXT,
  amenities LONGTEXT, -- JSON
  policies LONGTEXT, -- JSON
  images LONGTEXT, -- JSON
  
  -- Status
  is_active TINYINT(1) DEFAULT 1,
  is_marketplace_enabled TINYINT(1) DEFAULT 1,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_slug (slug),
  INDEX idx_active (is_active),
  INDEX idx_city_country (city, country),
  INDEX idx_pms_provider (pms_provider)
);
```

#### `timeshare_units`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database

```sql
CREATE TABLE timeshare_units (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id INT(10) UNSIGNED NOT NULL,
  
  -- Unit Identification
  category VARCHAR(100) NOT NULL, -- "Studio", "1BR", "2BR Oceanview"
  slug VARCHAR(150) NOT NULL,
  
  -- Capacity (⚠️ Note: capacity_min and capacity_max, NOT single capacity)
  capacity_min TINYINT(3) UNSIGNED DEFAULT 1,
  capacity_max TINYINT(3) UNSIGNED NOT NULL,
  
  -- Physical Details
  bedrooms TINYINT(3) UNSIGNED DEFAULT 0,
  bathrooms DECIMAL(2,1) DEFAULT 1.0,
  size_sqm SMALLINT(5) UNSIGNED,
  floor_range VARCHAR(50), -- "1-3", "4-8"
  view_type ENUM('OCEAN','POOL','GARDEN','CITY','MOUNTAIN','NO_VIEW') DEFAULT 'NO_VIEW',
  
  -- Inventory
  quantity SMALLINT(5) UNSIGNED NOT NULL, -- How many physical rooms
  
  -- Pricing/Credits
  base_credit_value DECIMAL(10, 2) NOT NULL,
  seasonal_factors LONGTEXT, -- JSON: week-by-week multipliers
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Content
  description TEXT,
  amenities LONGTEXT, -- JSON
  images LONGTEXT, -- JSON
  
  -- Status
  is_active TINYINT(1) DEFAULT 1,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY unique_property_slug (property_id, slug),
  INDEX idx_property_category (property_id, category),
  INDEX idx_active (is_active)
);
```

#### `ownerships`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database

```sql
CREATE TABLE ownerships (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  owner_id INT(10) UNSIGNED NOT NULL, -- FK to users
  unit_id INT(10) UNSIGNED NOT NULL, -- FK to timeshare_units
  
  -- Ownership Type
  type ENUM('FIXED_WEEK', 'FLOATING', 'POINTS') NOT NULL,
  
  -- Fixed Week Specific
  fixed_week_number TINYINT(3) UNSIGNED, -- NULL if floating/points
  
  -- Floating/Points Specific
  annual_points SMALLINT(5) UNSIGNED, -- NULL if fixed week
  
  -- Contract Details
  purchase_date DATE,
  contract_reference VARCHAR(255),
  contract_start_year INT(10) UNSIGNED NOT NULL,
  contract_end_year INT(10) UNSIGNED,
  
  -- Fees
  annual_fee DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  annual_fee_due_date DATE,
  last_payment_date DATE,
  
  -- Status
  status ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_PAYMENT') DEFAULT 'ACTIVE',
  suspension_reason TEXT,
  
  -- Additional
  notes TEXT,
  metadata LONGTEXT, -- JSON
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES timeshare_units(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_owner (owner_id),
  INDEX idx_unit (unit_id),
  INDEX idx_status (status),
  INDEX idx_type (type)
);
```

#### `week_allocations`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database
> 🔥 **CRITICAL CONSTRAINTS** - See Phase 1 learnings below

```sql
CREATE TABLE week_allocations (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ownership_id INT(10) UNSIGNED NOT NULL,
  
  -- Which Week
  year INT(10) UNSIGNED NOT NULL,
  week_number TINYINT(3) UNSIGNED, -- 1-52 (NULL allowed for flexible dates)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status Lifecycle
  status ENUM(
    'ASSIGNED',   -- Owner has it (initial state)
    'RESERVED',   -- Owner booked for themselves
    'RELEASED',   -- Converted to credits (available in marketplace)
    'BOOKED',     -- Someone else booked it
    'USED',       -- Checked out
    'EXPIRED'     -- Past date, unused
  ) DEFAULT 'ASSIGNED',
  
  -- Release Details (when status = RELEASED)
  released_at DATETIME NULL,
  credits_issued DECIMAL(10, 2) NULL,
  release_credit_calc LONGTEXT, -- ⚠️ JSON object with calculation breakdown
  
  -- Booking Details (when status = BOOKED)
  booking_id INT(10) UNSIGNED NULL, -- FK to v2_bookings
  booked_by INT(10) UNSIGNED NULL, -- FK to users
  booked_at DATETIME NULL,
  
  -- PMS Tracking
  pms_booking_id VARCHAR(255) NULL,
  pms_booking_status VARCHAR(50) NULL, -- ⚠️ NOT pms_confirmation_code
  physical_room_assigned VARCHAR(100) NULL,
  pms_last_sync DATETIME NULL, -- ⚠️ NOT notes
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys (⚠️ CRITICAL: ownership_id has NO DELETE CASCADE, only UPDATE CASCADE)
  FOREIGN KEY (ownership_id) REFERENCES ownerships(id) ON UPDATE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES v2_bookings(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Indexes (performance-critical for search)
  INDEX idx_ownership_year (ownership_id, year),
  INDEX idx_search_released (status, start_date, end_date),
  INDEX idx_booking (booking_id),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_expired (status, end_date),
  INDEX idx_unified_search (status, start_date, end_date, ownership_id),
  
  -- ⚠️ CRITICAL CONSTRAINT: Max 52 weeks per ownership/year
  UNIQUE KEY unique_ownership_year_week (ownership_id, year, week_number)
);
```

**🔥 Phase 1 Critical Learnings:**

1. **UNIQUE Constraint:** `(ownership_id, year, week_number)` allows max 52 weeks per ownership/year
   - When creating test data, calculate `week_number` dynamically from `start_date`
   - Or use `week_number: NULL` to bypass constraint
   - See: `tests/fixtures/v2-fixtures.ts` → `createTestWeekAllocation()`

2. **FK Behavior:** `ownership_id` has **NO DELETE CASCADE** (only UPDATE CASCADE)
   - Deleting ownership with weeks will **FAIL** with FK constraint error
   - This is intentional to prevent orphaned weeks
   - See: Test "should prevent deleting ownership with week allocations"

3. **Field Names (Common Errors):**
   - ✅ `release_credit_calc` (JSON object) - NOT `release_reason`
   - ✅ `pms_booking_status` (string) - NOT `pms_confirmation_code`
   - ✅ `pms_last_sync` (datetime) - NOT `notes`

4. **Status Transitions:**
   - ASSIGNED → RESERVED (owner books for self)
   - ASSIGNED → RELEASED (convert to credits)
   - RELEASED → BOOKED (someone books it)
   - BOOKED → USED (check-out complete)
   - Any → EXPIRED (past date)

5. **Performance:** Indexes support < 100ms queries for 1000+ weeks
   - See: Performance test in `weekAllocationRepository.test.ts`

#### `credit_accounts`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database

```sql
CREATE TABLE credit_accounts (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT(10) UNSIGNED NOT NULL,
  
  -- Balance
  balance DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'EUR',
  credit_limit DECIMAL(10, 2), -- Optional credit line
  
  -- Policies
  expiration_policy ENUM('NEVER', '1_YEAR', '2_YEARS') DEFAULT '2_YEARS',
  
  -- Tracking
  notes TEXT,
  last_transaction_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_balance (balance)
);
```

#### `credit_transactions`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database
> 📝 **IMMUTABLE LEDGER** - Never update/delete, only insert

```sql
CREATE TABLE credit_transactions (
  id BIGINT(20) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id INT(10) UNSIGNED NOT NULL,
  
  -- Transaction Details
  type ENUM(
    'WEEK_RELEASE',        -- Owner releases week → earn credits
    'WEEK_BOOKING',        -- Booking with credits → spend credits
    'CREDIT_PURCHASE',     -- Buy credits with cash
    'CREDIT_EXPIRATION',   -- Credits expire
    'CONDOMINIUM_PAYMENT', -- Annual fee payment with credits
    'REFUND',             -- Booking cancellation refund
    'ADJUSTMENT',         -- Manual adjustment by admin
    'BONUS',              -- Promotional bonus
    'PENALTY'             -- Fee or penalty
  ) NOT NULL,
  
  -- Amounts (⚠️ balance_before and balance_after for audit trail)
  amount DECIMAL(10, 2) NOT NULL, -- Positive = credit, Negative = debit
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  
  -- References (polymorphic)
  reference_type VARCHAR(50), -- 'week_allocation', 'booking', 'ownership'
  reference_id INT(10) UNSIGNED,
  
  -- Description & Metadata
  description VARCHAR(500) NOT NULL,
  metadata LONGTEXT, -- JSON: calculation details, source info
  
  -- Audit Trail
  created_by INT(10) UNSIGNED, -- User who initiated (for ADJUSTMENT, BONUS, PENALTY)
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_account_created (account_id, created_at),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_type (type)
);
```

**💡 Best Practices:**
- Transactions are **immutable** - never UPDATE or DELETE
- Always set `balance_before` and `balance_after` for audit trail
- Use `metadata` JSON for calculation breakdowns (e.g., credit calc formula)
- Use `reference_type` + `reference_id` to link to source entity

#### `v2_bookings`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database
> ℹ️ **NOTE:** Table name is `v2_bookings` (not `bookings`) to avoid conflicts with V1

```sql
CREATE TABLE v2_bookings (
  id INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  confirmation_code VARCHAR(20) NOT NULL, -- Unique booking reference
  
  -- Guest Information
  guest_id INT(10) UNSIGNED NOT NULL, -- FK to users
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  
  -- Property & Dates
  property_id INT(10) UNSIGNED NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights TINYINT(3) UNSIGNED NOT NULL,
  guests TINYINT(3) UNSIGNED NOT NULL,
  
  -- Room Details
  room_category VARCHAR(100) NOT NULL,
  physical_room VARCHAR(100), -- Assigned dynamically by PMS
  
  -- Source Type
  source ENUM('TIMESHARE', 'HOTEL_PMS') NOT NULL,
  week_allocation_id INT(10) UNSIGNED NULL, -- NULL if source = HOTEL_PMS
  
  -- Payment
  credits_used DECIMAL(10, 2) DEFAULT 0.00,
  cash_paid DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_status ENUM('PENDING', 'COMPLETED', 'REFUNDED') DEFAULT 'PENDING',
  
  -- Platform Economics
  platform_cost DECIMAL(10, 2) DEFAULT 0.00, -- What we pay hotel (0 for timeshare)
  platform_revenue DECIMAL(10, 2) NOT NULL, -- What we earn
  margin_percent DECIMAL(5, 2) NOT NULL,
  
  -- Booking Status
  status ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW') DEFAULT 'PENDING',
  confirmed_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  
  -- PMS Integration
  pms_booking_id VARCHAR(255),
  pms_provider VARCHAR(50),
  pms_status VARCHAR(50),
  pms_last_sync DATETIME,
  
  -- Additional
  special_requests TEXT,
  internal_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (week_allocation_id) REFERENCES week_allocations(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  UNIQUE KEY unique_confirmation_code (confirmation_code),
  INDEX idx_guest (guest_id),
  INDEX idx_property_dates (property_id, check_in, check_out),
  INDEX idx_status (status),
  INDEX idx_source (source),
  INDEX idx_check_in (check_in),
  INDEX idx_pms_booking (pms_booking_id)
);
```

### Supporting Tables

#### `hotel_inventory`

> ⚠️ **REAL SCHEMA** - Source: Auto-generated from database
> 📊 **PURPOSE:** Cache for PMS availability to speed up unified search

```sql
CREATE TABLE hotel_inventory (
  id BIGINT(20) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id INT(10) UNSIGNED NOT NULL,
  
  -- Date & Category
  date DATE NOT NULL,
  room_category VARCHAR(100) NOT NULL,
  
  -- Availability
  total_rooms SMALLINT(5) UNSIGNED NOT NULL,
  available_rooms SMALLINT(5) UNSIGNED NOT NULL,
  
  -- Pricing
  rate DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Sync Tracking
  source VARCHAR(50), -- 'mews', 'cloudbeds', etc.
  last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_stale TINYINT(1) DEFAULT 0, -- Flag for outdated data
  
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY unique_property_date_category (property_id, date, room_category),
  INDEX idx_date_available (date, available_rooms),
  INDEX idx_stale (is_stale)
);
```

**💡 Usage Pattern:**
- Background job syncs PMS availability every 15-30 minutes
- Search queries read from cache (fast)
- If data is stale (> 1 hour), mark `is_stale = 1` and refresh

---

## API Specification (RESTful)

### Authentication
All endpoints require JWT token except public search.

### Endpoints

#### Ownership Management

**POST /api/admin/ownerships**
```json
Request:
{
  "ownerId": 123,
  "unitId": 45,
  "type": "FIXED_WEEK",
  "fixedWeekNumber": 25,
  "annualFee": 800,
  "currency": "EUR"
}

Response:
{
  "success": true,
  "data": {
    "id": 789,
    "owner": { "id": 123, "name": "John Doe" },
    "unit": { "category": "2BR Oceanview", "property": "Beach Resort" },
    "type": "FIXED_WEEK",
    "weekNumber": 25,
    "status": "ACTIVE"
  }
}
```

**GET /api/owner/my-weeks?year=2026**
```json
Response:
{
  "success": true,
  "data": [
    {
      "allocationId": 1001,
      "ownership": { "id": 789, "unit": "2BR Oceanview" },
      "property": { "id": 1, "name": "Beach Resort Marbella" },
      "weekNumber": 25,
      "startDate": "2026-06-15",
      "endDate": "2026-06-22",
      "status": "ASSIGNED",
      "actions": ["reserve", "release", "rent"]
    }
  ]
}
```

#### Week Release

**POST /api/owner/release-week**
```json
Request:
{
  "allocationId": 1001,
  "confirmDecay": true
}

Response:
{
  "success": true,
  "data": {
    "allocationId": 1001,
    "previousStatus": "ASSIGNED",
    "newStatus": "RELEASED",
    "credits": {
      "baseValue": 1000,
      "seasonalMultiplier": 1.2,
      "timingMultiplier": 0.9,
      "finalCredits": 1080,
      "creditsIssued": 1080
    },
    "newBalance": 1580,
    "pmsBookingCancelled": true
  }
}
```

#### Unified Search

**POST /api/search**
```json
Request:
{
  "location": "Marbella",
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-08",
  "guests": 4,
  "includeHotels": true
}

Response:
{
  "success": true,
  "data": [
    {
      "id": "ts_1001", 
      "source": "TIMESHARE",
      "property": {
        "id": 1,
        "name": "Beach Resort Marbella",
        "location": "Marbella, Spain"
      },
      "unit": {
        "category": "2BR Oceanview",
        "capacity": 6,
        "amenities": ["Kitchen", "Ocean view", "Balcony"]
      },
      "dates": {
        "checkIn": "2026-07-01",
        "checkOut": "2026-07-08",
        "nights": 7
      },
      "price": {
        "credits": 1200,
        "cash": 0,
        "currency": "EUR"
      },
      "availability": {
        "available": true,
        "quantity": 2
      }
    },
    {
      "id": "hotel_502",
      "source": "HOTEL_PMS",
      "property": {
        "id": 5,
        "name": "Luxury Hotel Marbella",
        "location": "Marbella, Spain"
      },
      "unit": {
        "category": "Deluxe Suite",
        "capacity": 4
      },
      "dates": {
        "checkIn": "2026-07-01",
        "checkOut": "2026-07-08",
        "nights": 7
      },
      "price": {
        "credits": 1500,
        "cash": 1500,
        "currency": "EUR"
      },
      "availability": {
        "available": true,
        "quantity": 5
      }
    }
  ],
  "meta": {
    "totalResults": 2,
    "timeshareResults": 1,
    "hotelResults": 1
  }
}
```

#### Booking Creation

**POST /api/bookings**
```json
Request:
{
  "searchResultId": "ts_1001",
  "guestDetails": {
    "firstName": "Maria",
    "lastName": "Lopez",
    "email": "maria@example.com",
    "phone": "+34600000000"
  },
  "payment": {
    "useCredits": 1200,
    "cashAmount": 0
  }
}

Response:
{
  "success": true,
  "data": {
    "bookingId": 5001,
    "confirmationCode": "BK-2026-5001",
    "property": "Beach Resort Marbella",
    "checkIn": "2026-07-01",
    "checkOut": "2026-07-08",
    "guests": 4,
    "creditsUsed": 1200,
    "cashPaid": 0,
    "pmsBookingId": "PMS-12345"
  }
}
```

#### Guest Management

**POST /api/guest/register**
```json
Request:
{
  "email": "guest@example.com",
  "password": "SecurePass123!",
  "firstName": "Maria",
  "lastName": "Garcia",
  "phone": "+34612345678",
  "language": "es",
  "currency": "EUR"
}

Response:
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "userId": 2001,
  "verificationEmailSent": true
}
```

**POST /api/guest/login**
```json
Request:
{
  "email": "guest@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2001,
    "email": "guest@example.com",
    "firstName": "Maria",
    "lastName": "Garcia",
    "role": "GUEST",
    "preferences": {
      "language": "es",
      "currency": "EUR"
    }
  }
}
```

**GET /api/guest/profile**
```json
Response:
{
  "success": true,
  "profile": {
    "id": 2001,
    "email": "guest@example.com",
    "firstName": "Maria",
    "lastName": "Garcia",
    "phone": "+34612345678",
    "role": "GUEST",
    "preferences": {
      "language": "es",
      "currency": "EUR",
      "notifications": true
    },
    "savedPaymentMethods": [
      {
        "id": "pm_1234",
        "brand": "visa",
        "last4": "4242",
        "expiryMonth": 12,
        "expiryYear": 2028
      }
    ],
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

**PUT /api/guest/profile**
```json
Request:
{
  "firstName": "Maria",
  "lastName": "Garcia Lopez",
  "phone": "+34612345679",
  "preferences": {
    "language": "en",
    "currency": "EUR",
    "notifications": false
  }
}

Response:
{
  "success": true,
  "message": "Profile updated successfully"
}
```

**GET /api/guest/bookings**
```json
Response:
{
  "success": true,
  "bookings": {
    "upcoming": [
      {
        "id": 5001,
        "confirmationCode": "BK-2026-5001",
        "property": {
          "id": 101,
          "name": "Beach Resort Marbella",
          "location": "Marbella, Spain",
          "image": "https://..."
        },
        "checkIn": "2026-06-15",
        "checkOut": "2026-06-22",
        "nights": 7,
        "guests": 4,
        "roomCategory": "2-Bedroom Oceanview",
        "totalPaid": 1200.00,
        "currency": "EUR",
        "status": "CONFIRMED",
        "canCancel": true,
        "cancellationDeadline": "2026-06-01T00:00:00Z"
      }
    ],
    "past": [
      {
        "id": 4500,
        "confirmationCode": "BK-2025-4500",
        "property": {
          "id": 102,
          "name": "Mountain Lodge Aspen",
          "location": "Aspen, USA"
        },
        "checkIn": "2025-12-20",
        "checkOut": "2025-12-27",
        "nights": 7,
        "guests": 2,
        "roomCategory": "Studio",
        "totalPaid": 800.00,
        "currency": "USD",
        "status": "COMPLETED"
      }
    ]
  }
}
```

**GET /api/guest/bookings/:id**
```json
Response:
{
  "success": true,
  "booking": {
    "id": 5001,
    "confirmationCode": "BK-2026-5001",
    "status": "CONFIRMED",
    "property": {
      "id": 101,
      "name": "Beach Resort Marbella",
      "address": "Avenida del Mar 123, Marbella, Spain",
      "phone": "+34952123456",
      "email": "info@beachresort.com",
      "checkInTime": "15:00",
      "checkOutTime": "11:00"
    },
    "checkIn": "2026-06-15",
    "checkOut": "2026-06-22",
    "nights": 7,
    "guests": 4,
    "roomCategory": "2-Bedroom Oceanview",
    "guestDetails": {
      "firstName": "Maria",
      "lastName": "Garcia",
      "email": "guest@example.com",
      "phone": "+34612345678"
    },
    "payment": {
      "totalPaid": 1200.00,
      "currency": "EUR",
      "method": "card",
      "last4": "4242",
      "transactionId": "ch_1234567890"
    },
    "cancellation": {
      "canCancel": true,
      "deadline": "2026-06-01T00:00:00Z",
      "refundAmount": 1200.00,
      "refundPercentage": 100
    },
    "pmsBookingId": "PMS-12345",
    "createdAt": "2026-02-01T14:30:00Z"
  }
}
```

**DELETE /api/guest/bookings/:id**
```json
Request:
{
  "reason": "Change of plans"
}

Response:
{
  "success": true,
  "message": "Booking cancelled successfully",
  "refund": {
    "amount": 1200.00,
    "currency": "EUR",
    "refundMethod": "original_payment_method",
    "estimatedDays": "5-10 business days"
  }
}
```

---
    "confirmationCode": "BRM-5001-2026",
    "status": "CONFIRMED",
    "property": "Beach Resort Marbella",
    "roomCategory": "2BR Oceanview",
    "checkIn": "2026-07-01",
    "checkOut": "2026-07-08",
    "guests": 4,
    "payment": {
      "creditsUsed": 1200,
      "cashPaid": 0,
      "newCreditBalance": 380
    },
    "pms": {
      "provider": "mews",
      "bookingId": "PMS-ABC-123",
      "status": "CONFIRMED"
    }
  }
}
```

---

## Implementation Plan (Phased)

### Phase 0: Preparation (Week 1) ✅ COMPLETE
- [x] Create specification document (this doc)
- [x] Create UX/UI design document (USER_EXPERIENCE_DESIGN.md)
- [x] Create database design document (DATABASE_DESIGN.md)
- [x] Create V2 migrations (9 clean migrations in migrations_v2/)
- [x] Create reset and seed scripts
- [x] Update package.json with V2 commands
- [ ] Review with stakeholders
- [ ] Create GitHub issues for each epic
- [ ] Set up V2 feature branch

**Status:** Ready to start Phase 1 - Core Domain Model  
**See:** `docs_v2/IMPLEMENTATION_START.md` for quickstart guide

### Phase 1: Core Domain Model (Week 2-3)

**Database:**
- [ ] Migration: Create `timeshare_properties`
- [ ] Migration: Create `timeshare_units`
- [ ] Migration: Create `ownerships`
- [ ] Migration: Create `week_allocations`
- [ ] Migration: Create `credit_accounts`
- [ ] Migration: Create `credit_transactions`
- [ ] Migration: Update `bookings` table

**Models:**
- [ ] TimeshareProperty model + repository
- [ ] TimeshareUnit model + repository
- [ ] Ownership model + repository
- [ ] WeekAllocation model + repository
- [ ] CreditAccount model + repository
- [ ] CreditTransaction model + repository

**Tests:**
- [ ] Unit tests for each model
- [ ] Repository integration tests

### Phase 2: Core Services (Week 4-5)

**Services:**
- [ ] OwnershipService (CRUD)
- [ ] WeekAllocationService (generate annual allocations)
- [ ] CreditService (transactions, balance)
- [ ] CreditCalculationStrategy (base + seasonal + timing)

**Tests:**
- [ ] Unit tests with mocks
- [ ] Integration tests with test DB

### Phase 2.5: Guest Management (Week 5-6)

**Database:**
- [ ] Migration: Add `role` enum to users table (OWNER | GUEST | ADMIN)
- [ ] Migration: Add `preferences` JSON field to users table
- [ ] Migration: Update users indexes for role-based queries

**Services:**
- [ ] GuestService (registration, authentication, profile)
- [ ] GuestBookingService (guest-specific booking logic)
- [ ] AuthService (JWT with role claims)

**API:**
- [ ] POST /api/guest/register
- [ ] POST /api/guest/login
- [ ] GET /api/guest/profile
- [ ] PUT /api/guest/profile
- [ ] GET /api/guest/bookings
- [ ] GET /api/guest/bookings/:id
- [ ] DELETE /api/guest/bookings/:id (cancellation)

**Frontend:**
- [ ] Guest registration page
- [ ] Guest login page
- [ ] Guest profile/settings page
- [ ] Guest bookings history page
- [ ] Guest booking details page
- [ ] Role-based navigation (hide owner features for guests)

**Tests:**
- [ ] Unit tests for GuestService
- [ ] Integration tests for guest API endpoints
- [ ] E2E test: Guest registration → login → book → view history

### Phase 3: Week Release Feature (Week 7)

**Service:**
- [ ] WeekReleaseService
  - [ ] Validate ownership
  - [ ] Calculate credits (with decay)
  - [ ] Update week status
  - [ ] Credit account
  - [ ] Cancel PMS booking

**API:**
- [ ] POST /api/owner/release-week
- [ ] GET /api/owner/my-weeks

**Frontend:**
- [ ] Owner dashboard
- [ ] Week release modal with decay warnings
- [ ] Credit balance display

**Tests:**
- [ ] Unit tests for credit calculation
- [ ] E2E test: release week flow

### Phase 4: Unified Search (Week 7-8)

**Service:**
- [ ] UnifiedSearchService
  - [ ] Query released week_allocations
  - [ ] Query hotel_inventory (PMS cache)
  - [ ] Merge results with priority
  - [ ] Calculate prices

**API:**
- [ ] POST /api/search

**Frontend:**
- [ ] Unified search page
- [ ] Filters (location, dates, guests)
- [ ] Results grid (no source distinction)

**Tests:**
- [ ] Unit tests for search logic
- [ ] Integration tests with sample data

### Phase 5: Booking Flow (Week 9-10)

**Service:**
- [ ] BookingService
  - [ ] Handle timeshare bookings
  - [ ] Handle hotel bookings
  - [ ] Deduct credits
  - [ ] Create PMS reservations
  - [ ] Update week_allocations

**API:**
- [ ] POST /api/bookings
- [ ] GET /api/bookings/:id
- [ ] DELETE /api/bookings/:id (cancellation)

**Frontend:**
- [ ] Booking form
- [ ] Payment screen (credits + cash)
- [ ] Confirmation page

**Tests:**
- [ ] Unit tests for both booking types
- [ ] E2E test: full booking flow

### Phase 6: PMS Integration (Week 11)

**Infrastructure:**
- [ ] PMSAdapter interface
- [ ] MewsAdapter implementation
- [ ] CloudbedsAdapter implementation
- [ ] PMSFactory

**Service:**
- [ ] PMSOrchestrator
- [ ] Create booking
- [ ] Cancel booking
- [ ] Sync status

**Tests:**
- [ ] Mock PMS adapters
- [ ] Integration tests with sandbox APIs

### Phase 7: Admin Tools (Week 12)

**API:**
- [ ] POST /api/admin/properties
- [ ] POST /api/admin/units
- [ ] POST /api/admin/ownerships
- [ ] POST /api/admin/generate-allocations

**Frontend:**
- [ ] Admin property management
- [ ] Admin unit management
- [ ] Ownership import (CSV)
- [ ] Allocation generation tool

### Phase 8: Testing & Refinement (Week 13-14)

- [ ] Load testing (search, booking)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Bug fixes

### Phase 9: V1 Decommission & Cutover (Week 15)

**Strategy: Direct Cutover (No Gradual Migration)**

- [ ] **V1 Code Removal:**
  - [ ] Remove V1 models (keep only V2)
  - [ ] Remove V1 controllers and routes
  - [ ] Remove V1 services
  - [ ] Clean up unused dependencies
  
- [ ] **Data Migration (One-Time):**
  - [ ] Create data migration script (V1 → V2 schema)
  - [ ] Test migration on staging with production data copy
  - [ ] Validate data integrity post-migration
  
- [ ] **Cutover Plan:**
  - [ ] Schedule maintenance window (2-4 hours)
  - [ ] Backup V1 database
  - [ ] Run migration script
  - [ ] Deploy V2 code
  - [ ] Smoke tests on production
  - [ ] Rollback plan if critical issues
  
- [ ] **Post-Cutover:**
  - [ ] Monitor for 48 hours
  - [ ] Archive V1 code (separate branch)
  - [ ] Update documentation
  - [ ] Delete V1 tables after 30-day grace period

---

## Testing Strategy

### Unit Tests
- All services: 90% coverage minimum
- Test business logic in isolation
- Mock external dependencies (PMS, DB)

### Integration Tests
- Repository layer with test DB
- API endpoints with supertest
- PMS adapters with sandbox

### E2E Tests
- Critical user journeys:
  1. Owner releases week → receives credits
  2. Owner searches → books with credits → confirmed
  3. Guest registers → searches → books with card → view history
  4. Week status lifecycle: ASSIGNED → RELEASED → BOOKED → USED

### Performance Tests
- Search: 1000 concurrent users
- Booking creation: 100/minute
- Database query optimization

---

## Success Metrics

### Business Metrics
- Weeks released per month
- Re-booking rate (released → booked)
- Credit utilization rate
- Revenue per released week
- Timeshare vs Hotel booking ratio
- **Guest Metrics:**
  - Guest registration rate
  - Guest booking conversion rate
  - Guest vs Owner booking ratio
  - Average booking value (Guest)
  - Guest retention rate (repeat bookings)
- Credit utilization rate
- Revenue per released week
- Timeshare vs Hotel booking ratio
- **Guest Metrics:**
  - Guest registration rate
  - Guest booking conversion rate
  - Guest vs Owner booking ratio
  - Average booking value (Guest)
  - Guest retention rate (repeat bookings)

### Technical Metrics
- API response time (p95 < 2s)
- Booking success rate (> 99%)
- PMS sync errors (< 1%)
- Database query performance

---

## Open Questions

1. **Credit expiration policy?**
   - Do credits expire after X months?
   - Grace period?

2. **Refund policy for cancelled bookings?**
   - Full credit refund?
   - Partial refund based on timing?

3. **Overbooking handling?**
   - Multiple owners release same week?
   - How to prevent?

4. **Physical room assignment:**
   - Who decides: Platform or PMS?
   - Upgrade logic?

5. **Fractional weeks:**
   - Can owners release 3 days of a 7-day week?
   - Or always full weeks?

---

## Developer Guide (Phase 1 Complete)

### ⛔ STOP - READ THIS FIRST

**DO NOT WRITE A SINGLE LINE OF CODE WITHOUT READING THIS SECTION**

The AI agent has made the following errors **REPEATEDLY**. These are **NOT ACCEPTABLE** going forward:

#### 🚨 Critical Error #1: Using AI Memory for Field Names

**WRONG Behavior:**
```typescript
// AI assumes field names from previous training data
await WeekAllocation.create({
  release_reason: 'Owner released',        // ❌ FIELD DOESN'T EXIST
  pms_confirmation_code: 'ABC123',         // ❌ FIELD DOESN'T EXIST
  notes: 'Some note'                       // ❌ FIELD DOESN'T EXIST
});
```

**Why it fails:**
- These fields existed in earlier specs or other projects
- AI "remembers" them from training data
- Database has **DIFFERENT** field names

**CORRECT Behavior:**
```bash
# STEP 1: ALWAYS check schema first
cat backend/docs_v2/V2_DATABASE_SCHEMA.md

# STEP 2: Find the exact field names
# week_allocations optional fields:
# - release_credit_calc (LONGTEXT) - JSON object
# - pms_booking_status (VARCHAR(50))
# - pms_last_sync (DATETIME)
```

```typescript
// STEP 3: Use EXACT field names from documentation
await WeekAllocation.create({
  release_credit_calc: { baseValue: 1000, decay: 0.9 }, // ✅ CORRECT
  pms_booking_status: 'CONFIRMED',                      // ✅ CORRECT
  pms_last_sync: new Date()                             // ✅ CORRECT
});
```

**Consequence:** Tests fail, database errors, wasted hours debugging

---

#### 🚨 Critical Error #2: Ignoring UNIQUE Constraints

**WRONG Behavior:**
```typescript
// Creating 100 weeks with same week_number
for (let i = 0; i < 100; i++) {
  await createTestWeekAllocation(sequelize, ownershipId, {
    week_number: 27,  // ❌ SAME VALUE FOR ALL
    year: 2026,       // ❌ SAME YEAR
    // ownership_id is same for all
  });
}
// ERROR: SequelizeUniqueConstraintError
```

**Why it fails:**
```sql
-- This constraint exists in the database:
UNIQUE KEY unique_ownership_year_week (ownership_id, year, week_number)
-- Only 52 weeks (1-52) allowed per ownership/year
-- After 52 iterations, week_number repeats → constraint violation
```

**CORRECT Behavior:**
```typescript
// Option 1: Let fixture calculate week_number from start_date
for (let i = 0; i < 52; i++) {
  const startDate = new Date(2026, 0, i * 7); // Different dates
  await createTestWeekAllocation(sequelize, ownershipId, {
    start_date: startDate, // ✅ week_number calculated automatically
  });
}

// Option 2: Use NULL week_number
await createTestWeekAllocation(sequelize, ownershipId, {
  week_number: null, // ✅ Bypasses UNIQUE constraint
});

// Option 3: Create multiple ownerships
for (let i = 0; i < 20; i++) {
  const ownership = await createTestOwnership(sequelize, userId, unitId);
  // Now can create 52 weeks per ownership = 1040 total
}
```

**Consequence:** Test suite fails, cannot proceed to next phase

---

#### 🚨 Critical Error #3: Assuming CASCADE DELETE

**WRONG Behavior:**
```typescript
// Expecting week to be deleted when ownership is deleted
await Ownership.destroy({ where: { id: ownershipId } });

const week = await WeekAllocation.findOne({ 
  where: { ownership_id: ownershipId } 
});
expect(week).toBeNull(); // ❌ FAILS - constraint prevents delete
```

**Why it fails:**
```sql
-- The actual FK constraint is:
FOREIGN KEY (ownership_id) REFERENCES ownerships(id) 
  ON UPDATE CASCADE
  -- NO "ON DELETE CASCADE"! It's RESTRICT by default
```

**CORRECT Behavior:**
```typescript
// Expect FK constraint error
await expect(
  Ownership.destroy({ where: { id: ownershipId } })
).rejects.toThrow(/foreign key constraint fails/); // ✅ CORRECT

// Week still exists
const week = await WeekAllocation.findOne({ 
  where: { ownership_id: ownershipId } 
});
expect(week).not.toBeNull(); // ✅ CORRECT
```

**How to verify:**
```bash
# Always check FK constraints with:
docker exec sw2_mariadb mariadb -uroot -prootpassword sw2_db \
  -e "SHOW CREATE TABLE week_allocations\G"
```

**Consequence:** Wrong test expectations, incorrect business logic

---

#### 🚨 Critical Error #4: Hardcoding Values in Fixtures

**WRONG Behavior:**
```typescript
export async function createTestWeekAllocation(...) {
  return await WeekAllocation.create({
    week_number: 27,  // ❌ HARDCODED
    start_date: overrides.start_date || new Date('2026-07-01'),
    end_date: new Date('2026-07-08'), // ❌ HARDCODED, doesn't match start_date
  });
}
```

**Why it fails:**
- Multiple calls create same `week_number` → UNIQUE violation
- `end_date` doesn't match `start_date` (always +7 days from default)

**CORRECT Behavior:**
```typescript
export async function createTestWeekAllocation(...) {
  const startDate = overrides.start_date || new Date('2026-07-01');
  
  // Calculate end_date dynamically
  const endDate = overrides.end_date || 
    new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // ✅
  
  // Calculate week_number from start_date
  let week_number = overrides.week_number;
  if (week_number === undefined) {
    const weekOfYear = Math.ceil(
      (startDate.getTime() - new Date(startDate.getFullYear(), 0, 1).getTime()) 
      / (7 * 24 * 60 * 60 * 1000)
    );
    week_number = weekOfYear; // ✅ DYNAMIC
  }
  
  return await WeekAllocation.create({
    week_number,
    start_date: startDate,
    end_date: endDate,
    ...overrides,
  });
}
```

**Consequence:** UNIQUE violations, incorrect test data

---

### 🛑 MANDATORY CHECKLIST BEFORE CODING

**Before writing ANY repository, service, or test code:**

- [ ] Run `npm run document:schema` to regenerate docs
- [ ] Open `backend/docs_v2/V2_DATABASE_SCHEMA.md`
- [ ] Find the table you're working with
- [ ] Copy/paste the **EXACT** field names into your code
- [ ] Check UNIQUE constraints for the table
- [ ] Check Foreign Key constraints (CASCADE vs RESTRICT)
- [ ] Verify with `SHOW CREATE TABLE` if in doubt

**Red Flags That You're About to Make an Error:**

- ⚠️ You typed a field name from memory → **STOP, CHECK DOCS**
- ⚠️ You're creating test data without checking UNIQUE constraints → **STOP, READ CONSTRAINTS**
- ⚠️ You assumed CASCADE DELETE → **STOP, VERIFY FK BEHAVIOR**
- ⚠️ You hardcoded `week_number` → **STOP, USE DYNAMIC CALCULATION**

---

### 📚 Essential Documentation

Before writing ANY code, consult these documents in order:

1. **`backend/docs_v2/V2_DATABASE_SCHEMA.md`** - Single source of truth for database structure
2. **`backend/PHASE1_INTEGRATION_TESTS_COMPLETE.md`** - Phase 1 learnings and patterns
3. **`backend/tests/fixtures/v2-schema.ts`** - TypeScript schema validation helpers
4. **This document** - Business requirements and API specs

### 🔄 Schema Documentation Workflow

**CRITICAL:** Always use real schema, never assume field names!

```bash
# 1. After creating/modifying migrations
npm run migrate:v2

# 2. Generate schema documentation (overwrites previous)
cd backend
npm run document:schema

# 3. Consult generated docs
cat docs_v2/V2_DATABASE_SCHEMA.md

# 4. Verify in database (when in doubt)
docker exec sw2_mariadb mariadb -uroot -prootpassword sw2_db -e "SHOW CREATE TABLE week_allocations\G"
```

**Generated Files:**
- `docs_v2/V2_DATABASE_SCHEMA.json` - Machine-readable
- `docs_v2/V2_DATABASE_SCHEMA.md` - Human-readable
- `tests/fixtures/v2-schema.ts` - TypeScript helpers

### ⚠️ Common Field Name Errors

These field names are **WRONG** (from AI memory):

| ❌ WRONG | ✅ CORRECT | Type | Table |
|---------|----------|------|-------|
| `pms_credentials` | `pms_credentials_encrypted` | BLOB | timeshare_properties |
| `capacity` | `capacity_min`, `capacity_max` | INT | timeshare_units |
| `release_reason` | `release_credit_calc` | JSON | week_allocations |
| `pms_confirmation_code` | `pms_booking_status` | VARCHAR | week_allocations |
| `notes` | `pms_last_sync` | DATETIME | week_allocations |

**How to avoid:**
```typescript
// ❌ BAD: Using memory
await WeekAllocation.create({
  release_reason: 'Owner released', // WRONG FIELD!
  pms_confirmation_code: 'ABC123'   // WRONG FIELD!
});

// ✅ GOOD: Checked V2_DATABASE_SCHEMA.md first
await WeekAllocation.create({
  release_credit_calc: { baseValue: 1000, decay: 0.9 }, // JSON object
  pms_booking_status: 'CONFIRMED'
});
```

### 🗂️ Repository Pattern (Phase 1)

All repositories extend `BaseRepository<T>` for consistency:

```typescript
// Location: src/repositories/v2/
// Example: WeekAllocationRepository.ts

import { BaseRepository } from './BaseRepository';
import { WeekAllocation } from '../../models/v2/WeekAllocation';

export class WeekAllocationRepository extends BaseRepository<WeekAllocation> {
  constructor() {
    super(WeekAllocation);
  }

  // Custom query methods
  async findAvailableWeeks(filters: { start: Date; end: Date }): Promise<WeekAllocation[]> {
    return this.findAll({
      where: {
        status: 'RELEASED',
        start_date: { [Op.gte]: filters.start },
        end_date: { [Op.lte]: filters.end },
      },
    });
  }
}
```

**Implemented Repositories (Phase 1):**
- ✅ `WeekAllocationRepository` - 14/14 tests passing
- ⏳ `OwnershipRepository` - TODO Phase 2
- ⏳ `TimeshareUnitRepository` - TODO Phase 2
- ⏳ `CreditAccountRepository` - TODO Phase 2

### 🧪 Testing Pattern (Phase 1)

**Test Structure:**
```
backend/tests/
├── fixtures/
│   ├── v2-fixtures.ts        # Fixture factories (ALWAYS use these)
│   └── v2-schema.ts          # Auto-generated validation helpers
├── setup/
│   ├── globalSetup.ts        # DB connection test
│   └── weekAllocationSetup.ts # Per-file setup (truncate tables)
└── v2/
    ├── unit/                 # Unit tests (84/84 passing)
    └── integration/          # Integration tests (14/14 passing)
        └── weekAllocationRepository.test.ts
```

**Fixture Usage (CRITICAL):**

```typescript
import { 
  createTestUser, 
  createTestProperty, 
  createTestUnit,
  createTestOwnership,
  createTestWeekAllocation 
} from '../../fixtures/v2-fixtures';

describe('MyRepository', () => {
  let sequelize: any;
  let repository: MyRepository;
  let testUserId: number;

  beforeEach(async () => {
    sequelize = await sequelizeConnection.authenticate();
    repository = new MyRepository();
    
    // Use fixtures - they handle UNIQUE constraints correctly
    const user = await createTestUser(sequelize);
    const property = await createTestProperty(sequelize);
    const unit = await createTestUnit(sequelize, property.id);
    const ownership = await createTestOwnership(sequelize, user.id, unit.id);
    
    testUserId = user.id;
  });

  it('should do something', async () => {
    // Create week with dynamic week_number calculation
    const week = await createTestWeekAllocation(sequelize, ownership.id, {
      start_date: new Date('2026-07-01'), // week_number auto-calculated from date
      status: 'RELEASED',
    });
    
    // Test your logic
    const result = await repository.findById(week.id);
    expect(result).not.toBeNull();
  });
});
```

**Why Fixtures are Critical:**
1. **Respect UNIQUE constraints:** `createTestWeekAllocation` calculates `week_number` from `start_date`
2. **Avoid FK violations:** Creates dependencies in correct order (user → property → unit → ownership → week)
3. **Consistent test data:** All tests use same patterns
4. **Raw SQL for users:** Avoids V1/V2 model conflicts

### 🚨 Database Constraints (MEMORIZE THESE)

#### 1. UNIQUE Constraint on week_allocations

```sql
UNIQUE KEY unique_ownership_year_week (ownership_id, year, week_number)
```

**Impact:** Max 52 weeks per ownership/year (week_number 1-52)

**Solutions:**
```typescript
// Option 1: Let fixture calculate week_number from start_date
await createTestWeekAllocation(sequelize, ownershipId, {
  start_date: new Date('2026-07-01'), // week_number = 27 (auto-calculated)
});

// Option 2: Use NULL week_number (bypasses constraint)
await createTestWeekAllocation(sequelize, ownershipId, {
  week_number: null,
  start_date: new Date('2026-07-01'),
});

// Option 3: Create multiple ownerships for large datasets
for (let i = 0; i < 20; i++) {
  const ownership = await createTestOwnership(sequelize, userId, unitId);
  // Now can create 52 weeks per ownership = 1040 total
}
```

#### 2. Foreign Key Behaviors

```sql
-- ownership_id: NO DELETE CASCADE (RESTRICT)
FOREIGN KEY (ownership_id) REFERENCES ownerships(id) ON UPDATE CASCADE

-- booking_id: DELETE SET NULL
FOREIGN KEY (booking_id) REFERENCES v2_bookings(id) ON DELETE SET NULL ON UPDATE CASCADE

-- booked_by: DELETE SET NULL
FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
```

**Impact:**
- ❌ Cannot delete ownership with weeks (constraint error)
- ✅ Can delete booking → `booking_id` set to NULL in weeks
- ✅ Can delete user → `booked_by` set to NULL in weeks

**Tests:**
```typescript
// This FAILS (correct behavior)
await sequelize.query(`DELETE FROM ownerships WHERE id = ${ownershipId}`);
// Error: foreign key constraint fails

// This SUCCEEDS
await sequelize.query(`DELETE FROM v2_bookings WHERE id = ${bookingId}`);
// week_allocations.booking_id → NULL
```

#### 3. Performance Indexes

All queries use composite indexes for speed:

```sql
-- Used by: findAvailableWeeks()
INDEX idx_search_released (status, start_date, end_date)

-- Used by: findByOwnershipAndYear()
INDEX idx_ownership_year (ownership_id, year)

-- Used by: unified search
INDEX idx_unified_search (status, start_date, end_date, ownership_id)
```

**Validation:** Performance test confirms < 100ms for 1000 weeks

### 📝 Model Definition Pattern

**Location:** `src/models/v2/`

```typescript
import { Model, DataTypes, Sequelize } from 'sequelize';

export class WeekAllocation extends Model {
  // Properties (match DB schema EXACTLY)
  public id!: number;
  public ownership_id!: number;
  public year!: number;
  public week_number!: number | null;
  public start_date!: Date;
  public end_date!: Date;
  public status!: 'ASSIGNED' | 'RESERVED' | 'RELEASED' | 'BOOKED' | 'USED' | 'EXPIRED';
  
  // ⚠️ CRITICAL: Use correct field names from V2_DATABASE_SCHEMA.md
  public release_credit_calc!: object | null; // NOT release_reason
  public pms_booking_status!: string | null;  // NOT pms_confirmation_code
  public pms_last_sync!: Date | null;        // NOT notes
  
  // Timestamps
  public created_at!: Date;
  public updated_at!: Date;
}

export function initWeekAllocation(sequelize: Sequelize): typeof WeekAllocation {
  WeekAllocation.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      ownership_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      year: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      week_number: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.ENUM('ASSIGNED', 'RESERVED', 'RELEASED', 'BOOKED', 'USED', 'EXPIRED'),
        defaultValue: 'ASSIGNED',
      },
      release_credit_calc: { type: DataTypes.JSON, allowNull: true },
      pms_booking_status: { type: DataTypes.STRING(50), allowNull: true },
      pms_last_sync: { type: DataTypes.DATE, allowNull: true },
      // ... other fields
    },
    {
      sequelize,
      tableName: 'week_allocations',
      timestamps: true,
      underscored: true,
    }
  );
  return WeekAllocation;
}
```

### 🎯 Service Layer Pattern (Phase 2+)

**Structure:**
```
src/services/v2/
├── OwnershipService.ts        # CRUD for ownerships
├── WeekAllocationService.ts   # Generate annual allocations
├── WeekReleaseService.ts      # Week release logic + credits
├── CreditService.ts           # Credit transactions
├── UnifiedSearchService.ts    # Search timeshare + hotel
├── BookingService.ts          # Create/cancel bookings
└── PMSOrchestrator.ts         # PMS integration
```

**Pattern:**
```typescript
export class WeekReleaseService {
  constructor(
    private weekRepo: WeekAllocationRepository,
    private creditService: CreditService,
    private pmsOrchestrator: PMSOrchestrator
  ) {}

  async releaseWeek(allocationId: number, ownerId: number): Promise<WeekReleaseResult> {
    // 1. Validate ownership
    const week = await this.weekRepo.findById(allocationId);
    if (!week) throw new NotFoundError('Week allocation not found');
    
    // 2. Calculate credits (use release_credit_calc field)
    const creditCalc = await this.calculateCredits(week);
    
    // 3. Update week status
    await this.weekRepo.update(allocationId, {
      status: 'RELEASED',
      released_at: new Date(),
      credits_issued: creditCalc.finalCredits,
      release_credit_calc: creditCalc, // Store JSON calculation breakdown
    });
    
    // 4. Credit account
    await this.creditService.addCredits(ownerId, creditCalc.finalCredits, {
      type: 'WEEK_RELEASE',
      reference_type: 'week_allocation',
      reference_id: allocationId,
      metadata: creditCalc,
    });
    
    // 5. Cancel PMS booking if exists
    if (week.pms_booking_id) {
      await this.pmsOrchestrator.cancelBooking(week.pms_booking_id);
    }
    
    return { week, creditsIssued: creditCalc.finalCredits };
  }
}
```

### 🔍 Common Pitfalls & Solutions

#### Pitfall 1: Hardcoding week_number
```typescript
// ❌ BAD: Creates UNIQUE constraint violations
for (let i = 0; i < 100; i++) {
  await createTestWeekAllocation(sequelize, ownershipId, {
    week_number: 27, // Same for all!
  });
}

// ✅ GOOD: Let fixture calculate from start_date
for (let i = 0; i < 52; i++) {
  const startDate = new Date(2026, 0, i * 7); // Different dates
  await createTestWeekAllocation(sequelize, ownershipId, {
    start_date: startDate, // week_number auto-calculated
  });
}
```

#### Pitfall 2: Wrong field names
```typescript
// ❌ BAD: Using AI memory
const week = await WeekAllocation.findOne({
  where: { pms_confirmation_code: 'ABC123' } // FIELD DOESN'T EXIST!
});

// ✅ GOOD: Checked V2_DATABASE_SCHEMA.md
const week = await WeekAllocation.findOne({
  where: { pms_booking_status: 'CONFIRMED' }
});
```

#### Pitfall 3: Assuming CASCADE DELETE
```typescript
// ❌ BAD: Expects week to be deleted
await Ownership.destroy({ where: { id: ownershipId } });
const week = await WeekAllocation.findOne({ where: { ownership_id: ownershipId } });
expect(week).toBeNull(); // FAILS - constraint error prevents delete

// ✅ GOOD: Expect constraint error
await expect(
  Ownership.destroy({ where: { id: ownershipId } })
).rejects.toThrow(/foreign key constraint/);
```

#### Pitfall 4: Timezone issues with dates
```typescript
// ❌ BAD: Exact date comparison fails due to UTC offset
expect(week.start_date.getMonth()).toBe(6); // July
// Actual: 5 (June) because of UTC conversion

// ✅ GOOD: Use tolerance or string comparison
const diff = Math.abs(new Date(week.start_date) - new Date('2026-07-01'));
expect(diff).toBeLessThan(2 * 24 * 60 * 60 * 1000); // Within 2 days
```

### 📦 Package Scripts

```bash
# Testing
npm run test              # All tests (unit + integration)
npm run test:unit         # Unit tests only (84/84 passing)
npm run test:integration  # Integration tests only (14/14 passing)

# Database
npm run migrate:v2        # Run V2 migrations
npm run document:schema   # Generate schema documentation
npm run reset:v2          # Reset V2 tables (WARNING: destructive)

# Development
npm run dev               # Start dev server with hot reload
npm run build             # Build TypeScript
npm run lint              # Run ESLint

# Docker
docker ps                 # Check containers
docker exec sw2_mariadb mariadb -e "SHOW TABLES" sw2_db
```

### 📖 Further Reading

**Phase 1 Complete:**
- [PHASE1_INTEGRATION_TESTS_COMPLETE.md](../backend/PHASE1_INTEGRATION_TESTS_COMPLETE.md) - Comprehensive Phase 1 summary

**Auto-Generated:**
- [V2_DATABASE_SCHEMA.md](../backend/docs_v2/V2_DATABASE_SCHEMA.md) - Always up-to-date schema

**Test Examples:**
- [weekAllocationRepository.test.ts](../backend/tests/v2/integration/weekAllocationRepository.test.ts) - 15 integration tests
- [v2-fixtures.ts](../backend/tests/fixtures/v2-fixtures.ts) - Fixture factories

**Models:**
- [WeekAllocation.ts](../backend/src/models/v2/WeekAllocation.ts) - Example model
- [TimeshareUnit.ts](../backend/src/models/v2/TimeshareUnit.ts) - Example model

### ✅ Phase 1 Checklist

Before starting Phase 2, verify:

- [x] Schema documentation system working (`npm run document:schema`)
- [x] V2_DATABASE_SCHEMA.md exists and is current
- [x] All 8 V2 fixture factories created
- [x] WeekAllocation model matches real schema
- [x] TimeshareUnit model matches real schema
- [x] WeekAllocationRepository fully implemented
- [x] 14/14 integration tests passing
- [x] 84/84 unit tests passing (from previous phase)
- [x] UNIQUE constraint handling documented
- [x] FK behavior documented and tested
- [x] Performance benchmarks met (< 100ms for 1000 records)

**Status:** ✅ Ready for Phase 2 (Service Layer)

---

### 📋 Quick Reference: Field Name Cheat Sheet

**USE THIS TABLE - DO NOT TRUST YOUR MEMORY**

| Table | ❌ WRONG FIELD | ✅ CORRECT FIELD | Type | Notes |
|-------|---------------|-----------------|------|-------|
| `timeshare_properties` | `pms_credentials` | `pms_credentials_encrypted` | BLOB | Encrypted, not JSON |
| `timeshare_properties` | `location` | `city`, `country`, `region` | VARCHAR | Multiple fields, not one |
| `timeshare_units` | `capacity` | `capacity_min`, `capacity_max` | TINYINT | Range, not single value |
| `week_allocations` | `release_reason` | `release_credit_calc` | LONGTEXT (JSON) | JSON object, not string |
| `week_allocations` | `pms_confirmation_code` | `pms_booking_status` | VARCHAR(50) | Status, not code |
| `week_allocations` | `notes` | `pms_last_sync` | DATETIME | Timestamp, not text |
| `ownerships` | `week_number` | `fixed_week_number` | TINYINT | Only for FIXED_WEEK type |
| `credit_transactions` | `balance_after` only | `balance_before`, `balance_after` | DECIMAL | Both required for audit |

**Copy-Paste Code Snippets (Safe to Use):**

```typescript
// ✅ CORRECT: week_allocations fields
const weekData = {
  release_credit_calc: { baseValue: 1000, seasonality: 1.2, timing: 0.9 },
  pms_booking_status: 'CONFIRMED',
  pms_last_sync: new Date(),
};

// ✅ CORRECT: timeshare_units capacity
const unitData = {
  capacity_min: 2,
  capacity_max: 6,
};

// ✅ CORRECT: credit_transactions with audit trail
const transactionData = {
  balance_before: currentBalance,
  balance_after: currentBalance + amount,
  amount: amount,
};
```

---

### 🔐 Constraint Reference Card

**MEMORIZE THESE - THEY CAUSE 80% OF TEST FAILURES**

```sql
-- UNIQUE Constraints (will REJECT duplicate combinations)
UNIQUE (ownership_id, year, week_number)           -- week_allocations: max 52 per ownership/year
UNIQUE (property_id, slug)                         -- timeshare_units
UNIQUE (property_id, date, room_category)          -- hotel_inventory
UNIQUE (user_id)                                   -- credit_accounts: one account per user
UNIQUE (confirmation_code)                         -- v2_bookings

-- FK Constraints with RESTRICT (will REJECT delete if children exist)
week_allocations.ownership_id → ownerships(id)     -- Cannot delete ownership with weeks
v2_bookings.guest_id → users(id)                   -- Cannot delete user with bookings
v2_bookings.property_id → timeshare_properties(id) -- Cannot delete property with bookings

-- FK Constraints with SET NULL (will NULL-out field on parent delete)
week_allocations.booking_id → v2_bookings(id)      -- Delete booking → week.booking_id = NULL
week_allocations.booked_by → users(id)             -- Delete user → week.booked_by = NULL
v2_bookings.week_allocation_id → week_allocations(id)

-- FK Constraints with CASCADE (will DELETE children when parent deleted)
credit_accounts.user_id → users(id)                -- Delete user → delete credit account
credit_transactions.account_id → credit_accounts(id) -- Delete account → delete transactions
hotel_inventory.property_id → timeshare_properties(id)
```

**Common Mistakes:**

```typescript
// ❌ WRONG: Expecting CASCADE DELETE where it doesn't exist
await Ownership.destroy({ where: { id: ownershipId } });
// FAILS with FK constraint error - week_allocations still reference it

// ✅ CORRECT: Delete children first, then parent
await WeekAllocation.destroy({ where: { ownership_id: ownershipId } });
await Ownership.destroy({ where: { id: ownershipId } });

// ✅ OR: Expect the constraint error
await expect(
  Ownership.destroy({ where: { id: ownershipId } })
).rejects.toThrow(/foreign key constraint fails/);
```

---

## Next Steps

1. **Review this spec** with Antonio and team
2. **Prioritize features** (MVP vs nice-to-have)
3. **Refine open questions**
4. **Create GitHub project** with issues
5. **Start Phase 2** - Service Layer Implementation
   - WeekReleaseService (credit calculation)
   - CreditService (transaction ledger)
   - UnifiedSearchService (timeshare + hotel)

---

**Document Status:** Living Document - Updated with Phase 1 Results  
**Last Updated:** 2026-02-01  
**Author:** Development Team  
**Reviewers:** Antonio (Product), Team Lead (Technical)  
**Phase:** 1 Complete, Ready for Phase 2
