import sequelize from './src/config/database';
import { QueryTypes } from 'sequelize';

async function checkPendingUsers() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    // Get all pending staff users
    const pendingUsers = await sequelize.query(`
      SELECT 
        u.id,
        u.email,
        u.status,
        u.first_name,
        u.last_name,
        u.createdAt,
        r.name as role_name,
        p.id as property_id,
        p.name as property_name,
        p.location as property_location
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN properties p ON u.property_id = p.id
      WHERE u.status = 'pending'
      ORDER BY u.createdAt DESC
    `, { type: QueryTypes.SELECT });

    console.log(`📋 Found ${pendingUsers.length} pending user(s):\n`);
    
    if (pendingUsers.length > 0) {
      pendingUsers.forEach((user: any, index) => {
        console.log(`${index + 1}. User #${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
        console.log(`   Role: ${user.role_name}`);
        console.log(`   Status: ${user.status}`);
        if (user.property_name) {
          console.log(`   Property: ${user.property_name} (${user.property_location})`);
        }
        console.log(`   Registered: ${new Date(user.createdAt).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No pending users found. You can create a test staff account to see the approval flow.\n');
    }

    // Get count by role
    const countByRole = await sequelize.query(`
      SELECT 
        r.name as role,
        COUNT(*) as count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'pending'
      GROUP BY r.name
    `, { type: QueryTypes.SELECT });

    if (countByRole.length > 0) {
      console.log('📊 Pending users by role:');
      countByRole.forEach((item: any) => {
        console.log(`   ${item.role}: ${item.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkPendingUsers();
