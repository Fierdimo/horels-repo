/**
 * Simple script to create an admin user and test login
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const AUTH_BASE = `${BASE_URL}/hotels/auth`;

async function createAdminAndTest() {
  try {
    console.log('🔐 Attempting to register admin user...');
    
    // Try to register (might fail if user exists)
    try {
      const registerResponse = await axios.post(`${AUTH_BASE}/register`, {
        email: 'test@admin.com',
        password: 'Admin123!',
        firstName: 'Test',
        lastName: 'Admin',
        roleName: 'admin'
      });
      console.log('✅ Admin user created:', registerResponse.data);
    } catch (err: any) {
      if (err.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️  User already exists, trying to login...');
      } else {
        console.log('⚠️  Registration attempt:', err.response?.data || err.message);
      }
    }

    // Try to login
    console.log('\n🔑 Attempting login...');
    const loginResponse = await axios.post(`${AUTH_BASE}/login`, {
      email: 'test@admin.com',
      password: 'Admin123!'
    });

    if (loginResponse.data.token) {
      console.log('✅ Login successful!');
      console.log('Token:', loginResponse.data.token.substring(0, 50) + '...');
      console.log('User:', loginResponse.data.user);
      
      // Test API endpoint
      console.log('\n📊 Testing prepaid inventory API...');
      const statsResponse = await axios.get(
        `${BASE_URL}/hotels/admin/prepaid-inventory/stats`,
        {
          headers: { 'Authorization': `Bearer ${loginResponse.data.token}` }
        }
      );
      console.log('✅ Stats retrieved:', statsResponse.data);
      
      return {
        token: loginResponse.data.token,
        user: loginResponse.data.user
      };
    }
  } catch (err: any) {
    console.error('❌ Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

createAdminAndTest();
