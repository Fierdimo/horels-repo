'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('timeshare_properties', 'check_in_time', {
      type: Sequelize.STRING(5),
      allowNull: true,
      defaultValue: '15:00',
      comment: 'Default check-in time in HH:MM format',
      after: 'check_in_day'
    });

    await queryInterface.addColumn('timeshare_properties', 'check_out_time', {
      type: Sequelize.STRING(5),
      allowNull: true,
      defaultValue: '11:00',
      comment: 'Default check-out time in HH:MM format',
      after: 'check_in_time'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('timeshare_properties', 'check_in_time');
    await queryInterface.removeColumn('timeshare_properties', 'check_out_time');
  }
};
