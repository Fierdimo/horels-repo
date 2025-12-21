'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint on requester_week_id
    await queryInterface.removeConstraint('swap_requests', 'swap_requests_ibfk_2');
    
    // Make requester_week_id nullable
    await queryInterface.changeColumn('swap_requests', 'requester_week_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'DEPRECATED: Use requester_source_type and requester_source_id instead'
    });

    // Also remove constraint on responder_week_id if it exists
    try {
      await queryInterface.removeConstraint('swap_requests', 'swap_requests_ibfk_3');
    } catch (e) {
      // Constraint might not exist
    }

    // Make responder_week_id nullable too
    await queryInterface.changeColumn('swap_requests', 'responder_week_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'DEPRECATED: Use responder_source_type and responder_source_id instead'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // This is a breaking change, rollback not fully supported
    await queryInterface.changeColumn('swap_requests', 'requester_week_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'weeks',
        key: 'id'
      }
    });

    await queryInterface.changeColumn('swap_requests', 'responder_week_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'weeks',
        key: 'id'
      }
    });
  }
};
