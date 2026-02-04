import axios from 'axios';

async function testEndpoints() {
  console.log('Testing backend endpoints...\n');
  
  // Test 1: Health check
  try {
    const health = await axios.get('http://localhost:3000/hotels/health');
    console.log('✅ Health check:', health.data);
  } catch (err: any) {
    console.log('❌ Health check failed:', err.message);
  }

  // Test 2: Login attempt with detailed error
  try {
    const login = await axios.post('http://localhost:3000/hotels/auth/login', {
      email: 'admin@sw2.com',
      password: 'admin123'
    });
    console.log('✅ Login success:', login.data);
  } catch (err: any) {
    console.log('❌ Login failed:');
    console.log('  Status:', err.response?.status);
    console.log('  Error:', err.response?.data);
    console.log('  Message:', err.message);
  }
}

testEndpoints();
