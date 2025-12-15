'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('properties', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Hotel description for public display'
    });

    await queryInterface.addColumn('properties', 'amenities', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Hotel amenities (pool, wifi, spa, etc.)'
    });

    await queryInterface.addColumn('properties', 'stars', {
      type: Sequelize.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      },
      comment: 'Hotel star rating (1-5)'
    });

    await queryInterface.addColumn('properties', 'images', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of hotel image URLs'
    });

    // Contact information
    await queryInterface.addColumn('properties', 'contact_phone', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addColumn('properties', 'contact_email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    });

    await queryInterface.addColumn('properties', 'website', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    // Address fields
    await queryInterface.addColumn('properties', 'address', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('properties', 'city', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('properties', 'country', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('properties', 'postal_code', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    // Coordinates
    await queryInterface.addColumn('properties', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Latitude for maps and Secret World integration'
    });

    await queryInterface.addColumn('properties', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Longitude for maps and Secret World integration'
    });

    // PMS Integration
    await queryInterface.addColumn('properties', 'pms_provider', {
      type: Sequelize.ENUM('mews', 'cloudbeds', 'resnexus', 'opera', 'none'),
      defaultValue: 'none',
      allowNull: false,
      comment: 'PMS system provider'
    });

    await queryInterface.addColumn('properties', 'pms_property_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Property ID in the external PMS system (e.g., EnterpriseId in Mews)'
    });

    await queryInterface.addColumn('properties', 'pms_credentials', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Encrypted PMS credentials (JSON)'
    });

    await queryInterface.addColumn('properties', 'pms_config', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'PMS configuration options'
    });

    await queryInterface.addColumn('properties', 'pms_sync_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('properties', 'pms_last_sync', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp of last successful sync'
    });

    await queryInterface.addColumn('properties', 'pms_sync_status', {
      type: Sequelize.ENUM('success', 'failed', 'pending', 'never'),
      defaultValue: 'never',
      allowNull: false
    });

    await queryInterface.addColumn('properties', 'pms_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether PMS connection has been verified'
    });

    await queryInterface.addColumn('properties', 'pms_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Payment configuration
    await queryInterface.addColumn('properties', 'stripe_connect_account_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Stripe Connect account ID for direct payments to hotel'
    });

    await queryInterface.addColumn('properties', 'bank_account_info', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Encrypted bank account information (JSON)'
    });

    await queryInterface.addColumn('properties', 'commission_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 10.00,
      allowNull: false,
      comment: 'Commission percentage for SW2 platform'
    });

    // Operational settings
    await queryInterface.addColumn('properties', 'check_in_time', {
      type: Sequelize.TIME,
      allowNull: true,
      defaultValue: '15:00:00'
    });

    await queryInterface.addColumn('properties', 'check_out_time', {
      type: Sequelize.TIME,
      allowNull: true,
      defaultValue: '11:00:00'
    });

    await queryInterface.addColumn('properties', 'timezone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'Europe/Madrid'
    });

    await queryInterface.addColumn('properties', 'languages', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Supported languages (array of codes: ["es", "en", "fr"])'
    });

    await queryInterface.addColumn('properties', 'cancellation_policy', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Property status
    await queryInterface.addColumn('properties', 'status', {
      type: Sequelize.ENUM('pending_verification', 'active', 'inactive', 'suspended'),
      defaultValue: 'active',
      allowNull: false
    });

    await queryInterface.addColumn('properties', 'verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the property was verified by admin'
    });

    await queryInterface.addColumn('properties', 'verified_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Admin user who verified the property'
    });

    // Add index for PMS lookups
    await queryInterface.addIndex('properties', ['pms_provider', 'pms_property_id'], {
      name: 'idx_pms_property'
    });

    // Add index for status
    await queryInterface.addIndex('properties', ['status'], {
      name: 'idx_property_status'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('properties', 'idx_pms_property');
    await queryInterface.removeIndex('properties', 'idx_property_status');

    // Remove all added columns
    const columnsToRemove = [
      'description', 'amenities', 'stars', 'images',
      'contact_phone', 'contact_email', 'website',
      'address', 'city', 'country', 'postal_code',
      'latitude', 'longitude',
      'pms_provider', 'pms_property_id', 'pms_credentials', 'pms_config',
      'pms_sync_enabled', 'pms_last_sync', 'pms_sync_status',
      'pms_verified', 'pms_verified_at',
      'stripe_connect_account_id', 'bank_account_info', 'commission_percentage',
      'check_in_time', 'check_out_time', 'timezone', 'languages',
      'cancellation_policy',
      'status', 'verified_at', 'verified_by'
    ];

    for (const column of columnsToRemove) {
      await queryInterface.removeColumn('properties', column);
    }
  }
};
