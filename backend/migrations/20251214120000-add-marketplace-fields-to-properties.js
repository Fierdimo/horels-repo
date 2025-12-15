'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'is_marketplace_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether this property is enabled for marketplace bookings'
    });

    await queryInterface.addColumn('properties', 'marketplace_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Custom description for marketplace (can be different from main description)'
    });

    await queryInterface.addColumn('properties', 'marketplace_images', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Custom images for marketplace (can be different from main images)'
    });

    await queryInterface.addColumn('properties', 'marketplace_amenities', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Custom amenities list for marketplace (can be different from main amenities)'
    });

    await queryInterface.addColumn('properties', 'marketplace_enabled_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when marketplace was enabled'
    });

    // Automatically enable marketplace for properties that are already pms_verified
    await queryInterface.sequelize.query(`
      UPDATE properties 
      SET is_marketplace_enabled = true, 
          marketplace_enabled_at = NOW()
      WHERE pms_verified = true AND status = 'active'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('properties', 'is_marketplace_enabled');
    await queryInterface.removeColumn('properties', 'marketplace_description');
    await queryInterface.removeColumn('properties', 'marketplace_images');
    await queryInterface.removeColumn('properties', 'marketplace_amenities');
    await queryInterface.removeColumn('properties', 'marketplace_enabled_at');
  }
};
