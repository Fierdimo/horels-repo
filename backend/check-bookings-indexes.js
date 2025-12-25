const mysql = require('mysql2/promise');
const config = require('./config/config.json').development;

async function checkBookingsIndexes() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database
  });

  const [indexes] = await connection.query(`
    SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND INDEX_NAME LIKE 'idx_bookings%'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);

  console.log('📊 Índices de créditos en tabla BOOKINGS:\n');
  
  const expected = [
    'idx_bookings_payment_method',
    'idx_bookings_credit_paid',
    'idx_bookings_topup',
    'idx_bookings_property_payment'
  ];
  
  expected.forEach(expectedIndex => {
    const found = indexes.find(i => i.INDEX_NAME === expectedIndex);
    if (found) {
      const cols = indexes
        .filter(i => i.INDEX_NAME === expectedIndex)
        .sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
        .map(i => i.COLUMN_NAME)
        .join(', ');
      console.log(`✅ ${expectedIndex.padEnd(40)} (${cols})`);
    } else {
      console.log(`❌ ${expectedIndex.padEnd(40)} [FALTA]`);
    }
  });
  
  await connection.end();
}

checkBookingsIndexes().catch(console.error);
