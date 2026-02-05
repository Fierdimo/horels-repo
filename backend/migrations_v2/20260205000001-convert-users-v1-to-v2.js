'use strict';

/**
 * Migration to convert V1 users table structure to V2
 * Adds missing columns and renames existing ones
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');
    
    // Rename password -> password_hash if password exists
    if (tableInfo.password && !tableInfo.password_hash) {
      console.log('Renaming password -> password_hash...');
      await queryInterface.renameColumn('users', 'password', 'password_hash');
    }
    
    // Add password_hash if it doesn't exist
    if (!tableInfo.password_hash) {
      console.log('Adding password_hash column...');
      await queryInterface.addColumn('users', 'password_hash', {
        type: Sequelize.STRING(255),
        allowNull: false
      });
    }
    
    // Change role_id to role enum if role_id exists
    if (tableInfo.role_id && !tableInfo.role) {
      console.log('Adding role column...');
      await queryInterface.addColumn('users', 'role', {
        type: Sequelize.ENUM('admin', 'owner', 'guest', 'staff'),
        allowNull: true
      });
      
      // Migrate data: role_id 4 = admin, 2 = owner, 3 = guest, etc
      await queryInterface.sequelize.query(`
        UPDATE users SET role = 
          CASE role_id
            WHEN 4 THEN 'admin'
            WHEN 2 THEN 'owner'
            WHEN 3 THEN 'guest'
            WHEN 1 THEN 'staff'
            ELSE 'guest'
          END
      `);
      
      // Make role NOT NULL after data migration
      await queryInterface.changeColumn('users', 'role', {
        type: Sequelize.ENUM('admin', 'owner', 'guest', 'staff'),
        allowNull: false,
        defaultValue: 'guest'
      });
    }
    
    // Rename createdAt/updatedAt to created_at/updated_at
    if (tableInfo.createdAt && !tableInfo.created_at) {
      console.log('Renaming createdAt -> created_at...');
      await queryInterface.renameColumn('users', 'createdAt', 'created_at');
    }
    
    if (tableInfo.updatedAt && !tableInfo.updated_at) {
      console.log('Renaming updatedAt -> updated_at...');
      await queryInterface.renameColumn('users', 'updatedAt', 'updated_at');
    }
    
    // Add missing V2 columns
    if (!tableInfo.email_verified) {
      await queryInterface.addColumn('users', 'email_verified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });
    }
    
    if (!tableInfo.email_verified_at) {
      await queryInterface.addColumn('users', 'email_verified_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    
    if (!tableInfo.last_login_at) {
      await queryInterface.addColumn('users', 'last_login_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    
    if (!tableInfo.must_change_password) {
      await queryInterface.addColumn('users', 'must_change_password', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });
    }
    
    console.log('✅ Users table converted to V2 structure');
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse migrations
    await queryInterface.renameColumn('users', 'password_hash', 'password');
    await queryInterface.renameColumn('users', 'created_at', 'createdAt');
    await queryInterface.renameColumn('users', 'updated_at', 'updatedAt');
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.removeColumn('users', 'email_verified');
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.removeColumn('users', 'last_login_at');
    await queryInterface.removeColumn('users', 'must_change_password');
  }
};
