const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function checkUsersTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const tableDescription = await sequelize.getQueryInterface().describeTable('users');
    console.log('\n📋 Users table structure:');
    console.log(JSON.stringify(tableDescription, null, 2));
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkUsersTable();
