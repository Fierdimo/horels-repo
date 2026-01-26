'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('owner_invitations');
    
    // Rename weeks_data to rooms_data if weeks_data exists
    if (tableInfo.weeks_data && !tableInfo.rooms_data) {
      await queryInterface.renameColumn('owner_invitations', 'weeks_data', 'rooms_data');
    }
    
    // Add property_id column only if it doesn't exist
    if (!tableInfo.property_id) {
      await queryInterface.addColumn('owner_invitations', 'property_id', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null for existing records
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Add acceptance_type column only if it doesn't exist
    if (!tableInfo.acceptance_type) {
      await queryInterface.addColumn('owner_invitations', 'acceptance_type', {
        type: Sequelize.ENUM('booking', 'credits'),
        allowNull: true, // Will be set when invitation is accepted
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('owner_invitations');
    
    // Remove acceptance_type column if it exists
    if (tableInfo.acceptance_type) {
      await queryInterface.removeColumn('owner_invitations', 'acceptance_type');
    }
    
    // Remove property_id column if it exists (only if we added it)
    // Note: We don't remove if it was already there before migration
    
    // Rename back to weeks_data if rooms_data exists
    if (tableInfo.rooms_data && !tableInfo.weeks_data) {
      await queryInterface.renameColumn('owner_invitations', 'rooms_data', 'weeks_data');
    }
  },
};
