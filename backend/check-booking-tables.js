const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function checkBookingTables() {
  try {
    await sequelize.authenticate();
    
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    const bookingTables = tables.filter(t => {
      const tableName = typeof t === 'string' ? t : t.tableName;
      return tableName && tableName.toLowerCase().includes('booking');
    });
    
    console.log('\n📋 Booking-related tables:');
    if (bookingTables.length > 0) {
      for (const table of bookingTables) {
        const name = typeof table === 'string' ? table : table.tableName;
        console.log(`\n✓ ${name}`);
        
        // Get count
        const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${name}`);
        const count = result[0]?.count || 0;
        console.log(`  Records: ${count}`);
      }
    } else {
      console.log('  ❌ No booking tables found');
    }

    console.log('\n💡 Staff dashboard should use the table with actual booking data');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

checkBookingTables();
