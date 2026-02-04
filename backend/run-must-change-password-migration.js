const { sequelize } = require('./src/models');

async function runMigration() {
  try {
    console.log('Adding must_change_password column to users table...');
    
    await sequelize.getQueryInterface().addColumn('users', 'must_change_password', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if user has temporary password and must change it on first login'
    });
    
    console.log('✓ Column added successfully!');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('✓ Column already exists, skipping...');
      process.exit(0);
    }
    console.error('Error adding column:', error.message);
    process.exit(1);
  }
}

runMigration();
