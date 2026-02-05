'use strict';

/**
 * V2 Migration 1: Create base users table
 * 
 * We reuse the existing users table but ensure it has all necessary fields for V2.
 * This migration is safe to run even if users table already exists.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if users table exists
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes('users')) {
      // Create users table if it doesn't exist
      await queryInterface.createTable('users', {
        id: {
          type: Sequelize.INTEGER, // Signed int to match V2 structure
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
          allowNull: false
        },
        last_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        role: {
          type: Sequelize.ENUM('admin', 'owner', 'guest', 'staff'),
          defaultValue: 'guest',
          allowNull: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'rejected', 'inactive'),
          defaultValue: 'pending',
          allowNull: false
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
        // Stripe integration
        stripe_customer_id: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        // Password reset
        password_reset_token: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        password_reset_expires: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });

      // Add indexes (only if they don't exist)
      try {
        await queryInterface.addIndex('users', ['email'], { 
          unique: true,
          name: 'users_email'
        });
      } catch (e) {
        // Index already exists, skip
      }
      
      try {
        await queryInterface.addIndex('users', ['role', 'status'], {
          name: 'users_role_status'
        });
      } catch (e) {
        // Index already exists, skip
      }
      
      try {
        await queryInterface.addIndex('users', ['stripe_customer_id'], {
          name: 'users_stripe_customer_id'
        });
      } catch (e) {
        // Index already exists, skip
      }
    } else {
      // Users table exists, ensure it has required fields
      const tableDescription = await queryInterface.describeTable('users');
      
      // Add missing columns if needed
      if (!tableDescription.stripe_customer_id) {
        await queryInterface.addColumn('users', 'stripe_customer_id', {
          type: Sequelize.STRING(255),
          allowNull: true
        });
      }
      
      if (!tableDescription.password_reset_token) {
        await queryInterface.addColumn('users', 'password_reset_token', {
          type: Sequelize.STRING(255),
          allowNull: true
        });
      }
      
      if (!tableDescription.password_reset_expires) {
        await queryInterface.addColumn('users', 'password_reset_expires', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }
    }

    console.log('✅ Users table ready for V2');
  },

  down: async (queryInterface, Sequelize) => {
    // Don't drop users table in down - too dangerous
    console.log('⚠️  Users table not dropped - manual intervention required');
  }
};
