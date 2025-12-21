'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('swap_requests', 'requester_source_type', {
      type: Sequelize.ENUM('week', 'booking'),
      allowNull: false,
      defaultValue: 'week',
      comment: 'Type of requester source: week or booking'
    });

    await queryInterface.addColumn('swap_requests', 'requester_source_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'ID of the week or booking being offered'
    });

    await queryInterface.addColumn('swap_requests', 'responder_source_type', {
      type: Sequelize.ENUM('week', 'booking'),
      allowNull: true,
      comment: 'Type of responder source: week or booking'
    });

    await queryInterface.addColumn('swap_requests', 'responder_source_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ID of the week or booking being offered by responder'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('swap_requests', 'requester_source_type');
    await queryInterface.removeColumn('swap_requests', 'requester_source_id');
    await queryInterface.removeColumn('swap_requests', 'responder_source_type');
    await queryInterface.removeColumn('swap_requests', 'responder_source_id');
  }
};
