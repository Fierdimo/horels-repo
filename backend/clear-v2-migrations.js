const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

async function clearV2Migrations() {
  const sequelize = new Sequelize(config.database, config.username, config.password, config);
  
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const result = await sequelize.query("DELETE FROM SequelizeMeta WHERE name LIKE '20260201%'");
    console.log('✅ Cleared V2 migration records:', result);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearV2Migrations();
