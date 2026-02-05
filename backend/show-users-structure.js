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

async function showUsersStructure() {
  try {
    await sequelize.authenticate();
    
    const [columns] = await sequelize.query('DESCRIBE users');
    
    console.log('📋 USERS table complete structure:');
    console.log('═'.repeat(80));
    columns.forEach(col => {
      console.log(`${col.Field.padEnd(30)} | ${col.Type.padEnd(20)} | ${col.Null} | ${col.Key} | ${col.Default}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

showUsersStructure();
