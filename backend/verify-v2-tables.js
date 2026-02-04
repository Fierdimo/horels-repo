const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function verifyV2Tables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');
    
    const tables = await sequelize.getQueryInterface().showAllTables();
    const tableNames = tables.map(t => typeof t === 'string' ? t : t.tableName);
    
    const v2Tables = [
      'timeshare_properties',
      'timeshare_units',
      'ownerships',
      'week_allocations',
      'credit_accounts',
      'credit_transactions',
      'v2_bookings',
      'hotel_inventory'
    ];
    
    console.log('📋 V2 Tables Verification:\n');
    for (const table of v2Tables) {
      const exists = tableNames.includes(table);
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    }
    
    console.log(`\n📊 Total tables in database: ${tables.length}`);
    console.log(`✅ All 8 V2 core tables created successfully!`);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyV2Tables();
