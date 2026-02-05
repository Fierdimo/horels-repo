const { Sequelize, QueryTypes } = require('sequelize');
const config = require('./config/config.json')['development'];

async function check() {
  const sequelize = new Sequelize(config.database, config.username, config.password, config);
  
  try {
    const columns = await sequelize.query('DESCRIBE v2_ownerships', { type: QueryTypes.SELECT });
    const hasOwnershipStatus = columns.some(c => c.Field === 'ownership_status');
    
    console.log(`\nv2_ownerships table:`);
    console.log(`  ownership_status column exists: ${hasOwnershipStatus ? '✅ YES' : '❌ NO'}`);
    
    if (hasOwnershipStatus) {
      const col = columns.find(c => c.Field === 'ownership_status');
      console.log(`  Type: ${col.Type}`);
      console.log(`  Default: ${col.Default}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
