'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('weeks', 'season_type', {
      type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
      allowNull: true, // Nullable for existing records
      comment: 'Season type for credit calculation (RED/WHITE/BLUE)',
      after: 'accommodation_type'
    });

    // Set default season for existing weeks based on dates or default to WHITE
    await queryInterface.sequelize.query(`
      UPDATE weeks 
      SET season_type = 'WHITE' 
      WHERE season_type IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('weeks', 'season_type');
  }
};
