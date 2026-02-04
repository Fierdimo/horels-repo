import mysql from 'mysql2/promise';

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'sw2_user',
      password: 'sw2_password',
      database: 'sw2_db'
    });

    console.log('Adding must_change_password column to users table...');
    
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE 
      COMMENT 'True if user has temporary password and must change it on first login'
    `);
    
    console.log('✓ Column added successfully!');
  } catch (error: any) {
    if (error.message.includes('Duplicate column name')) {
      console.log('✓ Column already exists, skipping...');
    } else {
      console.error('Error adding column:', error.message);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
