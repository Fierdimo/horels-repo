const fs = require('fs');
const { Sequelize, QueryTypes } = require('sequelize');
const config = require('./config/config.json')['development'];

async function checkMigrations() {
  const sequelize = new Sequelize(config.database, config.username, config.password, config);
  
  try {
    // List migration files
    const files = fs.readdirSync('./migrations_v2')
      .filter(f => f.endsWith('.js'))
      .sort();
    
    console.log('\n📋 V2 Migration Files:');
    files.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f}`);
    });
    
    // Check for duplicate timestamps
    const timestamps = files.map(f => f.split('-')[0]);
    const duplicates = timestamps.filter((t, i) => timestamps.indexOf(t) !== i);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  WARNING: Duplicate timestamps found:');
      duplicates.forEach(t => {
        const dupes = files.filter(f => f.startsWith(t));
        console.log(`  ${t}:`);
        dupes.forEach(d => console.log(`    - ${d}`));
      });
    }
    
    // Check which migrations have been run
    const results = await sequelize.query(`
      SELECT name FROM SequelizeMeta 
      WHERE name LIKE '20260201%' OR name LIKE '20260203%'
      ORDER BY name
    `, { type: QueryTypes.SELECT });
    
    console.log(`\n✅ Migrations run in database (${results.length}):`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}`);
    });
    
    // Check v2_bookings table structure
    const columns = await sequelize.query('DESCRIBE v2_bookings', { type: QueryTypes.SELECT });
    const hasRoomId = columns.some(c => c.Field === 'room_id');
    
    console.log(`\n🔍 v2_bookings table check:`);
    console.log(`  - room_id column exists: ${hasRoomId ? '❌ YES (PROBLEM!)' : '✅ NO (CORRECT)'}`);
    console.log(`  - Total columns: ${columns.length}`);
    
    // Check for key columns
    const keyColumns = ['id', 'guest_id', 'property_id', 'week_allocation_id', 'room_category', 'physical_room', 'source'];
    console.log('\n📊 Key columns:');
    keyColumns.forEach(col => {
      const exists = columns.some(c => c.Field === col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

checkMigrations();
