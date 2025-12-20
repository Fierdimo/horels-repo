'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rooms', 'color', {
      type: Sequelize.ENUM('red', 'blue', 'white'),
      allowNull: true, // Allow null for existing rooms, staff will set colors
      defaultValue: null,
      comment: 'Week color assigned to this room: red (6 nights), blue (5 nights), white (4 nights)'
    });

    // Add index for faster filtering
    await queryInterface.addIndex('rooms', ['color']);
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('rooms', ['color']);
    // Remove column
    await queryInterface.removeColumn('rooms', 'color');
  }
};
