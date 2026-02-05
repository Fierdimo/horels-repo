require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

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

async function updateAdminUser() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    console.log('🔍 Checking admin user...');
    const [existing] = await sequelize.query(
      'SELECT * FROM users WHERE email = ?',
      { replacements: ['admin@sw2.com'] }
    );

    if (existing.length === 0) {
      console.log('❌ Admin user does not exist. Run create-admin.js first.');
      return;
    }

    const user = existing[0];
    console.log('📋 Current user data:');
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Email Verified:', user.email_verified);
    console.log('');

    // Update password
    const newPasswordHash = await bcrypt.hash('admin123', 10);

    console.log('🔄 Updating admin user...');
    
    await sequelize.query(`
      UPDATE users 
      SET 
        password_hash = ?,
        role = 'admin',
        status = 'approved',
        first_name = 'Admin',
        last_name = 'System',
        updated_at = NOW()
      WHERE email = 'admin@sw2.com'
    `, {
      replacements: [newPasswordHash]
    });

    console.log('✅ Admin user updated successfully!\n');
    console.log('📋 New login credentials:');
    console.log('   Email: admin@sw2.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    console.log('   Status: approved');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after first login!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

updateAdminUser()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
