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

async function checkTableStructure() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check users table
    console.log('📋 USERS table structure:');
    console.log('═'.repeat(80));
    const [usersColumns] = await sequelize.query('DESCRIBE users');
    usersColumns.forEach(col => {
      if (col.Field === 'id') {
        console.log(`✅ ${col.Field}: ${col.Type} | Key: ${col.Key} | Extra: ${col.Extra}`);
      }
    });
    console.log('');

    // Check timeshare_units table
    console.log('📋 TIMESHARE_UNITS table structure:');
    console.log('═'.repeat(80));
    const [unitsColumns] = await sequelize.query('DESCRIBE timeshare_units');
    unitsColumns.forEach(col => {
      if (col.Field === 'id') {
        console.log(`✅ ${col.Field}: ${col.Type} | Key: ${col.Key} | Extra: ${col.Extra}`);
      }
    });
    console.log('');

    // Check what the ownerships migration is trying to create
    console.log('📋 Expected FK constraints for ownerships:');
    console.log('═'.repeat(80));
    console.log('owner_id -> users(id) - Should be INT UNSIGNED');
    console.log('unit_id -> timeshare_units(id) - Should be INT UNSIGNED');
    console.log('');

    // Try to check if there are any existing foreign key constraints
    const [fks] = await sequelize.query(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_SCHEMA = '${process.env.DB_NAME || 'sw2_hotels'}'
      AND TABLE_NAME IN ('ownerships', 'timeshare_units', 'users')
    `);
    
    if (fks.length > 0) {
      console.log('📋 Existing Foreign Keys:');
      console.log('═'.repeat(80));
      fks.forEach(fk => {
        console.log(`${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

checkTableStructure()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
