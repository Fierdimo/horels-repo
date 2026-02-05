require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

/**
 * Simple script to create admin user - works in Docker without TypeScript
 * Run: node create-admin.js
 */

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sw2_hotels',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'mysql',
    dialect: 'mysql',
    logging: false
  }
);

async function createAdminUser() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Execute raw SQL to insert admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    console.log('🔍 Checking if admin user exists...');
    
    const [existing] = await sequelize.query(
      'SELECT * FROM users WHERE email = ?',
      { replacements: ['admin@sw2.com'] }
    );

    if (existing.length > 0) {
      console.log('✅ Admin user already exists');
      console.log('   Email:', existing[0].email);
      console.log('   Role ID:', existing[0].role_id);
      console.log('   Status:', existing[0].status);
      console.log('');
      console.log('💡 To update this user, run: node update-admin.js');
      return;
    }

    console.log('📝 Creating admin user...');
    
    // Get admin role_id
    const [roles] = await sequelize.query("SELECT id FROM roles WHERE name = 'admin'");
    const adminRoleId = roles.length > 0 ? roles[0].id : 1;
    
    await sequelize.query(`
      INSERT INTO users (
        email, 
        password_hash, 
        first_name, 
        last_name, 
        role_id,
        status, 
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, {
      replacements: [
        'admin@sw2.com',
        passwordHash,
        'Admin',
        'System',
        adminRoleId,
        'approved'
      ]
    });

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Email: admin@sw2.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after first login!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

createAdminUser()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
