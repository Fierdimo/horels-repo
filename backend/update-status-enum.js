const mysql = require('mysql2/promise');

async function updateStatusEnum() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'sw2_user',
    password: 'sw2_password',
    database: 'sw2_db'
  });

  try {
    console.log('Updating ownerships status ENUM...');
    await conn.query(`
      ALTER TABLE ownerships 
      MODIFY COLUMN status ENUM(
        'ACTIVE', 
        'SUSPENDED', 
        'TERMINATED', 
        'PENDING_PAYMENT', 
        'CONVERTED_TO_CREDITS', 
        'CANCELLED'
      ) NOT NULL DEFAULT 'ACTIVE'
    `);
    console.log('✓ Status ENUM updated successfully');
    console.log('  Added: CONVERTED_TO_CREDITS, CANCELLED');
  } catch (error) {
    console.error('Error updating status ENUM:', error.message);
  } finally {
    await conn.end();
  }
}

updateStatusEnum();
