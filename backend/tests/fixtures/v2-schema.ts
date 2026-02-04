/**
 * V2 Database Schema Helpers
 * 
 * AUTO-GENERATED from actual database structure.
 * Run: npm run document:schema
 * 
 * Generated: 2026-02-01T21:02:00.445Z
 */

/**
 * Required fields for each V2 table.
 * Use this to ensure fixtures include all mandatory fields.
 */
export const V2_REQUIRED_FIELDS = {
  users: [
    'email',
    'password_hash',
    'first_name',
    'last_name',
    'role',
    'status',
    'created_at',
    'updated_at',
  ] as const,
  timeshare_properties: [
    'name',
    'slug',
    'city',
    'country',
    'pms_provider',
    'program_type',
    'is_active',
    'is_marketplace_enabled',
    'created_at',
    'updated_at',
  ] as const,
  timeshare_units: [
    'property_id',
    'category',
    'slug',
    'capacity_min',
    'capacity_max',
    'quantity',
    'base_credit_value',
    'seasonal_factors',
    'currency',
    'is_active',
    'created_at',
    'updated_at',
  ] as const,
  ownerships: [
    'owner_id',
    'unit_id',
    'type',
    'contract_start_year',
    'annual_fee',
    'currency',
    'status',
    'created_at',
    'updated_at',
  ] as const,
  week_allocations: [
    'ownership_id',
    'year',
    'start_date',
    'end_date',
    'status',
    'created_at',
    'updated_at',
  ] as const,
  credit_accounts: [
    'user_id',
    'balance',
    'currency',
    'created_at',
    'updated_at',
  ] as const,
  credit_transactions: [
    'account_id',
    'type',
    'amount',
    'balance_before',
    'balance_after',
    'description',
    'created_at',
  ] as const,
  v2_bookings: [
    'confirmation_code',
    'guest_id',
    'property_id',
    'check_in',
    'check_out',
    'nights',
    'guests',
    'room_category',
    'source',
    'credits_used',
    'cash_paid',
    'currency',
    'platform_cost',
    'platform_revenue',
    'margin_percent',
    'status',
    'guest_name',
    'guest_email',
    'created_at',
    'updated_at',
  ] as const,
  hotel_inventory: [
    'property_id',
    'date',
    'room_category',
    'total_rooms',
    'available_rooms',
    'rate',
    'currency',
    'last_synced',
  ] as const,
};

/**
 * ENUM values extracted from database
 */
export const V2_ENUMS = {
};

/**
 * Default values from database
 */
export const V2_DEFAULTS = {
  users: {
    role: 'guest',
    status: 'active',
    email_verified: '0',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  timeshare_properties: {
    pms_sync_status: 'OK',
    weeks_per_year: '52',
    check_in_day: 'SATURDAY',
    is_active: '1',
    is_marketplace_enabled: '1',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  timeshare_units: {
    capacity_min: '1',
    bedrooms: '0',
    bathrooms: '1.0',
    currency: 'EUR',
    view_type: 'NO_VIEW',
    is_active: '1',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  ownerships: {
    currency: 'EUR',
    status: 'ACTIVE',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  week_allocations: {
    status: 'ASSIGNED',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  credit_accounts: {
    balance: '0.00',
    expiration_policy: '2_YEARS',
    currency: 'EUR',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  credit_transactions: {
    created_at: 'CURRENT_TIMESTAMP',
  },
  v2_bookings: {
    credits_used: '0.00',
    cash_paid: '0.00',
    currency: 'EUR',
    payment_status: 'PENDING',
    platform_cost: '0.00',
    status: 'PENDING',
    created_at: 'CURRENT_TIMESTAMP',
    updated_at: 'CURRENT_TIMESTAMP',
  },
  hotel_inventory: {
    currency: 'EUR',
    last_synced: 'CURRENT_TIMESTAMP',
    is_stale: '0',
  },
};

/**
 * Validate that a fixture object has all required fields
 */
export function validateFixture(tableName: keyof typeof V2_REQUIRED_FIELDS, data: any): void {
  const required = V2_REQUIRED_FIELDS[tableName];
  const missing = required.filter((field) => !(field in data));
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required fields for ${tableName}: ${missing.join(', ')}`
    );
  }
}
