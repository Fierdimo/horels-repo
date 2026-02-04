const mysql = require('mysql2/promise');

async function updateOwnershipStatus() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'sw2_user',
    password: 'sw2_password',
    database: 'sw2_db'
  });

  try {
    // Update ownerships that have RELEASED week_allocations
    const [result] = await conn.query(`
      UPDATE ownerships o
      SET o.status = 'CONVERTED_TO_CREDITS'
      WHERE o.id IN (
        SELECT DISTINCT ownership_id 
        FROM week_allocations 
        WHERE status = 'RELEASED'
      )
    `);

    console.log('✅ Updated', result.affectedRows, 'ownerships to CONVERTED_TO_CREDITS');

    // Verify the changes
    const [rows] = await conn.query(`
      SELECT wa.id, wa.ownership_id, wa.status as allocation_status, o.status as ownership_status
      FROM week_allocations wa
      JOIN ownerships o ON wa.ownership_id = o.id
      WHERE wa.status = 'RELEASED'
      LIMIT 5
    `);

    console.log('\n📊 Sample of updated records:');
    console.log(rows);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await conn.end();
  }
}

updateOwnershipStatus();
