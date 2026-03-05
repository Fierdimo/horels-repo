'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the legacy 'rooms' table exists before attempting to alter it.
    // V2-only deployments use 'timeshare_units' instead, so this migration is a no-op there.
    const tableNames = await queryInterface.showAllTables();
    if (!tableNames.includes('rooms')) {
      console.log('⚠️  rooms table not found - skipping credit_room_type column (V2 deployment)');
      return;
    }
    await queryInterface.addColumn('rooms', 'credit_room_type', {
      type: Sequelize.ENUM('STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'),
      allowNull: true,
      defaultValue: null,
      comment: 'Admin-assigned formula room type override. When set, takes precedence over auto-detection from pms type.'
    });
    console.log('✅ Added credit_room_type column to rooms table');
  },

  async down(queryInterface) {
    const tableNames = await queryInterface.showAllTables();
    if (!tableNames.includes('rooms')) return;
    await queryInterface.removeColumn('rooms', 'credit_room_type');
    try {
      await queryInterface.sequelize.query(
        "ALTER TABLE rooms DROP COLUMN IF EXISTS credit_room_type"
      );
    } catch (e) { /* ignore if already removed */ }
  }
};
