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

async function checkOwnershipsStructure() {
  try {
    await sequelize.authenticate();
    
    console.log('📋 OWNERSHIPS table structure:');
    console.log('═'.repeat(80));
    const [columns] = await sequelize.query('DESCRIBE ownerships');
    columns.forEach(col => {
      console.log(`${col.Field.padEnd(25)} | ${col.Type.padEnd(30)} | ${col.Key.padEnd(4)} | ${col.Null}`);
    });
    
    console.log('\n📋 Foreign Keys on ownerships:');
    console.log('═'.repeat(80));
    const [fks] = await sequelize.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'sw2_hotels'}'
      AND TABLE_NAME = 'ownerships'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    fks.forEach(fk => {
      console.log(`${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkOwnershipsStructure();
