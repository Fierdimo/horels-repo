import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiZW1haWwiOiJhZG1pbkBzdzIuY29tIiwicm9sZSI6ImFkbWluIiwic3RhdHVzIjoiYXBwcm92ZWQiLCJwcm9wZXJ0eV9pZCI6bnVsbCwiaWF0IjoxNzY5NzkxNTE5LCJleHAiOjE3Njk4Nzc5MTl9.ZWP94bKBGkMBawGsyQuY2dp4MtpKuMkib9n2kfOAFYo';

async function testPrepaidInventoryEndpoints() {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };

  console.log('🧪 Testing Prepaid Inventory API Endpoints\n');
  console.log('='.repeat(60) + '\n');

  // Test 1: Get Stats
  try {
    console.log('📊 TEST 1: Get Statistics');
    const response = await axios.get(
      `${BASE_URL}/hotels/admin/prepaid-inventory/stats`,
      { headers }
    );
    console.log('✅ Success:', JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.log('❌ Failed:', err.response?.data || err.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: List Allocations
  try {
    console.log('📋 TEST 2: List Allocations');
    const response = await axios.get(
      `${BASE_URL}/hotels/admin/prepaid-inventory`,
      { headers }
    );
    console.log('✅ Success:', JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.log('❌ Failed:', err.response?.data || err.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Create Allocation
  try {
    console.log('📝 TEST 3: Create Allocation');
    
    // First, get a property
    const propResponse = await axios.get(`${BASE_URL}/hotels/properties`, { headers });
    if (!propResponse.data || propResponse.data.length === 0) {
      console.log('⚠️  No properties found. Cannot create allocation.');
    } else {
      const property = propResponse.data[0];
      console.log(`Using property: ${property.name} (ID: ${property.id})`);

      const allocationData = {
        property_id: property.id,
        pms_resource_id: `test_room_${Date.now()}`,
        pms_provider: property.pms_provider || 'other',
        room_number: '101',
        room_type: 'standard',
        floor_number: '1',
        valid_from: '2026-02-01',
        valid_until: '2026-12-31',
        allocation_type: 'ANNUAL_CONTRACT',
        prepaid_amount: 5000,
        condominium_fee: 400,
        currency: 'EUR',
        notes: 'Test allocation from API test script'
      };

      const response = await axios.post(
        `${BASE_URL}/hotels/admin/prepaid-inventory`,
        allocationData,
        { headers }
      );
      console.log('✅ Success - Created allocation:', JSON.stringify(response.data, null, 2));
    }
  } catch (err: any) {
    console.log('❌ Failed:', err.response?.data || err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All endpoint tests completed!\n');
}

testPrepaidInventoryEndpoints();
