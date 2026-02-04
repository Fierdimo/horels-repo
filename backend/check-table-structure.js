const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, config);

async function checkTable() {
  try {
    const [results] = await sequelize.query('DESCRIBE timeshare_properties');
    console.log('\n=== timeshare_properties table structure ===\n');
    console.table(results);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

checkTable();
