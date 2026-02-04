const mysql = require('mysql2/promise');

async function checkSettings() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'sw2_user',
      password: 'sw2_password',
      database: 'sw2_db'
    });

    console.log('✅ Connected to database\n');

    // Get all platform_settings
    const [allSettings] = await connection.query(
      'SELECT * FROM platform_settings'
    );
    
    console.log('📋 All platform settings:');
    console.log(JSON.stringify(allSettings, null, 2));
    console.log('\n');

    // Check for marketplace_commission_rate specifically
    const [commissionSetting] = await connection.query(
      "SELECT * FROM platform_settings WHERE `key` = 'marketplace_commission_rate'"
    );
    
    console.log('🔍 Commission setting:');
    console.log(JSON.stringify(commissionSetting, null, 2));
    
    if (commissionSetting.length === 0) {
      console.log('\n⚠️  No commission setting found! Creating default...\n');
      
      await connection.query(
        "INSERT INTO platform_settings (`key`, `value`) VALUES ('marketplace_commission_rate', '10')"
      );
      
      console.log('✅ Created default commission setting (10%)');
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSettings();
