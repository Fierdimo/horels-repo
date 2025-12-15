import sequelize from './src/config/database';
import { DataTypes } from 'sequelize';

async function migrate() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    
    console.log('Adding first_name column...');
    await queryInterface.addColumn('users', 'first_name', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    console.log('Adding last_name column...');
    await queryInterface.addColumn('users', 'last_name', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    console.log('Adding phone column...');
    await queryInterface.addColumn('users', 'phone', {
      type: DataTypes.STRING,
      allowNull: true
    });
    
    console.log('Adding address column...');
    await queryInterface.addColumn('users', 'address', {
      type: DataTypes.TEXT,
      allowNull: true
    });
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
