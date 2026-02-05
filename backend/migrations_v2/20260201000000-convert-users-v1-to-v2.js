'use strict';

/**
 * Migration to convert V1 users table structure to V2
 * Creates V2 users table if it doesn't exist, or converts V1 structure to V2
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if users table exists
    const tables = await queryInterface.showAllTables();
    const usersTableExists = tables.includes('users');
    
    // If table doesn't exist, create it with V2 structure
    if (!usersTableExists) {
      console.log('Creating users table with V2 structure...');
      await queryInterface.createTable('users', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        first_name: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        last_name: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        role: {
          type: Sequelize.ENUM('admin', 'owner', 'guest', 'staff'),
          allowNull: false,
          defaultValue: 'guest'
        },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'rejected', 'inactive'),
          defaultValue: 'pending'
        },
        phone: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        email_verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        email_verified_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        last_login_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        must_change_password: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('✅ Users table created with V2 structure');
      return;
    }
    
    // Table exists - convert V1 to V2
    console.log('Converting existing V1 users table to V2...');
    const tableInfo = await queryInterface.describeTable('users');
    
    // Rename password -> password_hash if password exists and password_hash doesn't
    if (tableInfo.password && !tableInfo.password_hash) {
      console.log('Renaming password -> password_hash...');
      await queryInterface.renameColumn('users', 'password', 'password_hash');
    }
    // Add password_hash if neither exists
    else if (!tableInfo.password && !tableInfo.password_hash) {
      console.log('Adding password_hash column...');
      await queryInterface.addColumn('users', 'password_hash', {
        type: Sequelize.STRING(255),
        allowNull: false
      });
    }
    // If password_hash already exists, do nothing
    else if (tableInfo.password_hash) {
      console.log('password_hash already exists, skipping...');
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
      
      // Remove role_id column
      console.log('Removing role_id column...');
      await queryInterface.removeColumn('users', 'role_id');
    }
    else if (tableInfo.role_id && tableInfo.role) {
      // Both exist - remove role_id
      console.log('role column exists, removing role_id...');
      await queryInterface.removeColumn('users', 'role_id');
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
