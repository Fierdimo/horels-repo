import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const setupFlagPath = join(__dirname, '.test-setup-complete');

export default async function globalSetup() {
  // Check if setup has already been completed
  if (!existsSync(setupFlagPath)) {
    try {
      console.log('Setting up test database...');

      // Create database if it doesn't exist
      execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS sw2_test;"', { stdio: 'inherit' });

      // Grant permissions
      execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "GRANT ALL PRIVILEGES ON sw2_test.* TO \'sw2_user\'@\'%\'; FLUSH PRIVILEGES;"', { stdio: 'inherit' });

      // Run migrations only (no seeders - each test creates its own data)
      execSync('npx sequelize-cli db:migrate --env test', { stdio: 'inherit' });      // Mark setup as complete
      writeFileSync(setupFlagPath, 'completed');
      console.log('Database setup completed.');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }
}