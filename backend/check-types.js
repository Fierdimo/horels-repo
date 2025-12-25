const mysql = require('mysql2/promise');
const config = require('./config/config.json').development;

async function checkTables() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database
  });

  try {
    console.log('📊 Verificando tipo de columna properties.id...\n');
    
    const [properties] = await connection.query('DESCRIBE properties');
    const idCol = properties.find(c => c.Field === 'id');
    console.log('properties.id:', idCol);
    
    console.log('\n📊 Verificando tipo de columna users.id...\n');
    const [users] = await connection.query('DESCRIBE users');
    const userIdCol = users.find(c => c.Field === 'id');
    console.log('users.id:', userIdCol);
    
    console.log('\n📊 Verificando tipo de columna weeks.id...\n');
    const [weeks] = await connection.query('DESCRIBE weeks');
    const weekIdCol = weeks.find(c => c.Field === 'id');
    console.log('weeks.id:', weekIdCol);
    
    console.log('\n📊 Verificando tipo de columna bookings.id...\n');
    const [bookings] = await connection.query('DESCRIBE bookings');
    const bookingIdCol = bookings.find(c => c.Field === 'id');
    console.log('bookings.id:', bookingIdCol);
    
    console.log('\n📊 Todas las columnas de bookings:\n');
    bookings.forEach(col => console.log(`- ${col.Field}: ${col.Type}`));
  } finally {
    await connection.end();
  }
}

checkTables().catch(console.error);
