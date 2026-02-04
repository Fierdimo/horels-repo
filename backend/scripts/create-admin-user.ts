import * as dotenv from 'dotenv';
dotenv.config();
import * as bcrypt from 'bcryptjs';
import sequelize from '../src/config/database';
import UserV2 from '../src/models/v2/User';

/**
 * Script to create default admin user
 * Run: npm run ts-node scripts/create-admin-user.ts
 */

async function createAdminUser() {
  try {
    // Wait for database connection and V2 models initialization
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // Give time for V2 models to initialize (they're initialized in database.ts)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔍 Checking if admin user exists...');
    
    const existingAdmin = await UserV2.findOne({
      where: { email: 'admin@sw2.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Status:', existingAdmin.status);
      return;
    }

    console.log('📝 Creating admin user...');
    
    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Create admin user
    const admin = await UserV2.create({
      email: 'admin@sw2.com',
      password_hash: passwordHash,
      first_name: 'Admin',
      last_name: 'System',
      phone: null,
      role: 'admin',
      status: 'active',
      email_verified: true,
      email_verified_at: new Date(),
    } as any); // Use 'as any' to bypass TypeScript strict checking for creation

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Email: admin@sw2.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
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
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
