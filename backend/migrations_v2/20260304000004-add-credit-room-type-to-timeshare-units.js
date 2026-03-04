'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('timeshare_units', 'credit_room_type', {
      type: Sequelize.ENUM('STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'),
      allowNull: true,
      defaultValue: null,
      comment: 'Admin override for credit formula room type. NULL = auto-detect from category name',
      after: 'room_type_multiplier',
    });
    console.log('✅ Added credit_room_type column to timeshare_units table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('timeshare_units', 'credit_room_type');
  },
};
