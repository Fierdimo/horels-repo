import sequelize from './src/config/database';
import { QueryTypes } from 'sequelize';

async function checkPendingStaff() {
  try {
    const users = await sequelize.query(`
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.status, 
        u.created_at,
        p.name as property_name, 
        p.location as property_location,
        r.name as role
      FROM users u 
      LEFT JOIN properties p ON u.property_id = p.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'pending' AND r.name = 'staff'
      ORDER BY u.created_at DESC
    `, { type: QueryTypes.SELECT });
    
    console.log('\n=== PENDING STAFF REQUESTS ===');
    console.log(`Total pending: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('No pending staff requests found.');
    } else {
      users.forEach((user: any) => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.first_name} ${user.last_name}`);
        console.log(`Property: ${user.property_name || 'N/A'}`);
        console.log(`Location: ${user.property_location || 'N/A'}`);
        console.log(`Status: ${user.status}`);
        console.log(`Created: ${user.created_at}`);
        console.log('---');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPendingStaff();
