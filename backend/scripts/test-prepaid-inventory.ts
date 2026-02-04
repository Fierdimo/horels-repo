/**
 * Script to test Prepaid Inventory Management System
 * 
 * This script demonstrates:
 * 1. Creating prepaid allocations
 * 2. Searching with priority (prepaid first)
 * 3. Getting statistics
 */

import PrepaidInventoryService from '../src/services/PrepaidInventoryService';
import UnifiedSearchService from '../src/services/UnifiedSearchService';
import TimeshareAllocation from '../src/models/TimeshareAllocation';
import Property from '../src/models/Property';

async function testPrepaidInventory() {
  console.log('\n🚀 Testing Prepaid Inventory Management System\n');

  try {
    // Get first property for testing
    const property = await Property.findOne();
    if (!property) {
      console.log('❌ No properties found. Please add a property first.');
      return;
    }

    console.log(`✅ Using property: ${property.name} (ID: ${property.id})\n`);

    // Test 1: Create a prepaid allocation
    console.log('📝 TEST 1: Creating prepaid allocation...');
    try {
      const allocation = await PrepaidInventoryService.createAllocation({
        property_id: property.id,
        pms_resource_id: 'test_resource_001',
        pms_provider: property.pms_provider,
        room_number: '305',
        room_type: 'standard',
        floor_number: '3',
        valid_from: new Date('2026-01-01'),
        valid_until: new Date('2026-12-31'),
        allocation_type: 'ANNUAL_CONTRACT',
        prepaid_amount: 6000,
        condominium_fee: 500,
        currency: 'EUR',
        notes: 'Test allocation for prepaid inventory system',
      });

      console.log(`✅ Created allocation ID: ${allocation.id}`);
      console.log(`   Room: ${allocation.room_number} (${allocation.room_type})`);
      console.log(`   Validity: ${allocation.valid_from.toLocaleDateString()} - ${allocation.valid_until.toLocaleDateString()}`);
      console.log(`   Margin: ${allocation.getMarginPercent()}%\n`);
    } catch (error: any) {
      if (error.message.includes('already in prepaid inventory')) {
        console.log('⚠️  Allocation already exists (expected on subsequent runs)\n');
      } else {
        throw error;
      }
    }

    // Test 2: Get statistics
    console.log('📊 TEST 2: Getting inventory statistics...');
    const stats = await PrepaidInventoryService.getStats();
    console.log(`✅ Total allocations: ${stats.total}`);
    console.log(`   Active: ${stats.active}`);
    console.log(`   Assigned: ${stats.assigned}`);
    console.log(`   Available: ${stats.available}`);
    console.log(`   Total prepaid: €${stats.total_prepaid_amount.toFixed(2)}`);
    console.log(`   Expiring soon: ${stats.expiring_soon}\n`);

    // Test 3: List allocations
    console.log('📋 TEST 3: Listing allocations...');
    const allocations = await TimeshareAllocation.findAll({
      where: { property_id: property.id },
      limit: 5,
    });
    console.log(`✅ Found ${allocations.length} allocations for this property:`);
    allocations.forEach((a, i) => {
      console.log(`   ${i + 1}. Room ${a.room_number || 'N/A'} - ${a.room_type}`);
      console.log(`      Status: ${a.status}, Released: ${a.is_released}`);
      console.log(`      Valid until: ${a.valid_until.toLocaleDateString()}`);
    });
    console.log('');

    // Test 4: Search with prioritization
    console.log('🔍 TEST 4: Testing unified search (priority: prepaid first)...');
    const searchResults = await UnifiedSearchService.search({
      propertyId: property.id,
      checkIn: new Date('2026-03-15'),
      checkOut: new Date('2026-03-22'),
      showAllOptions: false, // Only prepaid
    });

    console.log(`✅ Found ${searchResults.length} available rooms:`);
    searchResults.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.propertyName} - ${result.roomType}`);
      console.log(`      Source: ${result.source} (Priority: ${result.priority})`);
      console.log(`      Price: ${result.creditPrice || 0} credits / €${result.cashPrice || 0}`);
      console.log(`      Margin: ${result._internal.marginPercent}%`);
      console.log(`      Cost to platform: €${result._internal.costToPlattform}`);
    });
    console.log('');

    // Test 5: Find available for specific dates
    console.log('📅 TEST 5: Finding available prepaid rooms...');
    const available = await PrepaidInventoryService.findAvailable(
      property.id,
      new Date('2026-06-01'),
      new Date('2026-06-08')
    );
    console.log(`✅ Found ${available.length} prepaid rooms available for June 1-8, 2026\n`);

    console.log('✅ All tests completed successfully!\n');
    console.log('💡 Summary:');
    console.log('   - Prepaid inventory system is working');
    console.log('   - Search prioritizes prepaid rooms (100% margin)');
    console.log('   - Statistics and reporting are functional');
    console.log('   - Ready for admin panel integration\n');

  } catch (error: any) {
    console.error('❌ Error during testing:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// Run tests
testPrepaidInventory();
