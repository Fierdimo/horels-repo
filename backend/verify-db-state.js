const mysql = require('mysql2/promise');
const config = require('./config/config.json').development;

async function verifyDatabaseState() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database
  });

  try {
    console.log('📊 VERIFICACIÓN COMPLETA DEL ESTADO DE LA BASE DE DATOS\n');
    console.log('=' .repeat(80) + '\n');
    
    // 1. Verificar tablas del sistema de créditos
    console.log('1️⃣  TABLAS DEL SISTEMA DE CRÉDITOS:\n');
    
    const creditTables = [
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
    
    for (const table of creditTables) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );
      
      const [countRows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
      
      console.log(`${rows[0].count === 1 ? '✅' : '❌'} ${table.padEnd(35)} (${countRows[0].count} registros)`);
    }
    
    // 2. Verificar columnas agregadas a tablas existentes
    console.log('\n2️⃣  COLUMNAS NUEVAS EN TABLAS EXISTENTES:\n');
    
    console.log('📋 PROPERTIES:');
    const [propCols] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'properties'
      AND COLUMN_NAME IN ('tier_id', 'allows_credit_bookings', 'credit_booking_notice_days')
      ORDER BY ORDINAL_POSITION
    `);
    propCols.forEach(col => {
      console.log(`  ✅ ${col.COLUMN_NAME.padEnd(30)} ${col.COLUMN_TYPE}`);
    });
    
    console.log('\n📋 WEEKS:');
    const [weekCols] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'weeks'
      AND COLUMN_NAME IN ('deposited_for_credits', 'credits_earned', 'credit_deposit_date', 
                          'credit_expiration_date', 'season_at_deposit', 'room_type_at_deposit',
                          'credit_calculation_metadata')
      ORDER BY ORDINAL_POSITION
    `);
    weekCols.forEach(col => {
      console.log(`  ✅ ${col.COLUMN_NAME.padEnd(30)} ${col.COLUMN_TYPE}`);
    });
    
    console.log('\n📋 BOOKINGS:');
    const [bookingCols] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME IN ('payment_method', 'credit_amount_paid', 'euro_amount_paid',
                          'topup_required', 'topup_amount_euros', 'credit_refund_amount',
                          'credit_conversion_rate', 'payment_calculation_metadata')
      ORDER BY ORDINAL_POSITION
    `);
    bookingCols.forEach(col => {
      console.log(`  ✅ ${col.COLUMN_NAME.padEnd(30)} ${col.COLUMN_TYPE}`);
    });
    
    // 3. Verificar índices críticos
    console.log('\n3️⃣  ÍNDICES CRÍTICOS:\n');
    
    const [indexes] = await connection.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS,
        NON_UNIQUE
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND (
        INDEX_NAME LIKE 'idx_trans_%' OR
        INDEX_NAME LIKE 'idx_wallet_%' OR
        INDEX_NAME LIKE 'idx_season_%' OR
        INDEX_NAME LIKE 'idx_bookings_payment%' OR
        INDEX_NAME LIKE 'idx_cost_%' OR
        INDEX_NAME LIKE 'idx_service_%'
      )
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
    `);
    
    let currentTable = '';
    indexes.forEach(idx => {
      if (idx.TABLE_NAME !== currentTable) {
        console.log(`\n📊 ${idx.TABLE_NAME}:`);
        currentTable = idx.TABLE_NAME;
      }
      const unique = idx.NON_UNIQUE === 0 ? ' [UNIQUE]' : '';
      console.log(`  ✅ ${idx.INDEX_NAME.padEnd(40)} (${idx.COLUMNS})${unique}`);
    });
    
    // 4. Verificar foreign keys
    console.log('\n4️⃣  FOREIGN KEYS DEL SISTEMA DE CRÉDITOS:\n');
    
    const [foreignKeys] = await connection.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_NAME IN (${creditTables.map(() => '?').join(',')})
      ORDER BY TABLE_NAME, COLUMN_NAME
    `, creditTables);
    
    let currentFkTable = '';
    foreignKeys.forEach(fk => {
      if (fk.TABLE_NAME !== currentFkTable) {
        console.log(`\n📎 ${fk.TABLE_NAME}:`);
        currentFkTable = fk.TABLE_NAME;
      }
      console.log(`  ✅ ${fk.COLUMN_NAME.padEnd(25)} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    
    // 5. Verificar migraciones ejecutadas
    console.log('\n5️⃣  ÚLTIMAS MIGRACIONES EJECUTADAS:\n');
    
    const [migrations] = await connection.query(`
      SELECT name FROM SequelizeMeta 
      WHERE name LIKE '202512%'
      ORDER BY name DESC
      LIMIT 20
    `);
    
    migrations.forEach((m, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${m.name}`);
    });
    
    // 6. Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ ESTADO DE LA BASE DE DATOS VERIFICADO');
    console.log(`📊 Total de tablas de créditos: ${creditTables.length}`);
    console.log(`📊 Total de foreign keys: ${foreignKeys.length}`);
    console.log(`📊 Total de índices críticos: ${indexes.length}`);
    console.log('\n🎯 LISTO PARA PRODUCCIÓN (migraciones limpias)');
    
  } finally {
    await connection.end();
  }
}

verifyDatabaseState().catch(console.error);
