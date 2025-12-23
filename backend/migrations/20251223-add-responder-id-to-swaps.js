'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('swap_requests', 'responder_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      after: 'responder_source_id'
    });

    await queryInterface.addIndex('swap_requests', ['responder_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('swap_requests', ['responder_id']);
    await queryInterface.removeColumn('swap_requests', 'responder_id');
  }
};
