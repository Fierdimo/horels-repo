import { execSync } from 'child_process';

export default async function globalSetup() {
  try {
    console.log('Global test setup: ensuring test database and running migrations...');
    // Ensure primary test DB
    execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS sw2_test;"', { stdio: 'inherit' });
    execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "GRANT ALL PRIVILEGES ON sw2_test.* TO \'sw2_user\'@\'%\'; FLUSH PRIVILEGES;"', { stdio: 'inherit' });
    execSync('npx sequelize-cli db:migrate --env test', { stdio: 'inherit' });

    // Ensure isolated E2E database so destructive E2E setup doesn't impact unit/integration tests
    execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS sw2_e2e_test;"', { stdio: 'inherit' });
    execSync('docker exec sw2_mariadb mysql -u root -prootpassword -e "GRANT ALL PRIVILEGES ON sw2_e2e_test.* TO \'sw2_user\'@\'%\'; FLUSH PRIVILEGES;"', { stdio: 'inherit' });
    // Run migrations for the E2E DB using a connection URL to avoid changing config files
    const e2eUrl = 'mysql://sw2_user:sw2_password@127.0.0.1:3306/sw2_e2e_test';
    execSync(`npx sequelize-cli db:migrate --url "${e2eUrl}"`, { stdio: 'inherit' });
    console.log('Global migrations complete.');

    // Ensure seed data exists for test DB (roles, permissions, properties, admin user)
    console.log('Running test DB seeders...');
    execSync('npx sequelize-cli db:seed:all --env test', { stdio: 'inherit' });
    console.log('Test DB seeding complete.');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}
