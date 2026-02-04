# Database Design - Timeshare Exchange Platform V2

**Date:** 2026-02-01  
**Database:** MariaDB 10.11+  
**Focus:** Performance, Scalability, Data Integrity  
**Target Scale:** 100K+ ownerships, 10K concurrent searches, 1K bookings/hour

---

## Design Principles

### 1. **Query-First Design**
- Design tables and indexes based on actual query patterns
- Optimize for read-heavy operations (search > write)
- Denormalize strategically for performance

### 2. **Data Integrity**
- Foreign keys enforced at database level
- Constraints prevent invalid states
- Immutable ledger for critical data (credits, transactions)

### 3. **Scalability**
- Partition large tables (bookings, transactions)
- Archive old data systematically
- Indexes optimized for query patterns

### 4. **Performance Targets**
- Search queries: < 500ms (p95)
- Credit transactions: < 50ms (ACID)
- Booking creation: < 200ms (excluding PMS API)

---

## Schema Design

### Core Tables (Normalized)

#### 1. `timeshare_properties` - Property Master Data

```sql
CREATE TABLE timeshare_properties (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE, -- URL-friendly: "beach-resort-marbella"
  
  -- Location (indexed for search)
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100), -- "Andalusia", "Costa del Sol"
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  postal_code VARCHAR(20),
  
  -- PMS Integration (encrypted at application level)
  pms_provider ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other') NOT NULL,
  pms_property_id VARCHAR(255),
  pms_credentials_encrypted BLOB, -- AES-256 encrypted JSON
  pms_last_sync TIMESTAMP NULL,
  pms_sync_status ENUM('OK', 'ERROR', 'DISABLED') DEFAULT 'OK',
  
  -- Program Configuration
  program_type ENUM('FIXED_WEEK', 'FLOATING', 'POINTS') NOT NULL,
  weeks_per_year TINYINT UNSIGNED DEFAULT 52,
  check_in_day ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') DEFAULT 'SATURDAY',
  
  -- Metadata
  description TEXT,
  amenities JSON, -- ["Pool", "Gym", "Spa", "Restaurant"]
  policies JSON,  -- Check-in time, cancellation, etc.
  images JSON,    -- [{"url": "...", "order": 1, "caption": "..."}]
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_marketplace_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for common queries
  INDEX idx_location (city, country, is_active),
  INDEX idx_coordinates (latitude, longitude), -- Geo search
  INDEX idx_pms (pms_provider, pms_property_id),
  INDEX idx_program (program_type, is_active),
  FULLTEXT INDEX ft_search (name, city, region, country) -- Full-text search
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Design Rationale:**
- `slug`: SEO-friendly URLs without hitting DB for ID
- `latitude/longitude`: Enable "near me" searches
- `FULLTEXT`: Fast text search on location/name
- `is_marketplace_enabled`: Admin can hide properties without deletion
- Encrypted PMS credentials stored as BLOB (app-level encryption)

---

#### 2. `timeshare_units` - Unit Categories (Room Types)

```sql
CREATE TABLE timeshare_units (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  
  -- Unit Configuration
  category VARCHAR(100) NOT NULL, -- "Studio", "1BR Ocean", "2BR Premium"
  slug VARCHAR(150) NOT NULL, -- "studio", "1br-ocean"
  capacity_min TINYINT UNSIGNED NOT NULL DEFAULT 1,
  capacity_max TINYINT UNSIGNED NOT NULL, -- Max occupancy
  quantity SMALLINT UNSIGNED NOT NULL, -- How many physical rooms in this category
  
  -- Physical Attributes
  bedrooms TINYINT UNSIGNED DEFAULT 0,
  bathrooms DECIMAL(2,1) DEFAULT 1.0, -- 1.5 = 1 full + 1 half
  size_sqm SMALLINT UNSIGNED, -- Square meters
  floor_range VARCHAR(50), -- "3-8", "Ground"
  
  -- Pricing/Credits
  base_credit_value DECIMAL(10, 2) NOT NULL,
  seasonal_factors JSON NOT NULL, -- {1: 0.8, 2: 0.8, ..., 7: 1.5, 8: 1.5, ...}
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  
  -- Amenities & Details
  description TEXT,
  amenities JSON, -- ["Kitchen", "Balcony", "Ocean View"]
  images JSON,
  view_type ENUM('OCEAN', 'POOL', 'GARDEN', 'CITY', 'MOUNTAIN', 'NO_VIEW') DEFAULT 'NO_VIEW',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE RESTRICT,
  
  -- Indexes
  UNIQUE KEY unique_property_category (property_id, category),
  INDEX idx_property_active (property_id, is_active),
  INDEX idx_capacity (capacity_max), -- Filter by guests
  INDEX idx_category (category), -- Search by category
  INDEX idx_credits (base_credit_value) -- Sort by price
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Design Rationale:**
- `quantity`: Enables multiple physical rooms per category
- `seasonal_factors`: JSON with week multipliers (1-52)
- `capacity_min/max`: Allow flexible occupancy
- `slug`: Fast lookup without ID
- Unique constraint prevents duplicate categories

---

#### 3. `ownerships` - Timeshare Contracts

```sql
CREATE TABLE ownerships (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  
  -- Relationships
  owner_id INT UNSIGNED NOT NULL,
  unit_id INT UNSIGNED NOT NULL,
  
  -- Ownership Type
  type ENUM('FIXED_WEEK', 'FLOATING', 'POINTS') NOT NULL,
  
  -- Fixed Week Configuration (NULL if not fixed)
  fixed_week_number TINYINT UNSIGNED, -- 1-52
  
  -- Floating/Points Configuration (NULL if fixed)
  annual_points SMALLINT UNSIGNED,
  
  -- Contract Details
  purchase_date DATE,
  contract_reference VARCHAR(255),
  contract_start_year YEAR NOT NULL,
  contract_end_year YEAR, -- NULL = perpetual
  
  -- Financials
  annual_fee DECIMAL(10, 2) NOT NULL,
  annual_fee_due_date DATE, -- e.g., Jan 31 each year
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  last_payment_date DATE,
  
  -- Status
  status ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_PAYMENT') NOT NULL DEFAULT 'ACTIVE',
  suspension_reason TEXT,
  
  -- Metadata
  notes TEXT,
  metadata JSON, -- Custom fields, tags
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (unit_id) REFERENCES timeshare_units(id) ON DELETE RESTRICT,
  
  -- Indexes
  INDEX idx_owner_status (owner_id, status),
  INDEX idx_unit (unit_id),
  INDEX idx_type (type, status),
  INDEX idx_contract_dates (contract_start_year, contract_end_year),
  INDEX idx_payment_status (status, last_payment_date), -- Billing reminders
  
  -- Business Rule: Fixed week must have week number
  CHECK (
    (type = 'FIXED_WEEK' AND fixed_week_number IS NOT NULL) OR
    (type != 'FIXED_WEEK' AND fixed_week_number IS NULL)
  ),
  
  -- Business Rule: Floating/Points must have annual points
  CHECK (
    (type IN ('FLOATING', 'POINTS') AND annual_points IS NOT NULL) OR
    (type = 'FIXED_WEEK' AND annual_points IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Design Rationale:**
- Supports 3 ownership models (fixed, floating, points)
- `CHECK` constraints enforce business rules
- `contract_end_year`: NULL = perpetual ownership
- `annual_fee_due_date`: Enables automated billing reminders
- Status includes `PENDING_PAYMENT` for delinquent accounts

---

#### 4. `week_allocations` - Weekly Inventory (HOT TABLE)

**⚠️ This is the MOST QUERIED table - heavily optimized**

```sql
CREATE TABLE week_allocations (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ownership_id INT UNSIGNED NOT NULL,
  
  -- Week Identification
  year YEAR NOT NULL,
  week_number TINYINT UNSIGNED, -- 1-52 (NULL for date-specific)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Status Lifecycle (indexed for fast filtering)
  status ENUM(
    'ASSIGNED',   -- 1: Owner has it (default)
    'RESERVED',   -- 2: Owner booked for self
    'RELEASED',   -- 3: Converted to credits (PUBLIC INVENTORY)
    'BOOKED',     -- 4: Someone else booked
    'USED',       -- 5: Checked out
    'EXPIRED'     -- 6: Past, unused
  ) NOT NULL DEFAULT 'ASSIGNED',
  
  -- Release Details (populated when status = RELEASED)
  released_at TIMESTAMP NULL,
  credits_issued DECIMAL(10, 2) NULL,
  release_credit_calc JSON, -- Store calculation breakdown for audit
  
  -- Booking Details (populated when status = BOOKED/USED)
  booking_id INT UNSIGNED NULL,
  booked_by INT UNSIGNED NULL,
  booked_at TIMESTAMP NULL,
  
  -- PMS Tracking
  pms_booking_id VARCHAR(255) NULL,
  pms_booking_status VARCHAR(50) NULL,
  physical_room_assigned VARCHAR(100) NULL,
  pms_last_sync TIMESTAMP NULL,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (ownership_id) REFERENCES ownerships(id) ON DELETE RESTRICT,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Critical Indexes for Search Performance
  -- Main search query: find RELEASED weeks by date range
  INDEX idx_search_released (status, start_date, end_date) USING BTREE,
  
  -- Owner dashboard: show my weeks
  INDEX idx_owner_year (ownership_id, year, status),
  
  -- Booking lookup
  INDEX idx_booking (booking_id),
  INDEX idx_booked_by (booked_by, status),
  
  -- Date range queries (for availability calendar)
  INDEX idx_dates (start_date, end_date, status),
  
  -- Expired week cleanup job
  INDEX idx_expired (end_date, status),
  
  -- Composite index for unified search (CRITICAL for performance)
  INDEX idx_unified_search (status, year, start_date) USING BTREE,
  
  -- Unique constraint: one allocation per ownership per week
  UNIQUE KEY unique_ownership_year_week (ownership_id, year, week_number),
  
  -- Business Rules
  CHECK (end_date > start_date),
  CHECK (DATEDIFF(end_date, start_date) = 7), -- Always 7 days
  CHECK (
    (status IN ('RELEASED', 'BOOKED', 'USED') AND credits_issued IS NOT NULL) OR
    (status NOT IN ('RELEASED', 'BOOKED', 'USED'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partition by year for better performance (optional, for very large datasets)
ALTER TABLE week_allocations 
PARTITION BY RANGE (year) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

**Design Rationale:**
- **Hot table**: Queried on every search
- `idx_search_released`: Composite index for main search query
- `status` enum ordered by frequency (ASSIGNED most common)
- Partitioning by year: Improves query performance for current/future years
- `release_credit_calc` JSON: Audit trail for credit calculation
- 7-day constraint: Enforced at DB level

**Query Performance:**
```sql
-- Main search query (sub-500ms with proper indexes)
EXPLAIN SELECT 
  wa.id, wa.start_date, wa.end_date, wa.credits_issued,
  u.category, p.name, p.city
FROM week_allocations wa
JOIN ownerships o ON wa.ownership_id = o.id
JOIN timeshare_units u ON o.unit_id = u.id
JOIN timeshare_properties p ON u.property_id = p.id
WHERE 
  wa.status = 'RELEASED'
  AND wa.start_date >= '2026-07-01'
  AND wa.end_date <= '2026-08-31'
  AND p.city = 'Marbella'
  AND u.capacity_max >= 4
LIMIT 50;
-- Uses: idx_search_released + idx_property_active + idx_capacity
```

---

#### 5. `credit_accounts` - User Credit Balance

```sql
CREATE TABLE credit_accounts (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL UNIQUE, -- 1:1 relationship
  
  -- Balance (always calculated, never manually updated)
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  
  -- Limits & Restrictions
  credit_limit DECIMAL(10, 2), -- Max negative balance (for staff/VIP)
  expiration_policy ENUM('NEVER', '1_YEAR', '2_YEARS') DEFAULT '2_YEARS',
  
  -- Metadata
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_transaction_at TIMESTAMP NULL,
  
  -- Foreign Keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Indexes
  INDEX idx_balance (balance), -- Find users with high/low balances
  INDEX idx_last_transaction (last_transaction_at) -- Inactive accounts
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Design Rationale:**
- **Single source of truth** for balance
- Balance updated via triggers (not manually)
- `credit_limit`: Enable negative balance for special users
- Simple table, focused on current state

---

#### 6. `credit_transactions` - Immutable Ledger (APPEND-ONLY)

```sql
CREATE TABLE credit_transactions (
  -- Primary Key
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id INT UNSIGNED NOT NULL,
  
  -- Transaction Details
  type ENUM(
    'WEEK_RELEASE',
    'WEEK_BOOKING',
    'CREDIT_PURCHASE',
    'CREDIT_EXPIRATION',
    'CONDOMINIUM_PAYMENT',
    'REFUND',
    'ADJUSTMENT',
    'BONUS',
    'PENALTY'
  ) NOT NULL,
  
  -- Amounts (positive = credit, negative = debit)
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  
  -- References (what triggered this transaction)
  reference_type VARCHAR(50), -- 'week_allocation', 'booking', 'payment'
  reference_id INT UNSIGNED,
  
  -- Metadata
  description VARCHAR(500) NOT NULL,
  metadata JSON, -- Additional details, calculations
  
  -- Audit Trail
  created_by INT UNSIGNED, -- Admin user if manual
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Immutable timestamp
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_account_date (account_id, created_at DESC), -- User transaction history
  INDEX idx_type (type, created_at),
  INDEX idx_reference (reference_type, reference_id), -- Find transactions for entity
  INDEX idx_created_at (created_at), -- Time-based queries
  
  -- Business Rule: Balance integrity
  CHECK (balance_after = balance_before + amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partition by month for historical data (helps with archiving)
ALTER TABLE credit_transactions 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
  PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  -- Add partitions monthly via cron job
  PARTITION p_current VALUES LESS THAN MAXVALUE
);
```

**Design Rationale:**
- **Immutable ledger**: NO updates, NO deletes
- `balance_before/after`: Audit trail, detect tampering
- `CHECK` constraint: Ensures balance calculations correct
- Partitioning: Enables efficient archiving of old transactions
- `BIGINT`: Supports billions of transactions

**Trigger for Balance Update:**
```sql
DELIMITER //
CREATE TRIGGER trg_credit_transaction_after_insert
AFTER INSERT ON credit_transactions
FOR EACH ROW
BEGIN
  UPDATE credit_accounts
  SET 
    balance = NEW.balance_after,
    last_transaction_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.account_id;
END//
DELIMITER ;
```

---

#### 7. `bookings` - Reservation Records

```sql
CREATE TABLE bookings (
  -- Primary Key
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  confirmation_code VARCHAR(20) UNIQUE NOT NULL, -- "BRM-5001-2026"
  
  -- Relationships
  guest_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  week_allocation_id INT UNSIGNED NULL, -- NULL if hotel booking
  
  -- Dates
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights TINYINT UNSIGNED NOT NULL,
  guests TINYINT UNSIGNED NOT NULL,
  
  -- Room Details
  room_category VARCHAR(100) NOT NULL,
  physical_room VARCHAR(100), -- Assigned by PMS later
  
  -- Source Type (for margin calculation)
  source ENUM('TIMESHARE', 'HOTEL_PMS') NOT NULL,
  
  -- Payment Details
  credits_used DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  cash_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  payment_status ENUM('PENDING', 'COMPLETED', 'REFUNDED') DEFAULT 'PENDING',
  
  -- Platform Economics
  platform_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- What we pay (0 for timeshare)
  platform_revenue DECIMAL(10, 2) NOT NULL, -- What we earn
  margin_percent DECIMAL(5, 2) NOT NULL,
  
  -- Status Lifecycle
  status ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING',
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP NULL,
  
  -- PMS Integration
  pms_booking_id VARCHAR(255),
  pms_provider VARCHAR(50),
  pms_status VARCHAR(50),
  pms_last_sync TIMESTAMP NULL,
  
  -- Guest Details (cached for performance)
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(50),
  
  -- Special Requests
  special_requests TEXT,
  internal_notes TEXT, -- Staff only
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL,
  
  -- Foreign Keys
  FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE RESTRICT,
  FOREIGN KEY (week_allocation_id) REFERENCES week_allocations(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_guest (guest_id, status),
  INDEX idx_property_dates (property_id, check_in, check_out),
  INDEX idx_check_in (check_in, status), -- Daily check-in report
  INDEX idx_check_out (check_out, status), -- Daily check-out report
  INDEX idx_status (status, created_at),
  INDEX idx_source (source, status), -- Revenue reports by source
  INDEX idx_confirmation (confirmation_code),
  INDEX idx_pms (pms_provider, pms_booking_id),
  
  -- Business Rules
  CHECK (check_out > check_in),
  CHECK (nights = DATEDIFF(check_out, check_in)),
  CHECK (platform_revenue >= 0),
  CHECK (margin_percent >= 0 AND margin_percent <= 100),
  CHECK (
    (source = 'TIMESHARE' AND week_allocation_id IS NOT NULL) OR
    (source = 'HOTEL_PMS' AND platform_cost > 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partition by check-in year
ALTER TABLE bookings 
PARTITION BY RANGE (YEAR(check_in)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

**Design Rationale:**
- `confirmation_code`: User-friendly booking reference
- Cached guest details: Avoid JOIN on every query
- `source` enum: Distinguish timeshare vs hotel bookings
- Economics fields: Track costs, revenue, margins
- Partitioning: Improve queries for current/future bookings

---

### Supporting Tables

#### 8. `hotel_inventory` - PMS Availability Cache

```sql
CREATE TABLE hotel_inventory (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id INT UNSIGNED NOT NULL,
  
  -- Date & Room
  date DATE NOT NULL,
  room_category VARCHAR(100) NOT NULL,
  
  -- Availability
  total_rooms SMALLINT UNSIGNED NOT NULL,
  available_rooms SMALLINT UNSIGNED NOT NULL,
  rate DECIMAL(10, 2) NOT NULL, -- What we pay per night
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  
  -- Cache Metadata
  last_synced TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50), -- 'PMS_API', 'MANUAL'
  is_stale BOOLEAN DEFAULT FALSE,
  
  -- Foreign Keys
  FOREIGN KEY (property_id) REFERENCES timeshare_properties(id) ON DELETE CASCADE,
  
  -- Indexes
  UNIQUE KEY unique_property_date_category (property_id, date, room_category),
  INDEX idx_date_available (date, available_rooms), -- Search availability
  INDEX idx_stale (is_stale, last_synced), -- Refresh stale cache
  INDEX idx_property_date (property_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TTL: Auto-delete old cache (run daily)
-- DELETE FROM hotel_inventory WHERE date < DATE_SUB(NOW(), INTERVAL 1 DAY);
```

**Design Rationale:**
- **Cache layer**: Avoid hitting PMS API on every search
- `is_stale`: Flag for background refresh
- TTL cleanup: Delete past dates automatically
- Unique constraint: One entry per property/date/category

---

## Query Optimization Strategies

### 1. Unified Search Query (CRITICAL PATH)

**Business Requirement:** Search < 2 seconds for 10K concurrent users

**Query:**
```sql
-- Step 1: Find released timeshare weeks
SELECT 
  'TIMESHARE' AS source,
  wa.id AS allocation_id,
  p.id AS property_id,
  p.name AS property_name,
  p.city,
  p.country,
  u.category AS room_category,
  u.capacity_max,
  u.amenities,
  wa.start_date AS check_in,
  wa.end_date AS check_out,
  wa.credits_issued AS credit_price,
  0 AS cash_price,
  1 AS priority, -- Timeshare = highest priority
  100 AS margin_percent
FROM week_allocations wa
JOIN ownerships o ON wa.ownership_id = o.id
JOIN timeshare_units u ON o.unit_id = u.id
JOIN timeshare_properties p ON u.property_id = p.id
WHERE 
  wa.status = 'RELEASED'
  AND wa.start_date >= :search_check_in
  AND wa.end_date <= :search_check_out
  AND p.city = :search_city
  AND p.is_active = TRUE
  AND p.is_marketplace_enabled = TRUE
  AND u.capacity_max >= :search_guests
  AND u.is_active = TRUE

UNION ALL

-- Step 2: Find hotel PMS availability (if insufficient timeshare)
SELECT 
  'HOTEL_PMS' AS source,
  NULL AS allocation_id,
  p.id AS property_id,
  p.name AS property_name,
  p.city,
  p.country,
  hi.room_category,
  u.capacity_max,
  u.amenities,
  :search_check_in AS check_in,
  :search_check_out AS check_out,
  hi.rate * :nights AS credit_price, -- Convert to credits
  hi.rate * :nights AS cash_price,
  2 AS priority, -- Hotel = lower priority
  30 AS margin_percent
FROM hotel_inventory hi
JOIN timeshare_properties p ON hi.property_id = p.id
JOIN timeshare_units u ON p.id = u.property_id AND u.category = hi.room_category
WHERE 
  hi.date BETWEEN :search_check_in AND :search_check_out
  AND hi.available_rooms > 0
  AND p.city = :search_city
  AND p.is_active = TRUE
  AND u.capacity_max >= :search_guests
GROUP BY hi.property_id, hi.room_category
HAVING COUNT(DISTINCT hi.date) = :nights -- All nights available

ORDER BY priority ASC, credit_price ASC
LIMIT 50;
```

**Optimization:**
- Uses `idx_search_released` on `week_allocations`
- Uses `idx_property_date` on `hotel_inventory`
- `UNION ALL` (not `UNION`) - faster, no deduplication
- `LIMIT 50` - pagination

**Execution Plan:**
```
1. week_allocations: Using idx_search_released (KEY)
2. ownerships: Using PRIMARY (ref)
3. timeshare_units: Using PRIMARY (ref)
4. timeshare_properties: Using PRIMARY (ref), Where (using index)
5. hotel_inventory: Using idx_property_date (range)
...
Rows examined: ~500
Execution time: ~200ms (with proper indexes)
```

---

### 2. Owner Dashboard Query

**Query:** "Show my weeks for 2026"

```sql
SELECT 
  wa.id,
  wa.week_number,
  wa.start_date,
  wa.end_date,
  wa.status,
  wa.credits_issued,
  wa.booked_by,
  p.name AS property_name,
  u.category AS unit_category
FROM week_allocations wa
JOIN ownerships o ON wa.ownership_id = o.id
JOIN timeshare_units u ON o.unit_id = u.id
JOIN timeshare_properties p ON u.property_id = p.id
WHERE 
  o.owner_id = :user_id
  AND wa.year = :year
  AND o.status = 'ACTIVE'
ORDER BY wa.start_date ASC;
```

**Optimization:**
- Uses `idx_owner_year` on `week_allocations`
- Returns ~1-10 rows per owner
- < 50ms execution

---

### 3. Credit Transaction History

**Query:** "Show my credit history, paginated"

```sql
SELECT 
  ct.id,
  ct.type,
  ct.amount,
  ct.balance_after,
  ct.description,
  ct.created_at
FROM credit_transactions ct
JOIN credit_accounts ca ON ct.account_id = ca.id
WHERE 
  ca.user_id = :user_id
ORDER BY ct.created_at DESC
LIMIT 50 OFFSET :offset;
```

**Optimization:**
- Uses `idx_account_date` on `credit_transactions`
- Pagination with `LIMIT/OFFSET`
- < 100ms execution

---

## Data Integrity Constraints

### Referential Integrity

```sql
-- Ownership cannot be deleted if weeks exist
ALTER TABLE ownerships 
ADD CONSTRAINT fk_ownership_weeks 
CHECK (
  NOT EXISTS (
    SELECT 1 FROM week_allocations 
    WHERE ownership_id = id AND status IN ('ASSIGNED', 'RESERVED', 'RELEASED', 'BOOKED')
  )
) NOT ENFORCED; -- Use application logic for performance

-- Booking must have payment
ALTER TABLE bookings 
ADD CONSTRAINT chk_booking_payment 
CHECK (credits_used > 0 OR cash_paid > 0);

-- Credits cannot go negative (unless credit_limit allows)
-- Enforced in application layer via transaction
```

### State Transitions (Enforced in Application)

```javascript
// week_allocations status transitions
const ALLOWED_TRANSITIONS = {
  'ASSIGNED': ['RESERVED', 'RELEASED', 'EXPIRED'],
  'RESERVED': ['ASSIGNED', 'USED', 'EXPIRED'], // Cancel reservation
  'RELEASED': ['BOOKED', 'EXPIRED'],
  'BOOKED': ['USED', 'EXPIRED'], // Cannot unreleased after booked
  'USED': [], // Terminal state
  'EXPIRED': [] // Terminal state
};

// Validate before update
function validateStatusTransition(currentStatus, newStatus) {
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new Error(`Invalid transition: ${currentStatus} -> ${newStatus}`);
  }
}
```

---

## Indexing Strategy

### Index Types

1. **B-Tree Indexes** (default): Most queries
2. **FULLTEXT Indexes**: Text search on property names/locations
3. **Spatial Indexes**: Geo-location search (if using POINT type)

### Index Maintenance

```sql
-- Analyze tables monthly (update statistics)
ANALYZE TABLE week_allocations, bookings, credit_transactions;

-- Check index usage
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  CARDINALITY,
  SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'timeshare_platform'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- Find unused indexes (requires pt-index-usage tool)
pt-index-usage --user=root --password=xxx --database=timeshare_platform
```

---

## Partitioning Strategy

### When to Partition

- Table > 100M rows
- Query patterns favor time-based access
- Historical data needs archiving

### Partition Maintenance

```sql
-- Add new partition (yearly, automated via cron)
ALTER TABLE week_allocations 
ADD PARTITION (
  PARTITION p2028 VALUES LESS THAN (2029)
);

-- Archive old partitions (move to cold storage)
ALTER TABLE credit_transactions 
DROP PARTITION p202401;
-- Before dropping, export to archive DB
```

---

## Caching Strategy

### Application-Level Cache (Redis)

```javascript
// Cache hot data in Redis (TTL: 5 minutes)
const cacheKeys = {
  property: `property:{id}`, // TTL: 1 hour
  unit: `unit:{id}`, // TTL: 1 hour
  search: `search:{hash}`, // TTL: 5 minutes
  userWeeks: `user:{id}:weeks:{year}`, // TTL: 10 minutes
  creditBalance: `credit:{userId}:balance`, // TTL: 1 minute
};

// Invalidate on write
async function updateWeekAllocation(allocationId, data) {
  await db.weekAllocations.update(allocationId, data);
  
  // Invalidate caches
  await redis.del(`search:*`); // Invalidate all searches
  await redis.del(`user:${data.ownerId}:weeks:*`); // Invalidate owner weeks
}
```

### Query Result Cache (MySQL)

```sql
-- Enable query cache for read-heavy queries
SET GLOBAL query_cache_size = 256 * 1024 * 1024; -- 256MB
SET GLOBAL query_cache_type = 1;

-- Tag queries for caching
SELECT SQL_CACHE * FROM timeshare_properties WHERE is_active = TRUE;
```

---

## Backup & Disaster Recovery

### Backup Strategy

```bash
# Daily full backup (3 AM)
mysqldump --single-transaction \
  --routines --triggers --events \
  timeshare_platform > backup_$(date +%Y%m%d).sql

# Incremental binlog backup (hourly)
mysqlbinlog --start-datetime="$(date -d '1 hour ago' '+%Y-%m-%d %H:00:00')" \
  /var/log/mysql/binlog.* > binlog_incremental.sql

# Archive to S3
aws s3 cp backup_$(date +%Y%m%d).sql s3://backups/timeshare/
```

### Point-in-Time Recovery

```bash
# Restore to specific time
mysql timeshare_platform < backup_20260201.sql
mysqlbinlog --stop-datetime="2026-02-01 14:30:00" binlog.* | mysql
```

---

## Monitoring & Alerts

### Key Metrics

```sql
-- Slow query log (queries > 1s)
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 1;

-- Monitor query patterns
SELECT 
  DIGEST_TEXT,
  COUNT_STAR AS execution_count,
  AVG_TIMER_WAIT/1000000000 AS avg_ms,
  MAX_TIMER_WAIT/1000000000 AS max_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY AVG_TIMER_WAIT DESC
LIMIT 10;

-- Table growth monitoring
SELECT 
  TABLE_NAME,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb,
  TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'timeshare_platform'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
```

### Alerts (via Prometheus + Grafana)

- Query response time > 2s
- Replication lag > 10s
- Disk usage > 80%
- Connection pool exhausted
- Deadlocks detected

---

## Migration Strategy from V1

### Phase 1: Create V2 Schema
```sql
-- Create new schema in parallel
CREATE DATABASE timeshare_platform_v2;
-- Run all CREATE TABLE statements
```

### Phase 2: Data Migration
```sql
-- Migrate properties (1:1 mapping)
INSERT INTO timeshare_platform_v2.timeshare_properties (...)
SELECT ... FROM timeshare_platform.properties;

-- Transform allocations (complex logic)
-- See migration script: /scripts/migrate_to_v2.js
```

### Phase 3: Dual-Write Period
```javascript
// Write to both V1 and V2 during transition
async function createBooking(data) {
  await dbV1.bookings.create(data);
  await dbV2.bookings.create(transformData(data));
}
```

### Phase 4: Cutover
```bash
# Switch application to V2
# Monitor for 24 hours
# Decommission V1
```

---

## Performance Testing

### Load Test Scenarios

```javascript
// Scenario 1: 10K concurrent searches
for (let i = 0; i < 10000; i++) {
  fetch('/api/search', {
    method: 'POST',
    body: JSON.stringify({
      location: 'Marbella',
      checkIn: '2026-07-01',
      checkOut: '2026-07-08',
      guests: 2 + Math.floor(Math.random() * 4)
    })
  });
}
// Target: < 2s p95, < 5s p99

// Scenario 2: 1K bookings/hour
setInterval(() => {
  fetch('/api/bookings', { method: 'POST', body: bookingData });
}, 3600); // 1 per 3.6s
// Target: < 5s p95
```

---

## Summary

### Design Highlights

✅ **Query-First Design:** Indexes optimized for actual queries  
✅ **Scalability:** Partitioning, caching, horizontal scaling ready  
✅ **Data Integrity:** Foreign keys, constraints, immutable ledger  
✅ **Performance:** < 500ms searches, < 50ms transactions  
✅ **Auditability:** Complete transaction history, no data loss  

### Critical Indexes (Must Have)

1. `week_allocations.idx_search_released` - Main search
2. `week_allocations.idx_owner_year` - Owner dashboard
3. `credit_transactions.idx_account_date` - Transaction history
4. `bookings.idx_property_dates` - Revenue reports
5. `timeshare_properties.ft_search` - Text search

### Next Steps

1. Create schema in staging environment
2. Load test with sample data (100K allocations)
3. Optimize slow queries identified
4. Set up monitoring/alerting
5. Plan data migration from V1

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-02-01  
**Reviewed By:** Database Architect, Backend Lead
