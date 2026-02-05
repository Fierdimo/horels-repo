/**
 * Seed Script: Migrate Mock PMS Data to V2 Real Database
 * 
 * Purpose: Bootstrap initial data from Mock PMS into timeshare_properties,
 * timeshare_units, and week_allocations tables. After this, the system
 * operates independently from Mock PMS.
 * 
 * Run: npm run seed:mock-pms
 */

import sequelize from '../config/database';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import WeekAllocation from '../models/v2/WeekAllocation';
import Ownership from '../models/v2/Ownership';
import CreditAccount from '../models/v2/CreditAccount';
import UserV2 from '../models/v2/User';
import { initV2Models } from '../models/v2';
import { MockPMSManager } from '../services/pms/MockPMSService';

async function seedFromMockPMS() {
  console.log('🌱 Starting Mock PMS data migration to V2 database...\n');

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Initialize V2 models
    initV2Models(sequelize);
    console.log('✅ V2 Models initialized\n');

    // Initialize Mock PMS
    const mockPMS = new MockPMSManager();
    const mockProperties = mockPMS.getAllProperties();

    console.log(`📦 Found ${mockProperties.length} properties in Mock PMS\n`);

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Create Timeshare Properties
      console.log('📍 Step 1: Creating Timeshare Properties...');
      const propertyMap = new Map<string, number>();

      for (const mockProp of mockProperties) {
        const property = await TimeshareProperty.create({
          name: mockProp.name,
          slug: mockProp.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          address: mockProp.address,
          city: mockProp.city,
          region: mockProp.city, // Use city as region
          country: mockProp.country,
          postal_code: '00000',
          latitude: null,
          longitude: null,
          description: mockProp.description,
          amenities: mockProp.amenities ? JSON.stringify(mockProp.amenities) : null,
          images: mockProp.images ? JSON.stringify(mockProp.images) : null,
          pms_provider: 'other', // Mock PMS uses 'other' enum value
          pms_property_id: mockProp.id,
          pms_integration_status: 'active',
          timeshare_type: 'FLOATING', // All mock properties are floating
          program_type: 'FLOATING', // Use FLOATING instead of WEEKS
          condominium_fee_currency: 'EUR',
          is_active: true
        }, { transaction });

        propertyMap.set(mockProp.id, property.id);
        console.log(`  ✓ Created: ${property.name} (ID: ${property.id})`);
      }

      console.log(`✅ Created ${propertyMap.size} properties\n`);

      // Step 2: Create Timeshare Units
      console.log('🏠 Step 2: Creating Timeshare Units...');
      const unitMap = new Map<string, number>();
      let totalUnits = 0;

      for (const mockProp of mockProperties) {
        const propertyId = propertyMap.get(mockProp.id);
        if (!propertyId) continue;

        const roomTypes = mockPMS.getRoomTypes(mockProp.id);
        const usedCategories = new Set<string>();

        for (const roomType of roomTypes) {
          // Map room type to category
          let category: 'STUDIO' | '1BR' | '2BR' | 'PENTHOUSE' = 'STUDIO';
          if (roomType.name.includes('Presidential') || roomType.name.includes('Suite')) {
            category = 'PENTHOUSE';
          } else if (roomType.name.includes('2 Bed')) {
            category = '2BR';
          } else if (roomType.name.includes('1 Bed')) {
            category = '1BR';
          } else {
            category = 'STUDIO';
          }

          // Skip if category already used for this property
          if (usedCategories.has(category)) {
            console.log(`  ⊘ Skipped: ${roomType.name} (${category} already exists)`);
            continue;
          }
          usedCategories.add(category);

          const slug = `${roomType.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;

          const unit = await TimeshareUnit.create({
            property_id: propertyId,
            name: roomType.name,
            slug: slug,
            category: category,
            description: roomType.description,
            max_occupancy: roomType.capacity,
            capacity_max: roomType.capacity,
            bedrooms: 0,
            bathrooms: 1,
            size_sqm: null,
            quantity: roomType.quantity,
            base_credit_value: roomType.basePrice, // Use price as credit value
            seasonal_factors: JSON.stringify({ high: 1.5, medium: 1.0, low: 0.7 }),
            amenities: roomType.amenities ? JSON.stringify(roomType.amenities) : null,
            images: roomType.images ? JSON.stringify(roomType.images) : null,
            is_active: true
          }, { transaction });

          unitMap.set(`${mockProp.id}-${roomType.id}`, unit.id);
          totalUnits++;
          const unitData: any = unit.toJSON();
          console.log(`  ✓ Created: ${unitData.name} at ${mockProp.name} (${unitData.quantity} units)`);
        }
      }

      console.log(`✅ Created ${totalUnits} timeshare units\n`);

      // Step 3: Create Admin User (for ownerships)
      console.log('👤 Step 3: Creating admin user for mock ownerships...');
      
      const adminUser = await UserV2.findOne({ 
        where: { email: 'admin@hotelplatform.com' },
        transaction 
      });

      let ownerId: number;
      if (adminUser) {
        ownerId = adminUser.id;
        console.log(`  ✓ Using existing admin user (ID: ${ownerId})`);
      } else {
        const newAdmin = await UserV2.create({
          email: 'admin@hotelplatform.com',
          password_hash: '$2b$10$dummyhashforseeding',
          first_name: 'Platform',
          last_name: 'Admin',
          role: 'admin',
          status: 'approved',
          email_verified: true
        }, { transaction });
        ownerId = newAdmin.id;
        console.log(`  ✓ Created new admin user (ID: ${ownerId})`);
      }

      // Step 4: Create Mock Ownerships
      console.log('\n📋 Step 4: Creating mock ownerships...');
      const ownershipMap = new Map<number, number>();
      
      for (const [key, unitId] of unitMap.entries()) {
        const ownership = await Ownership.create({
          owner_id: ownerId,
          unit_id: unitId,
          type: 'FLOATING',
          weeks_per_year: 1,
          start_date: new Date('2024-01-01'),
          contract_start_year: 2024,
          contract_number: `MOCK-${key}`,
          purchase_date: new Date('2024-01-01'),
          annual_fee: 500, // Mock annual fee
          status: 'ACTIVE'
        }, { transaction });

        ownershipMap.set(unitId, ownership.id);
      }

      console.log(`✅ Created ${ownershipMap.size} ownerships\n`);

      // Step 5: Create Week Allocations (2026)
      console.log('📅 Step 5: Creating week allocations for 2026...');
      let totalAllocations = 0;
      const currentYear = 2026;

      for (const [unitId, ownershipId] of ownershipMap.entries()) {
        // Create one allocation per ownership (week 1-52)
        const weekNumber = (totalAllocations % 52) + 1;
        
        // Calculate dates for the week
        const startDate = new Date(currentYear, 0, 1 + (weekNumber - 1) * 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const allocation = await WeekAllocation.create({
          ownership_id: ownershipId,
          year: currentYear,
          week_number: weekNumber,
          start_date: startDate,
          end_date: endDate,
          status: 'RELEASED', // All weeks available for marketplace
          nights: 7,
          max_occupancy: 4
        }, { transaction });

        totalAllocations++;
      }

      console.log(`✅ Created ${totalAllocations} week allocations\n`);

      // Step 6: Create Credit Account for Admin
      console.log('💳 Step 6: Creating credit account...');
      
      const existingAccount = await CreditAccount.findOne({
        where: { user_id: ownerId },
        transaction
      });

      if (!existingAccount) {
        await CreditAccount.create({
          user_id: ownerId,
          balance: 10000, // Initial credits for testing
          currency: 'EUR'
        }, { transaction });
        console.log(`  ✓ Created credit account with 10,000 credits\n`);
      } else {
        console.log(`  ✓ Credit account already exists\n`);
      }

      // Commit transaction
      await transaction.commit();

      // Summary
      console.log('═══════════════════════════════════════════════');
      console.log('✅ SEED COMPLETED SUCCESSFULLY');
      console.log('═══════════════════════════════════════════════');
      console.log(`📍 Properties:     ${propertyMap.size}`);
      console.log(`🏠 Units:          ${totalUnits}`);
      console.log(`📋 Ownerships:     ${ownershipMap.size}`);
      console.log(`📅 Allocations:    ${totalAllocations} (all RELEASED for marketplace)`);
      console.log(`👤 Owner:          admin@hotelplatform.com`);
      console.log('\n🎯 Next Steps:');
      console.log('   1. Update marketplace to read from timeshare_properties');
      console.log('   2. Update staff dashboard to read from real data');
      console.log('   3. Test booking flow with real week_allocations');
      console.log('═══════════════════════════════════════════════\n');

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run seed
seedFromMockPMS();
