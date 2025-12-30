'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('platform_settings', [
      // Tier Multipliers
      {
        setting_key: 'TIER_MULTIPLIER_DIAMOND',
        setting_value: '1.5',
        setting_type: 'NUMBER',
        description: 'Multiplier for DIAMOND tier properties (Cala di Volpe, Madonna)',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'TIER_MULTIPLIER_GOLD',
        setting_value: '1.3',
        setting_type: 'NUMBER',
        description: 'Multiplier for GOLD tier properties (Alta Badia, Pontedilegno)',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'TIER_MULTIPLIER_SILVER_PLUS',
        setting_value: '1.1',
        setting_type: 'NUMBER',
        description: 'Multiplier for SILVER_PLUS tier properties (Cannigione, Garda, Ostuni)',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'TIER_MULTIPLIER_STANDARD',
        setting_value: '1.0',
        setting_type: 'NUMBER',
        description: 'Multiplier for STANDARD tier properties (Rimini)',
        created_at: new Date(),
        updated_at: new Date()
      },
      // Room Type Multipliers
      {
        setting_key: 'ROOM_MULTIPLIER_STANDARD',
        setting_value: '1.0',
        setting_type: 'NUMBER',
        description: 'Multiplier for STANDARD/Classic room types',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'ROOM_MULTIPLIER_SUPERIOR',
        setting_value: '1.2',
        setting_type: 'NUMBER',
        description: 'Multiplier for SUPERIOR/Comfort room types',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'ROOM_MULTIPLIER_DELUXE',
        setting_value: '1.5',
        setting_type: 'NUMBER',
        description: 'Multiplier for DELUXE/Junior Suite room types',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'ROOM_MULTIPLIER_SUITE',
        setting_value: '2.0',
        setting_type: 'NUMBER',
        description: 'Multiplier for SUITE room types',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'ROOM_MULTIPLIER_PRESIDENTIAL',
        setting_value: '2.5',
        setting_type: 'NUMBER',
        description: 'Multiplier for PRESIDENTIAL suite room types',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('platform_settings', {
      setting_key: {
        [Sequelize.Op.in]: [
          'TIER_MULTIPLIER_DIAMOND',
          'TIER_MULTIPLIER_GOLD',
          'TIER_MULTIPLIER_SILVER_PLUS',
          'TIER_MULTIPLIER_STANDARD',
          'ROOM_MULTIPLIER_STANDARD',
          'ROOM_MULTIPLIER_SUPERIOR',
          'ROOM_MULTIPLIER_DELUXE',
          'ROOM_MULTIPLIER_SUITE',
          'ROOM_MULTIPLIER_PRESIDENTIAL'
        ]
      }
    });
  }
};
