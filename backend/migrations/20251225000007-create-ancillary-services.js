'use strict';

/**
 * Migration: Create ancillary_services table
 * 
 * Purpose: Define add-on services available for bookings (halfboard, spa, transfers, etc.)
 * Can be paid with credits or euros
 * 
 * Performance Optimizations:
 * - Composite index (property_id, is_active) for filtering available services
 * - TINYINT for boolean fields (1 byte)
 * - ENUM for pricing_type (1 byte)
 * - Index on category for grouped displays
 * 
 * Query Pattern: Get available services for property
 * SELECT * FROM ancillary_services 
 * WHERE property_id = ? AND is_active = true 
 * ORDER BY category, display_order
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ancillary_services', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Property offering this service',
      },
      service_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Unique service identifier: HALFBOARD, FULLBOARD, SPA_ACCESS, TRANSFER, etc.',
      },
      service_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Display name of service',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed description of what service includes',
      },
      category: {
        type: Sequelize.ENUM('DINING', 'SPA', 'ACTIVITIES', 'TRANSPORT', 'OTHER'),
        allowNull: false,
        comment: 'Service category for UI grouping',
      },
      pricing_type: {
        type: Sequelize.ENUM('PER_PERSON_PER_NIGHT', 'PER_PERSON_PER_STAY', 'PER_BOOKING', 'FIXED'),
        allowNull: false,
        comment: 'How service is priced',
      },
      price_credits: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price in credits (null if not available for credit payment)',
      },
      price_euros: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price in euros (null if not available for euro payment)',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether service is currently available for booking',
      },
      is_mandatory: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether service must be added to booking (e.g., resort fee)',
      },
      requires_advance_booking: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether service must be booked X days in advance',
      },
      advance_booking_days: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: true,
        comment: 'Minimum days in advance for booking (if requires_advance_booking=true)',
      },
      max_quantity: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: true,
        comment: 'Maximum quantity per booking (null = unlimited)',
      },
      display_order: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for UI display within category',
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL to service image/icon',
      },
      created_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
      },
      updated_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'),
      },
    });

    // 🔥 CRITICAL INDEX: Active services per property (most frequent query)
    // Supports: SELECT * FROM ancillary_services WHERE property_id = ? AND is_active = true
    await queryInterface.addIndex('ancillary_services', 
      ['property_id', 'is_active'], 
      {
        name: 'idx_service_property_active',
        using: 'BTREE',
      }
    );

    // Index #2: Category filtering (UI grouped displays)
    await queryInterface.addIndex('ancillary_services', 
      ['category'], 
      {
        name: 'idx_service_category',
        using: 'BTREE',
      }
    );

    // Index #3: Service code lookup (API queries)
    await queryInterface.addIndex('ancillary_services', 
      ['service_code'], 
      {
        name: 'idx_service_code',
        using: 'BTREE',
      }
    );

    // Index #4: Active status (admin filtering)
    await queryInterface.addIndex('ancillary_services', 
      ['is_active'], 
      {
        name: 'idx_service_active',
        using: 'BTREE',
      }
    );

    // Composite index for sorted display
    await queryInterface.addIndex('ancillary_services', 
      ['property_id', 'category', 'display_order'], 
      {
        name: 'idx_service_display',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ancillary_services');
  },
};
