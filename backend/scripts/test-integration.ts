import axios from 'axios';

const API_BASE = 'http://localhost:3000/hotels';

// Test credentials
const ADMIN_EMAIL = 'admin@sw2.com';
const ADMIN_PASSWORD = 'admin123';

async function testIntegration() {
  console.log('🧪 Testing Prepaid Inventory Integration\n');
  
  let token = '';

  try {
    // 1. Login
    console.log('1️⃣ Testing login...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    token = loginRes.data.token;
    console.log('✅ Login successful\n');

    // 2. Test PrepaidInventory Stats
    console.log('2️⃣ Testing Prepaid Inventory Stats...');
    const statsRes = await axios.get(`${API_BASE}/admin/prepaid-inventory/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('✅ Stats:', JSON.stringify(statsRes.data.data, null, 2));
    console.log('');

    // 3. Test Unified Search (no auth required, public endpoint)
    console.log('3️⃣ Testing Unified Search...');
    const searchRes = await axios.post(`${API_BASE}/api/unified-search`, {
      checkIn: '2026-03-01',
      checkOut: '2026-03-08',
      showAllOptions: true,
    });
    console.log('✅ Search Results:', JSON.stringify(searchRes.data, null, 2));
    console.log('');

    // 4. Test with filters
    console.log('4️⃣ Testing Unified Search with filters...');
    const filteredSearchRes = await axios.post(`${API_BASE}/api/unified-search`, {
      checkIn: '2026-04-01',
      checkOut: '2026-04-08',
      location: 'Madrid',
      guests: 2,
      showAllOptions: false, // Only prepaid + released
    });
    console.log('✅ Filtered Results:', JSON.stringify(filteredSearchRes.data, null, 2));
    console.log('');

    // 5. Frontend routes check
    console.log('5️⃣ Frontend Routes Available:');
    console.log('   - Admin Prepaid Inventory: http://localhost:5173/admin/prepaid-inventory');
    console.log('   - Unified Search: http://localhost:5173/marketplace/search');
    console.log('');

    console.log('✅ All integration tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - Prepaid allocations: ${statsRes.data.data.total}`);
    console.log(`   - Search results: ${searchRes.data.data.total}`);
    console.log(`   - Avg margin: ${searchRes.data.data.analytics.avgMargin}%`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Add properties to database');
    console.log('   2. Create prepaid allocations via admin panel');
    console.log('   3. Test complete booking flow');
    console.log('   4. Verify priority ordering (prepaid > released > PMS)');

  } catch (error: any) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    console.error('Full error:', error);
    process.exit(1);
  }
}

testIntegration();
