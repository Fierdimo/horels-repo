'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add timeshare commission rate setting
    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'timeshare_commission_rate',
        value: '0.05', // 5% default
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        key: 'timeshare_minimum_commission',
        value: '10.00', // €10 minimum
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('platform_settings', {
      key: {
        [Sequelize.Op.in]: ['timeshare_commission_rate', 'timeshare_minimum_commission']
      }
    });
  }
};
