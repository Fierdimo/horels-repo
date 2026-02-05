const { Sequelize, QueryTypes } = require('sequelize');
const config = require('./config/config.json')['development'];

async function check() {
  const sequelize = new Sequelize(config.database, config.username, config.password, config);
  
  try {
    const tables = await sequelize.query('SHOW TABLES', { type: QueryTypes.SELECT });
    
    console.log('\n📊 All V2 tables:');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const v2Tables = tableNames.filter(t => t.startsWith('v2_'));
    
    if (v2Tables.length > 0) {
      v2Tables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('  No V2 tables found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
