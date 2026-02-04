# V2 Database Schema

**Generated:** 2026-02-01T21:02:00.445Z  
**Database:** sw2_db

> ⚠️ **SOURCE OF TRUTH**: This file is auto-generated from the actual database.  
> Run `npm run document:schema` to update.

---

## users

### ✅ Required Fields
- **email** (VARCHAR(255))
- **password_hash** (VARCHAR(255))
- **first_name** (VARCHAR(100))
- **last_name** (VARCHAR(100))
- **role** (ENUM('admin','owner','guest','staff')) [default: `guest`]
- **status** (ENUM('active','suspended','inactive')) [default: `active`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **phone** (VARCHAR(50))
- **email_verified** (TINYINT(1)) [default: `0`]
- **email_verified_at** (DATETIME)
- **last_login_at** (DATETIME)
- **stripe_customer_id** (VARCHAR(255))
- **password_reset_token** (VARCHAR(255))
- **password_reset_expires** (DATETIME)

---

## timeshare_properties

### ✅ Required Fields
- **name** (VARCHAR(255))
- **slug** (VARCHAR(255))
- **city** (VARCHAR(100))
- **country** (VARCHAR(100))
- **pms_provider** (ENUM('mews','cloudbeds','opera','resnexus','other'))
- **program_type** (ENUM('FIXED_WEEK','FLOATING','POINTS'))
- **is_active** (TINYINT(1)) [default: `1`]
- **is_marketplace_enabled** (TINYINT(1)) [default: `1`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **region** (VARCHAR(100))
- **latitude** (DECIMAL(10,8))
- **longitude** (DECIMAL(11,8))
- **address** (TEXT)
- **postal_code** (VARCHAR(20))
- **pms_property_id** (VARCHAR(255))
- **pms_credentials_encrypted** (BLOB)
- **pms_last_sync** (DATETIME)
- **pms_sync_status** (ENUM('OK','ERROR','DISABLED')) [default: `OK`]
- **weeks_per_year** (TINYINT(3) UNSIGNED) [default: `52`]
- **check_in_day** (ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')) [default: `SATURDAY`]
- **description** (TEXT)
- **amenities** (LONGTEXT)
- **policies** (LONGTEXT)
- **images** (LONGTEXT)

---

## timeshare_units

### ✅ Required Fields
- **property_id** (INT(10) UNSIGNED)
- **category** (VARCHAR(100))
- **slug** (VARCHAR(150))
- **capacity_min** (TINYINT(3) UNSIGNED) [default: `1`]
- **capacity_max** (TINYINT(3) UNSIGNED)
- **quantity** (SMALLINT(5) UNSIGNED)
- **base_credit_value** (DECIMAL(10,2))
- **seasonal_factors** (LONGTEXT)
- **currency** (VARCHAR(3)) [default: `EUR`]
- **is_active** (TINYINT(1)) [default: `1`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **bedrooms** (TINYINT(3) UNSIGNED) [default: `0`]
- **bathrooms** (DECIMAL(2,1)) [default: `1.0`]
- **size_sqm** (SMALLINT(5) UNSIGNED)
- **floor_range** (VARCHAR(50))
- **description** (TEXT)
- **amenities** (LONGTEXT)
- **images** (LONGTEXT)
- **view_type** (ENUM('OCEAN','POOL','GARDEN','CITY','MOUNTAIN','NO_VIEW')) [default: `NO_VIEW`]

---

## ownerships

### ✅ Required Fields
- **owner_id** (INT(10) UNSIGNED)
- **unit_id** (INT(10) UNSIGNED)
- **type** (ENUM('FIXED_WEEK','FLOATING','POINTS'))
- **contract_start_year** (INT(10) UNSIGNED)
- **annual_fee** (DECIMAL(10,2))
- **currency** (VARCHAR(3)) [default: `EUR`]
- **status** (ENUM('ACTIVE','SUSPENDED','TERMINATED','PENDING_PAYMENT')) [default: `ACTIVE`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **fixed_week_number** (TINYINT(3) UNSIGNED)
- **annual_points** (SMALLINT(5) UNSIGNED)
- **purchase_date** (DATE)
- **contract_reference** (VARCHAR(255))
- **contract_end_year** (INT(10) UNSIGNED)
- **annual_fee_due_date** (DATE)
- **last_payment_date** (DATE)
- **suspension_reason** (TEXT)
- **notes** (TEXT)
- **metadata** (LONGTEXT)

---

## week_allocations

### ✅ Required Fields
- **ownership_id** (INT(10) UNSIGNED)
- **year** (INT(10) UNSIGNED)
- **start_date** (DATE)
- **end_date** (DATE)
- **status** (ENUM('ASSIGNED','RESERVED','RELEASED','BOOKED','USED','EXPIRED')) [default: `ASSIGNED`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **week_number** (TINYINT(3) UNSIGNED)
- **released_at** (DATETIME)
- **credits_issued** (DECIMAL(10,2))
- **release_credit_calc** (LONGTEXT)
- **booking_id** (INT(10) UNSIGNED)
- **booked_by** (INT(10) UNSIGNED)
- **booked_at** (DATETIME)
- **pms_booking_id** (VARCHAR(255))
- **pms_booking_status** (VARCHAR(50))
- **physical_room_assigned** (VARCHAR(100))
- **pms_last_sync** (DATETIME)

---

## credit_accounts

### ✅ Required Fields
- **user_id** (INT(10) UNSIGNED)
- **balance** (DECIMAL(10,2)) [default: `0.00`]
- **currency** (VARCHAR(3)) [default: `EUR`]
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **credit_limit** (DECIMAL(10,2))
- **expiration_policy** (ENUM('NEVER','1_YEAR','2_YEARS')) [default: `2_YEARS`]
- **notes** (TEXT)
- **last_transaction_at** (DATETIME)

---

## credit_transactions

### ✅ Required Fields
- **account_id** (INT(10) UNSIGNED)
- **type** (ENUM('WEEK_RELEASE','WEEK_BOOKING','CREDIT_PURCHASE','CREDIT_EXPIRATION','CONDOMINIUM_PAYMENT','REFUND','ADJUSTMENT','BONUS','PENALTY'))
- **amount** (DECIMAL(10,2))
- **balance_before** (DECIMAL(10,2))
- **balance_after** (DECIMAL(10,2))
- **description** (VARCHAR(500))
- **created_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (BIGINT(20) UNSIGNED) [auto_increment]
- **reference_type** (VARCHAR(50))
- **reference_id** (INT(10) UNSIGNED)
- **metadata** (LONGTEXT)
- **created_by** (INT(10) UNSIGNED)
- **ip_address** (VARCHAR(45))
- **user_agent** (TEXT)

---

## v2_bookings

### ✅ Required Fields
- **confirmation_code** (VARCHAR(20))
- **guest_id** (INT(10) UNSIGNED)
- **property_id** (INT(10) UNSIGNED)
- **check_in** (DATE)
- **check_out** (DATE)
- **nights** (TINYINT(3) UNSIGNED)
- **guests** (TINYINT(3) UNSIGNED)
- **room_category** (VARCHAR(100))
- **source** (ENUM('TIMESHARE','HOTEL_PMS'))
- **credits_used** (DECIMAL(10,2)) [default: `0.00`]
- **cash_paid** (DECIMAL(10,2)) [default: `0.00`]
- **currency** (VARCHAR(3)) [default: `EUR`]
- **platform_cost** (DECIMAL(10,2)) [default: `0.00`]
- **platform_revenue** (DECIMAL(10,2))
- **margin_percent** (DECIMAL(5,2))
- **status** (ENUM('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')) [default: `PENDING`]
- **guest_name** (VARCHAR(255))
- **guest_email** (VARCHAR(255))
- **created_at** (DATETIME) [default: `current_timestamp()`]
- **updated_at** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (INT(10) UNSIGNED) [auto_increment]
- **week_allocation_id** (INT(10) UNSIGNED)
- **physical_room** (VARCHAR(100))
- **payment_status** (ENUM('PENDING','COMPLETED','REFUNDED')) [default: `PENDING`]
- **cancellation_reason** (TEXT)
- **cancelled_at** (DATETIME)
- **pms_booking_id** (VARCHAR(255))
- **pms_provider** (VARCHAR(50))
- **pms_status** (VARCHAR(50))
- **pms_last_sync** (DATETIME)
- **guest_phone** (VARCHAR(50))
- **special_requests** (TEXT)
- **internal_notes** (TEXT)
- **confirmed_at** (DATETIME)

---

## hotel_inventory

### ✅ Required Fields
- **property_id** (INT(10) UNSIGNED)
- **date** (DATE)
- **room_category** (VARCHAR(100))
- **total_rooms** (SMALLINT(5) UNSIGNED)
- **available_rooms** (SMALLINT(5) UNSIGNED)
- **rate** (DECIMAL(10,2))
- **currency** (VARCHAR(3)) [default: `EUR`]
- **last_synced** (DATETIME) [default: `current_timestamp()`]

### 🔹 Optional Fields
- **id** (BIGINT(20) UNSIGNED) [auto_increment]
- **source** (VARCHAR(50))
- **is_stale** (TINYINT(1)) [default: `0`]

---

