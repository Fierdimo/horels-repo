'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add PLATFORM_FEE_PERCENTAGE setting for marketplace bookings
    await queryInterface.bulkInsert('platform_settings', [
      {
        setting_key: 'PLATFORM_FEE_PERCENTAGE',
        setting_value: '12',
        setting_type: 'NUMBER',
        description: 'Platform commission percentage added to booking payments (e.g., 12 = 12%). The user pays normal cost + this percentage. Only the normal cost is transferred to PMS.',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('platform_settings', {
      setting_key: 'PLATFORM_FEE_PERCENTAGE'
    });
  }
};
