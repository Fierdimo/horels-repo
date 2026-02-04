/**
 * Test script para verificar el endpoint /api/owner/weeks
 * 
 * Usuario: jon.bonachon@test.com (ID: 10)
 */

const { Ownership, WeekAllocation, TimeshareUnit, TimeshareProperty } = require('./src/models/v2');

async function testOwnerWeeks() {
  try {
    const userId = 10; // jon.bonachon@test.com
    const year = 2026;
    
    console.log(`\n🔍 Testing /api/owner/weeks for user ${userId}, year ${year}\n`);
    
    // Step 1: Get ownerships
    console.log('Step 1: Fetching ownerships...');
    const ownerships = await Ownership.findAll({
      where: {
        owner_id: userId,
        status: 'ACTIVE'
      },
      include: [
        {
          model: TimeshareUnit,
          as: 'unit',
          include: [
            {
              model: TimeshareProperty,
              as: 'property'
            }
          ]
        }
      ]
    });
    
    console.log(`✅ Found ${ownerships.length} ownerships`);
    ownerships.forEach((o) => {
      console.log(`   - Ownership ${o.id}: Unit ${o.unit.name} at ${o.unit.property.name}`);
    });
    
    if (ownerships.length === 0) {
      console.log('\n❌ No ownerships found!');
      process.exit(1);
    }
    
    // Step 2: Get week allocations
    console.log('\nStep 2: Fetching week allocations...');
    const ownershipIds = ownerships.map(o => o.id);
    console.log(`   Looking in ownership IDs: ${ownershipIds.join(', ')}`);
    
    const weekAllocations = await WeekAllocation.findAll({
      where: {
        ownership_id: ownershipIds,
        year: year
      },
      include: [
        {
          model: Ownership,
          as: 'ownership',
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property'
                }
              ]
            }
          ]
        }
      ],
      order: [['week_number', 'ASC']]
    });
    
    console.log(`✅ Found ${weekAllocations.length} week allocations\n`);
    
    if (weekAllocations.length === 0) {
      console.log('❌ No week allocations found!');
      console.log('\n🔍 Debugging info:');
      console.log(`   - Ownership IDs: ${ownershipIds.join(', ')}`);
      console.log(`   - Year: ${year}`);
      
      // Check if there are ANY allocations for these ownerships
      const allAllocations = await WeekAllocation.findAll({
        where: {
          ownership_id: ownershipIds
        }
      });
      console.log(`   - Total allocations (any year): ${allAllocations.length}`);
      if (allAllocations.length > 0) {
        allAllocations.forEach(a => {
          console.log(`     * Allocation ${a.id}: Year ${a.year}, Week ${a.week_number}, Status: ${a.status}`);
        });
      }
      
      process.exit(1);
    }
    
    // Step 3: Format response
    console.log('📋 Week Allocations Details:\n');
    weekAllocations.forEach((allocation) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Week Allocation ID: ${allocation.id}`);
      console.log(`Year: ${allocation.year}`);
      console.log(`Week Number: ${allocation.week_number}`);
      console.log(`Dates: ${allocation.start_date} to ${allocation.end_date}`);
      console.log(`Status: ${allocation.status}`);
      console.log(`Ownership ID: ${allocation.ownership_id}`);
      console.log(`Property: ${allocation.ownership.unit.property.name}`);
      console.log(`City: ${allocation.ownership.unit.property.city}, ${allocation.ownership.unit.property.country}`);
      console.log(`Unit: ${allocation.ownership.unit.name} (${allocation.ownership.unit.category})`);
      console.log(`Contract: ${allocation.ownership.contract_reference}`);
    });
    
    console.log(`\n✅ Test passed! Endpoint should return ${weekAllocations.length} weeks\n`);
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testOwnerWeeks();
