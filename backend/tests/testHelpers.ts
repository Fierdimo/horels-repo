import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import sequelize from '../src/config/database';

const setupFlagPath = join(__dirname, '.test-db-setup-complete');

export async function setupTestDatabase() {
  // Create database if it doesn't exist and grant permissions
  try {
    if (!existsSync(setupFlagPath)) {
      console.log('Initial test DB setup: creating database and running migrations...');
      execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS sw2_test;"', { stdio: 'inherit' });
      execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "GRANT ALL PRIVILEGES ON sw2_test.* TO \'sw2_user\'@\'%\'; FLUSH PRIVILEGES;"', { stdio: 'inherit' });
      execSync('npx sequelize-cli db:migrate --env test', { stdio: 'inherit' });
      writeFileSync(setupFlagPath, 'completed');
      console.log('Database setup completed.');
    } else {
      // If flag exists, still verify core tables are present; re-run migrations if missing.
      await sequelize.authenticate();
      const [[{ cnt }]] = await sequelize.query(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'sw2_test' AND table_name = 'users';"
      ) as any;
      if (Number(cnt) === 0) {
        console.log('Setup flag found but core tables missing — running migrations again.');
        execSync('npx sequelize-cli db:migrate --env test', { stdio: 'inherit' });
      }
    }
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }

  // Ensure connection (migrations create the schema; avoid model-level sync to prevent FK/schema drift)
  await sequelize.authenticate();
}