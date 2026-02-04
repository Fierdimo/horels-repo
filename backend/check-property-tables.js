const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function checkTables() {
  try {
    await sequelize.authenticate();
    
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    const propertyTables = tables.filter(t => {
      const tableName = typeof t === 'string' ? t : Object.values(t)[0];
      return tableName && tableName.toLowerCase().includes('propert');
    });
    
    console.log('\n📋 All tables:');
    tables.slice(0, 10).forEach(t => console.log('  -', t));
    
    console.log('\n📋 Property-related tables:');
    if (propertyTables.length > 0) {
      propertyTables.forEach(table => {
        const name = typeof table === 'string' ? table : Object.values(table)[0];
        console.log(`  ✓ ${name}`);
      });
    } else {
      console.log('  ❌ No property tables found');
    }

    console.log('\n💡 For reference, use: timeshare_properties (V2) instead of properties (V1)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

checkTables();
