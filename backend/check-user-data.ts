import sequelize from './src/config/database';

async function checkUserData() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    // Raw SQL query to get user data
    const [users]: any = await sequelize.query(`
      SELECT 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.phone, 
        u.address, 
        u.status,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LIMIT 10
    `);

    console.log('📋 First 10 users:\n');
    users.forEach((user: any) => {
      console.log(`User #${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  First Name: ${user.first_name || 'NULL'}`);
      console.log(`  Last Name: ${user.last_name || 'NULL'}`);
      console.log(`  Phone: ${user.phone || 'NULL'}`);
      console.log(`  Address: ${user.address || 'NULL'}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Role: ${user.role_name || 'NULL'}\n`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserData();
