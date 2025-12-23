'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'acquired_via_swap_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'swap_requests',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'ID of the swap through which this booking was acquired'
    });

    await queryInterface.addIndex('bookings', ['acquired_via_swap_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('bookings', ['acquired_via_swap_id']);
    await queryInterface.removeColumn('bookings', 'acquired_via_swap_id');
  }
};
