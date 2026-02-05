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

async function checkOwnershipTable() {
  try {
    await sequelize.authenticate();
    
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'ownerships'");
    
    if (tables.length === 0) {
      console.log('❌ ownerships table does NOT exist');
      console.log('');
      console.log('The migration failed because owner_id type mismatch.');
      console.log('Run this to create it manually:');
      console.log('  docker exec backend node create-ownerships-table.js');
      return;
    }
    
    console.log('✅ ownerships table exists');
    console.log('');
    const [columns] = await sequelize.query('DESCRIBE ownerships');
    console.log('Structure:');
    columns.forEach(col => {
      if (['id', 'owner_id', 'unit_id'].includes(col.Field)) {
        console.log(`  ${col.Field}: ${col.Type}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkOwnershipTable();
