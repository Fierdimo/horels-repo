const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, config);

async function markMigrationsAsDone() {
  try {
    // Mark problematic migrations as done
    const migrations = [
      '20251127174507-create-action-logs.js',
      '20251127210339-create-properties.js',
      '20251127210344-create-weeks.js',
      '20251127210348-create-swap-requests.js',
      '20251127210351-create-night-credits.js',
      '20251127210354-create-bookings.js',
      '20251127210356-create-hotel-services.js'
    ];

    for (const migration of migrations) {
      await sequelize.query(
        'INSERT INTO SequelizeMeta (name) VALUES (?) ON DUPLICATE KEY UPDATE name=name',
        { replacements: [migration] }
      );
      console.log(`✓ Marked ${migration} as done`);
    }

    console.log('\n✅ All migrations marked as done');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

markMigrationsAsDone();
