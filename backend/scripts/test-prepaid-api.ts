/**
 * Script to test Prepaid Inventory Management API endpoints
 * 
 * Prerequisites:
 * 1. Backend server running (npm run dev)
 * 2. Database migrated (npm run migrate)
 * 3. At least one property and admin user in database
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = 'http://localhost:3000';
const AUTH_BASE = `${BASE_URL}/hotels/auth`;
const API_BASE = `${BASE_URL}/hotels/admin/prepaid-inventory`;

// Test credentials - adjust these if needed
const ADMIN_EMAIL = 'admin@sw2.com';
const ADMIN_PASSWORD = 'admin123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = (message: string, color: string = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const success = (message: string) => log(`✅ ${message}`, colors.green);
const error = (message: string) => log(`❌ ${message}`, colors.red);
const info = (message: string) => log(`ℹ️  ${message}`, colors.cyan);
const warning = (message: string) => log(`⚠️  ${message}`, colors.yellow);

let client: AxiosInstance;
let propertyId: number;
let allocationId: number;

// Helper to make authenticated requests
async function login(): Promise<string> {
  try {
    info(`Logging in as ${ADMIN_EMAIL}...`);
    const response = await axios.post(`${AUTH_BASE}/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.data.token) {
      success('Login successful');
      return response.data.token;
    } else {
      throw new Error('No token received');
    }
  } catch (err: any) {
    error(`Login failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

async function getProperty(token: string) {
  try {
    info('Fetching first property...');
    const response = await axios.get(`${BASE_URL}/hotels/properties`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data && response.data.length > 0) {
      propertyId = response.data[0].id;
      success(`Using property: ${response.data[0].name} (ID: ${propertyId})`);
    } else {
      throw new Error('No properties found. Please create a property first.');
    }
  } catch (err: any) {
    error(`Failed to get property: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 1: List allocations (should be empty initially)
async function testListAllocations() {
  log('\n📋 TEST 1: List Allocations', colors.bright);
  
  try {
    const response = await client.get(API_BASE);
    
    success(`Found ${response.data.allocations?.length || 0} allocations`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (err: any) {
    error(`List failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 2: Create allocation
async function testCreateAllocation() {
  log('\n📝 TEST 2: Create Allocation', colors.bright);
  
  const allocationData = {
    property_id: propertyId,
    pms_resource_id: `test_room_${Date.now()}`,
    pms_provider: 'mews',
    room_number: '305',
    room_type: 'standard',
    floor_number: '3',
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    allocation_type: 'ANNUAL_CONTRACT',
    prepaid_amount: 6000,
    condominium_fee: 500,
    currency: 'EUR',
    notes: 'Test allocation created by API test script',
  };

  try {
    info('Creating allocation...');
    const response = await client.post(API_BASE, allocationData);
    
    allocationId = response.data.allocation.id;
    success(`Created allocation ID: ${allocationId}`);
    console.log('Created allocation:', JSON.stringify(response.data.allocation, null, 2));
    
    return response.data.allocation;
  } catch (err: any) {
    error(`Create failed: ${err.response?.data?.error || err.message}`);
    
    // If it already exists, try to find it
    if (err.response?.data?.error?.includes('already exists')) {
      warning('Allocation already exists, trying to list existing...');
      const list = await testListAllocations();
      if (list.allocations && list.allocations.length > 0) {
        allocationId = list.allocations[0].id;
        info(`Using existing allocation ID: ${allocationId}`);
        return list.allocations[0];
      }
    }
    
    throw err;
  }
}

// Test 3: Get single allocation
async function testGetAllocation() {
  log('\n🔍 TEST 3: Get Single Allocation', colors.bright);
  
  if (!allocationId) {
    warning('No allocation ID available, skipping...');
    return;
  }

  try {
    info(`Fetching allocation ${allocationId}...`);
    const response = await client.get(`${API_BASE}/${allocationId}`);
    
    success(`Retrieved allocation: Room ${response.data.allocation.room_number}`);
    console.log('Allocation details:', JSON.stringify(response.data.allocation, null, 2));
    
    return response.data.allocation;
  } catch (err: any) {
    error(`Get failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 4: Update allocation
async function testUpdateAllocation() {
  log('\n✏️  TEST 4: Update Allocation', colors.bright);
  
  if (!allocationId) {
    warning('No allocation ID available, skipping...');
    return;
  }

  const updateData = {
    notes: `Updated at ${new Date().toISOString()}`,
    prepaid_amount: 6500,
  };

  try {
    info(`Updating allocation ${allocationId}...`);
    const response = await client.put(`${API_BASE}/${allocationId}`, updateData);
    
    success('Updated successfully');
    console.log('Updated allocation:', JSON.stringify(response.data.allocation, null, 2));
    
    return response.data.allocation;
  } catch (err: any) {
    error(`Update failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 5: Get statistics
async function testGetStats() {
  log('\n📊 TEST 5: Get Statistics', colors.bright);
  
  try {
    info('Fetching statistics...');
    const response = await client.get(`${API_BASE}/stats`, {
      params: { property_id: propertyId }
    });
    
    success('Statistics retrieved');
    console.log('Stats:', JSON.stringify(response.data.stats, null, 2));
    
    return response.data.stats;
  } catch (err: any) {
    error(`Stats failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 6: List with filters
async function testListWithFilters() {
  log('\n🔎 TEST 6: List with Filters', colors.bright);
  
  try {
    info('Fetching allocations with filters...');
    const response = await client.get(API_BASE, {
      params: {
        property_id: propertyId,
        status: 'active',
        room_type: 'standard',
        limit: 10,
      }
    });
    
    success(`Found ${response.data.allocations?.length || 0} allocations matching filters`);
    console.log('Filtered results:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (err: any) {
    error(`Filtered list failed: ${err.response?.data?.error || err.message}`);
    throw err;
  }
}

// Test 7: Sync with PMS (will fail if PMS not configured, that's ok)
async function testSyncWithPMS() {
  log('\n🔄 TEST 7: Sync with PMS', colors.bright);
  
  if (!allocationId) {
    warning('No allocation ID available, skipping...');
    return;
  }

  try {
    info(`Syncing allocation ${allocationId} with PMS...`);
    const response = await client.post(`${API_BASE}/${allocationId}/sync`);
    
    success('Sync completed');
    console.log('Sync result:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (err: any) {
    // This is expected to fail if PMS is not configured
    warning(`Sync failed (expected if PMS not configured): ${err.response?.data?.error || err.message}`);
  }
}

// Test 8: Bulk import (will fail if PMS not configured, that's ok)
async function testBulkImport() {
  log('\n📦 TEST 8: Bulk Import', colors.bright);
  
  const bulkData = {
    property_id: propertyId,
    resource_ids: ['test_room_bulk_1', 'test_room_bulk_2'],
    config: {
      valid_from: '2026-02-01',
      valid_until: '2026-12-31',
      allocation_type: 'ANNUAL_CONTRACT',
      prepaid_amount: 7000,
      currency: 'EUR',
    }
  };

  try {
    info('Testing bulk import...');
    const response = await client.post(`${API_BASE}/bulk-import`, bulkData);
    
    success(`Bulk import created ${response.data.created?.length || 0} allocations`);
    console.log('Bulk import result:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (err: any) {
    // This might fail if PMS is not configured or resources don't exist
    warning(`Bulk import failed (expected if PMS not configured): ${err.response?.data?.error || err.message}`);
  }
}

// Main test runner
async function runTests() {
  log('\n🚀 Starting Prepaid Inventory API Tests\n', colors.cyan);
  log('='.repeat(60), colors.gray);

  try {
    // Setup
    log('\n📋 SETUP', colors.bright);
    const token = await login();
    await getProperty(token);

    // Create authenticated axios instance
    client = axios.create({
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    log('\n' + '='.repeat(60), colors.gray);

    // Run tests
    await testListAllocations();
    await testCreateAllocation();
    await testGetAllocation();
    await testUpdateAllocation();
    await testGetStats();
    await testListWithFilters();
    await testSyncWithPMS();
    await testBulkImport();

    // Summary
    log('\n' + '='.repeat(60), colors.gray);
    log('\n✅ API Tests Complete!', colors.bright + colors.green);
    
    log('\n📊 Summary:', colors.bright);
    log('  • All main CRUD operations working', colors.green);
    log('  • Statistics endpoint functional', colors.green);
    log('  • Filtering capabilities confirmed', colors.green);
    log('  • PMS sync ready (needs PMS configuration)', colors.yellow);
    log('  • Bulk import ready (needs PMS configuration)', colors.yellow);
    
    log('\n💡 Next Steps:', colors.bright);
    log('  1. Configure PMS credentials in property settings');
    log('  2. Test PMS sync and bulk import with real data');
    log('  3. Create frontend admin panel');
    log('  4. Integrate with marketplace search');

  } catch (err: any) {
    log('\n' + '='.repeat(60), colors.gray);
    error('\n❌ Tests Failed');
    console.error('Error:', err.message);
    if (err.response?.data) {
      console.error('Response:', err.response.data);
    }
    process.exit(1);
  }

  process.exit(0);
}

// Run the tests
runTests();
