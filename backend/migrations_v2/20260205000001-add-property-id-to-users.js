'use strict';

/**
 * Add property_id column to users table
 * Used for assigning staff members to specific properties
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');
    
    // Only add column if it doesn't exist
    if (!tableInfo.property_id) {
      console.log('Adding property_id column to users table...');
      await queryInterface.addColumn('users', 'property_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'timeshare_properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Property assigned to staff users - only used for role=staff'
      });
      console.log('✅ Added property_id column to users');
    } else {
      console.log('⏭️  property_id column already exists');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');
    
    if (tableInfo.property_id) {
      await queryInterface.removeColumn('users', 'property_id');
    }
  }
};
