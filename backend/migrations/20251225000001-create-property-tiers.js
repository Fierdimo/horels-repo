'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('property_tiers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Tier name: DIAMOND, GOLD, SILVER_PLUS, STANDARD'
      },
      multiplier: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        comment: 'Location multiplier for credit calculations (1.0 - 1.5)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for displaying tiers in UI'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Insert the 4 tiers as defined by client
    await queryInterface.bulkInsert('property_tiers', [
      {
        name: 'DIAMOND',
        multiplier: 1.5,
        description: 'Premium properties: Green Park Hotel (Cala di Volpe), Hotel Perla (Madonna di Campiglio)',
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'GOLD_HIGH',
        multiplier: 1.3,
        description: 'High gold tier: Sport Hotel Astoria (Alta Badia - Coming Soon)',
        display_order: 2,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'GOLD',
        multiplier: 1.2,
        description: 'Gold tier: Parc Hotel Posta (S. Vigilio), Palace Pontedilegno Resort',
        display_order: 3,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'SILVER_PLUS',
        multiplier: 1.1,
        description: 'Silver+ tier: Sporting Tanca Manna (Cannigione), La Rondinaia (Lake Garda), Hotel Ostuni (Coming Soon)',
        display_order: 4,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'STANDARD',
        multiplier: 1.0,
        description: 'Standard tier: Hotel Palazzo Caveja (Rimini)',
        display_order: 5,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('property_tiers');
  }
};
