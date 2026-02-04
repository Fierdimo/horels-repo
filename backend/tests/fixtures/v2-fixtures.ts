/**
 * Test Fixtures for Integration Tests
 * Provides reusable test data factories
 */

/**
 * Create test user (V1 table but needed for FK)
 * Uses raw SQL to avoid mixing V1 models with V2 tests
 */
export async function createTestUser(sequelize: any, overrides: Partial<any> = {}) {
  const timestamp = Date.now();
  const email = overrides.email || `test${timestamp}@example.com`;
  const password_hash = overrides.password_hash || '$2b$10$examplehash';
  const first_name = overrides.first_name || 'Test';
  const last_name = overrides.last_name || 'User';
  const role = overrides.role || 'owner';
  const status = overrides.status || 'active';
  
  const [result] = await sequelize.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, {
    replacements: [email, password_hash, first_name, last_name, role, status]
  });
  
  return {
    id: result,
    email,
    first_name,
    last_name,
    role,
    status,
  };
}

/**
 * Create test timeshare property
 */
export async function createTestProperty(sequelize: any, overrides: Partial<any> = {}) {
  const { TimeshareProperty } = sequelize.models;
  const timestamp = Date.now();
  return await TimeshareProperty.create({
    name: 'Beach Resort Marbella',
    slug: `beach-resort-marbella-${timestamp}`,
    city: 'Marbella',
    region: 'Andalusia',
    country: 'Spain',
    address: 'Avenida del Mar 123',
    latitude: 36.5118,
    longitude: -4.8833,
    pms_provider: 'mews',
    pms_property_id: 'TEST-PROP-001',
    // Note: pms_credentials_encrypted is a BLOB, not JSON
    // For tests, we skip encryption
    program_type: 'FLOATING',
    is_active: true,
    is_marketplace_enabled: true,
    ...overrides,
  });
}

/**
 * Create test timeshare unit
 */
export async function createTestUnit(
  sequelize: any,
  propertyId: number,
  overrides: Partial<any> = {}
) {
  const { TimeshareUnit } = sequelize.models;
  const timestamp = Date.now();
  return await TimeshareUnit.create({
    property_id: propertyId,
    category: '2BR Oceanview',
    slug: `2br-oceanview-${timestamp}`,
    capacity_min: 4,
    capacity_max: 6,
    quantity: 10,
    bedrooms: 2,
    bathrooms: 2.0,
    base_credit_value: 1000,
    seasonal_factors: {
      summer: 1.2,
      winter: 0.8,
      spring: 1.0,
      fall: 0.9,
    },
    currency: 'EUR',
    is_active: true,
    description: 'Spacious 2-bedroom with ocean view',
    amenities: ['Kitchen', 'Balcony', 'Ocean View'],
    images: [],
    ...overrides,
  });
}

/**
 * Create test ownership
 */
export async function createTestOwnership(
  sequelize: any,
  ownerId: number,
  unitId: number,
  overrides: Partial<any> = {}
) {
  const { Ownership } = sequelize.models;
  return await Ownership.create({
    owner_id: ownerId,
    unit_id: unitId,
    type: 'FLOATING',
    contract_start_year: 2020,
    fixed_week_number: null,
    annual_points: 1200,
    purchase_date: new Date('2020-01-01'),
    contract_reference: 'CONTRACT-001',
    annual_fee: 800,
    currency: 'EUR',
    status: 'ACTIVE',
    ...overrides,
  });
}

/**
 * Create test week allocation
 * Note: UNIQUE constraint on (ownership_id, year, week_number)
 * If creating multiple weeks for same ownership/year, use different week_numbers or NULL
 */
export async function createTestWeekAllocation(
  sequelize: any,
  ownershipId: number,
  overrides: Partial<any> = {}
) {
  const { WeekAllocation } = sequelize.models;
  const startDate = overrides.start_date || new Date('2026-07-01');
  
  // Calculate end_date as start_date + 7 days if not provided
  const endDate = overrides.end_date || new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Calculate week_number from start_date if not provided
  let week_number = overrides.week_number;
  if (week_number === undefined) {
    const weekOfYear = Math.ceil((startDate.getTime() - new Date(startDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    week_number = weekOfYear;
  }

  return await WeekAllocation.create({
    ownership_id: ownershipId,
    year: overrides.year || 2026,
    week_number,
    start_date: startDate,
    end_date: endDate,
    status: 'ASSIGNED',
    ...overrides,
  });
}

/**
 * Create test credit account
 */
export async function createTestCreditAccount(
  sequelize: any,
  userId: number,
  overrides: Partial<any> = {}
) {
  const { CreditAccount } = sequelize.models;
  return await CreditAccount.create({
    user_id: userId,
    balance: 0,
    currency: 'EUR',
    ...overrides,
  });
}

/**
 * Create test credit transaction
 */
export async function createTestCreditTransaction(
  sequelize: any,
  accountId: number,
  overrides: Partial<any> = {}
) {
  const { CreditTransaction } = sequelize.models;
  return await CreditTransaction.create({
    account_id: accountId,
    type: 'WEEK_RELEASE',
    amount: 1000,
    balance_before: 0,
    balance_after: 1000,
    description: 'Test transaction',
    ...overrides,
  });
}

/**
 * Create test booking
 */
export async function createTestBooking(
  sequelize: any,
  guestId: number,
  propertyId: number,
  overrides: Partial<any> = {}
) {
  const { V2Booking } = sequelize.models;
  const timestamp = Date.now();
  return await V2Booking.create({
    confirmation_code: `BK${timestamp}`,
    guest_id: guestId,
    property_id: propertyId,
    source: 'TIMESHARE',
    check_in: new Date('2026-07-01'),
    check_out: new Date('2026-07-08'),
    nights: 7,
    guests: 4,
    room_category: '2BR Oceanview',
    credits_used: 1200,
    cash_paid: 0,
    currency: 'EUR',
    platform_cost: 0,
    platform_revenue: 1200,
    margin_percent: 100,
    status: 'CONFIRMED',
    guest_name: 'Test Guest',
    guest_email: 'test@example.com',
    ...overrides,
  });
}

/**
 * Create test hotel inventory
 */
export async function createTestHotelInventory(
  sequelize: any,
  propertyId: number,
  overrides: Partial<any> = {}
) {
  const { HotelInventory } = sequelize.models;
  return await HotelInventory.create({
    property_id: propertyId,
    date: new Date('2026-07-01'),
    room_category: 'Deluxe Suite',
    total_rooms: 10,
    available_rooms: 5,
    rate: 150,
    currency: 'EUR',
    last_synced: new Date(),
    ...overrides,
  });
}

/**
 * Create complete test scenario (property + unit + ownership + week)
 */
export async function createCompleteTestScenario(sequelize: any, userId: number) {
  const property = await createTestProperty(sequelize);
  const unit = await createTestUnit(sequelize, property.id);
  const ownership = await createTestOwnership(sequelize, userId, unit.id);
  const week = await createTestWeekAllocation(sequelize, ownership.id);
  const account = await createTestCreditAccount(sequelize, userId);

  return {
    property,
    unit,
    ownership,
    week,
    account,
  };
}

