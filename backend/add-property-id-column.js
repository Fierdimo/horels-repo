const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: console.log
});

async function addPropertyIdToUsers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    console.log('➕ Adding property_id column to users table...');

    // Add the column (will fail if already exists, that's OK)
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN property_id INT(10) UNSIGNED NULL 
        COMMENT 'Property assigned to staff users - only used for role=staff'
      `);
      console.log('✅ Column added');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('⚠️  Column already exists, skipping');
      } else {
        throw e;
      }
    }

    // Add foreign key
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_users_timeshare_property 
        FOREIGN KEY (property_id) 
        REFERENCES timeshare_properties(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL
      `);
      console.log('✅ Foreign key added');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
        console.log('⚠️  Foreign key already exists, skipping');
      } else {
        throw e;
      }
    }

    // Add index
    try {
      await sequelize.query(`
        CREATE INDEX idx_users_property_id ON users(property_id)
      `);
      console.log('✅ Index added');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
        console.log('⚠️  Index already exists, skipping');
      } else {
        throw e;
      }
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

addPropertyIdToUsers();
