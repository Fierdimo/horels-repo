'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Make desired_start_date and desired_end_date optional
     * These should be nullable since they represent optional criteria
     */
    await queryInterface.changeColumn('swap_requests', 'desired_start_date', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.changeColumn('swap_requests', 'desired_end_date', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert to NOT NULL for rollback
    await queryInterface.changeColumn('swap_requests', 'desired_start_date', {
      type: Sequelize.DATE,
      allowNull: false
    });

    await queryInterface.changeColumn('swap_requests', 'desired_end_date', {
      type: Sequelize.DATE,
      allowNull: false
    });
  }
};
