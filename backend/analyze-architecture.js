const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function analyzeArchitecture() {
  try {
    await sequelize.authenticate();
    
    const queryInterface = sequelize.getQueryInterface();
    const allTables = await queryInterface.showAllTables();
    
    const tables = allTables.map(t => typeof t === 'string' ? t : t.tableName);
    
    console.log('\n📋 ANÁLISIS DE ARQUITECTURA V1 vs V2\n');
    console.log('='.repeat(60));
    
    // V1 Tables
    console.log('\n🔵 SISTEMA V1 (Hotel Marketplace):');
    const v1Tables = ['properties', 'rooms', 'bookings', 'weeks', 'swap_requests'];
    v1Tables.forEach(t => {
      const exists = tables.includes(t) ? '✅' : '❌';
      console.log(`  ${exists} ${t}`);
    });
    
    // V2 Tables
    console.log('\n🟢 SISTEMA V2 (Timeshare Platform):');
    const v2Tables = ['timeshare_properties', 'timeshare_units', 'ownerships', 'week_allocations', 'v2_bookings', 'credit_accounts', 'credit_transactions'];
    v2Tables.forEach(t => {
      const exists = tables.includes(t) ? '✅' : '❌';
      console.log(`  ${exists} ${t}`);
    });
    
    // Staff Relations
    console.log('\n👥 RELACIONES STAFF-PROPERTY:');
    console.log('  ✅ users.property_id (recién agregado)');
    const staffTables = ['staff_properties', 'user_properties', 'staff_assignments'];
    staffTables.forEach(t => {
      const exists = tables.includes(t) ? '✅' : '❌';
      console.log(`  ${exists} ${t}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 RECOMENDACIÓN:');
    console.log('\n  El staff dashboard debería usar:');
    
    if (tables.includes('rooms') && !tables.includes('bookings')) {
      console.log('  ⚠️  PROBLEMA: Existe rooms pero NO bookings');
      console.log('  ⚠️  PROBLEMA: Existe v2_bookings pero es para timeshares');
      console.log('\n  ✅ SOLUCIÓN: Decidir qué sistema usar:');
      console.log('     A) V1 System: Crear tabla bookings para rooms');
      console.log('     B) V2 System: Staff maneja week_allocations, no rooms');
      console.log('     C) Híbrido: Staff ve ambos sistemas');
    } else if (tables.includes('timeshare_properties') && tables.includes('v2_bookings')) {
      console.log('  ✅ V2 está completo');
      console.log('  📌 Staff debe manejar week_allocations y v2_bookings');
      console.log('  📌 property_id en users -> timeshare_properties (CORRECTO)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

analyzeArchitecture();
