'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rooms', 'credit_room_type', {
      type: Sequelize.ENUM('STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'),
      allowNull: true,
      defaultValue: null,
      comment: 'Admin-assigned formula room type override. When set, takes precedence over auto-detection from pms type.'
    });
    console.log('✅ Added credit_room_type column to rooms table');
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('rooms', 'credit_room_type');
    // MySQL requires dropping the ENUM type explicitly
    try {
      await queryInterface.sequelize.query(
        "ALTER TABLE rooms DROP COLUMN IF EXISTS credit_room_type"
      );
    } catch (e) { /* ignore if already removed */ }
  }
};
