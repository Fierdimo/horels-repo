'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('properties', 'tier', {
      type: Sequelize.ENUM('DIAMOND', 'GOLD', 'SILVER_PLUS', 'STANDARD'),
      allowNull: true,
      defaultValue: 'STANDARD',
      comment: 'Property tier for credit valuation (DIAMOND/GOLD/SILVER_PLUS/STANDARD)',
      after: 'location'
    });

    await queryInterface.addColumn('properties', 'location_multiplier', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 1.00,
      comment: 'Location multiplier for credit calculation (e.g., 1.5 for Diamond tier)',
      after: 'tier'
    });

    // Set default multipliers based on tier
    await queryInterface.sequelize.query(`
      UPDATE properties 
      SET location_multiplier = 1.00, tier = 'STANDARD' 
      WHERE tier IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('properties', 'location_multiplier');
    await queryInterface.removeColumn('properties', 'tier');
  }
};
