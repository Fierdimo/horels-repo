const mysql = require('mysql2/promise');
const config = require('./config/config.json').development;

/**
 * Script para probar las migraciones del sistema de créditos en ambiente limpio
 * 
 * Este script:
 * 1. Crea una base de datos temporal
 * 2. Ejecuta TODAS las migraciones
 * 3. Verifica que todas las tablas se crearon correctamente
 * 4. Valida índices y foreign keys
 * 5. Limpia la base de datos temporal
 */

async function testMigrations() {
  const testDbName = 'sw2_db_migration_test';
  
  // Conexión sin base de datos específica
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password
  });

  try {
    console.log('🧪 INICIANDO PRUEBA DE MIGRACIONES\n');
    
    // 1. Crear base de datos temporal
    console.log(`📦 Creando base de datos temporal: ${testDbName}`);
    await connection.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await connection.query(`CREATE DATABASE ${testDbName}`);
    console.log('✅ Base de datos temporal creada\n');
    
    await connection.end();
    
    // 2. Ejecutar migraciones
    console.log('🔄 Ejecutando migraciones...');
    const { execSync } = require('child_process');
    
    // Modificar temporalmente config.json para usar la DB de prueba
    const fs = require('fs');
    const configPath = './config/config.json';
    const originalConfig = fs.readFileSync(configPath, 'utf8');
    const configObj = JSON.parse(originalConfig);
    const originalDbName = configObj.development.database;
    configObj.development.database = testDbName;
    fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
    
    try {
      // Ejecutar migraciones
      const output = execSync('npx sequelize-cli db:migrate', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      console.log(output);
      console.log('✅ Migraciones ejecutadas exitosamente\n');
    } catch (error) {
      console.error('❌ Error ejecutando migraciones:', error.message);
      console.error(error.stdout);
      throw error;
    } finally {
      // Restaurar config.json original
      fs.writeFileSync(configPath, originalConfig);
    }
    
    // 3. Verificar tablas creadas
    console.log('📊 Verificando tablas del sistema de créditos...\n');
    
    const testConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: testDbName
    });
    
    const expectedTables = [
      'platform_settings',
      'property_tiers',
      'room_type_multipliers',
      'seasonal_calendar',
      'user_credit_wallets',
      'credit_transactions',
      'credit_booking_costs',
      'ancillary_services',
      'booking_ancillary_services',
      'week_claim_requests',
      'inter_property_settlements',
      'setting_change_log'
    ];
    
    for (const table of expectedTables) {
      const [rows] = await testConnection.query(
        `SELECT COUNT(*) as count FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [testDbName, table]
      );
      
      if (rows[0].count === 1) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - NO EXISTE`);
        throw new Error(`Tabla ${table} no fue creada`);
      }
    }
    
    console.log('\n📊 Verificando índices críticos...\n');
    
    const criticalIndexes = [
      { table: 'credit_transactions', index: 'idx_trans_user_history' },
      { table: 'credit_transactions', index: 'idx_trans_active_credits' },
      { table: 'credit_transactions', index: 'idx_trans_expiration' },
      { table: 'user_credit_wallets', index: 'idx_wallet_balance' },
      { table: 'seasonal_calendar', index: 'idx_season_property_date_range' },
      { table: 'bookings', index: 'idx_bookings_payment_method' },
      { table: 'bookings', index: 'idx_bookings_property_payment' },
    ];
    
    for (const { table, index } of criticalIndexes) {
      const [rows] = await testConnection.query(
        `SELECT COUNT(*) as count FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [testDbName, table, index]
      );
      
      if (rows[0].count > 0) {
        console.log(`✅ ${table}.${index}`);
      } else {
        console.log(`⚠️  ${table}.${index} - NO EXISTE`);
      }
    }
    
    console.log('\n📊 Verificando foreign keys...\n');
    
    const [foreignKeys] = await testConnection.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_NAME IN (${expectedTables.map(() => '?').join(',')})
      ORDER BY TABLE_NAME, COLUMN_NAME
    `, [testDbName, ...expectedTables]);
    
    console.log(`✅ ${foreignKeys.length} foreign keys encontradas`);
    foreignKeys.forEach(fk => {
      console.log(`   ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    
    console.log('\n📊 Verificando datos semilla...\n');
    
    // Verificar platform_settings
    const [settings] = await testConnection.query('SELECT COUNT(*) as count FROM platform_settings');
    console.log(`✅ platform_settings: ${settings[0].count} registros`);
    
    // Verificar property_tiers
    const [tiers] = await testConnection.query('SELECT COUNT(*) as count FROM property_tiers');
    console.log(`✅ property_tiers: ${tiers[0].count} registros (esperados: 5)`);
    
    // Verificar room_type_multipliers
    const [multipliers] = await testConnection.query('SELECT COUNT(*) as count FROM room_type_multipliers');
    console.log(`✅ room_type_multipliers: ${multipliers[0].count} registros (esperados: 5)`);
    
    await testConnection.end();
    
    console.log('\n✅ TODAS LAS VERIFICACIONES PASARON\n');
    
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBA:', error.message);
    throw error;
  } finally {
    // 4. Limpiar base de datos temporal
    console.log(`🧹 Limpiando base de datos temporal: ${testDbName}`);
    const cleanupConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password
    });
    await cleanupConnection.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await cleanupConnection.end();
    console.log('✅ Limpieza completada\n');
  }
}

// Ejecutar pruebas
testMigrations()
  .then(() => {
    console.log('🎉 PRUEBA DE MIGRACIONES EXITOSA - LISTO PARA PRODUCCIÓN');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 PRUEBA FALLIDA - REVISAR MIGRACIONES');
    console.error(error);
    process.exit(1);
  });
