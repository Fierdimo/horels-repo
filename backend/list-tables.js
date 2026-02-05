require('dotenv').config();
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

async function listTables() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const [tables] = await sequelize.query('SHOW TABLES');
    
    console.log('📋 Tables in database:');
    console.log('═'.repeat(50));
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log('═'.repeat(50));
    console.log(`\nTotal: ${tables.length} tables\n`);

    // Check for critical tables
    const tableNames = tables.map(row => Object.values(row)[0]);
    const criticalTables = ['users', 'timeshare_properties', 'timeshare_units', 'ownerships'];
    
    console.log('🔍 Critical V2 Tables Status:');
    console.log('═'.repeat(50));
    criticalTables.forEach(table => {
      const exists = tableNames.includes(table);
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    });
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

listTables()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
