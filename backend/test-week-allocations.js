require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'sw2_hotels',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'mysql',
    dialect: 'mysql',
    logging: console.log
  }
);

async function testWeekAllocationsCreation() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Try to create the table manually to see the exact error
    console.log('Attempting to create week_allocations table...\n');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS week_allocations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        ownership_id INT UNSIGNED NOT NULL,
        year INT UNSIGNED NOT NULL,
        week_number TINYINT UNSIGNED,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('ASSIGNED', 'RESERVED', 'RELEASED', 'BOOKED', 'USED', 'EXPIRED') NOT NULL DEFAULT 'ASSIGNED',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        CONSTRAINT fk_week_allocations_ownership
          FOREIGN KEY (ownership_id) 
          REFERENCES ownerships(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Table created successfully!');

  } catch (error) {
    console.error('\n❌ Error creating table:');
    console.error('Message:', error.message);
    console.error('SQL State:', error.sqlState);
    console.error('Error Number:', error.errno);
    
    if (error.sql) {
      console.error('\nSQL:', error.sql);
    }
  } finally {
    await sequelize.close();
  }
}

testWeekAllocationsCreation();
