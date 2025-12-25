'use strict';

/**
 * Migration: Create booking_ancillary_services table
 * 
 * Purpose: Link ancillary services to bookings (many-to-many junction table)
 * Tracks which services were added to each booking and payment details
 * 
 * Performance Optimizations:
 * - Composite index (booking_id, service_id) for O(1) service lookup per booking
 * - Index on booking_id for listing all services of a booking
 * - TINYINT for quantity (1 byte, max 255)
 * - ENUM for payment_method (1 byte)
 * 
 * Query Patterns:
 * - Get booking services: SELECT * WHERE booking_id = ?
 * - Calculate booking total: SELECT SUM(total_price) WHERE booking_id = ?
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('booking_ancillary_services', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Booking to which service is attached',
      },
      service_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'ancillary_services',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Ancillary service added to booking',
      },
      quantity: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'Quantity of service (e.g., 2 spa accesses)',
      },
      unit_price_credits: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price per unit in credits (snapshot at booking time)',
      },
      unit_price_euros: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Price per unit in euros (snapshot at booking time)',
      },
      total_price_credits: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Total credits paid (quantity × unit_price_credits)',
      },
      total_price_euros: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Total euros paid (quantity × unit_price_euros)',
      },
      payment_method: {
        type: Sequelize.ENUM('CREDITS', 'EUROS', 'HYBRID'),
        allowNull: false,
        comment: 'How service was paid',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Special instructions or notes about service',
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

    // 🔥 CRITICAL INDEX: Booking services lookup (most frequent query)
    // Supports: SELECT * FROM booking_ancillary_services WHERE booking_id = ?
    await queryInterface.addIndex('booking_ancillary_services', 
      ['booking_id'], 
      {
        name: 'idx_booking_anc_booking',
        using: 'BTREE',
      }
    );

    // Index #2: Prevent duplicate services on same booking
    await queryInterface.addIndex('booking_ancillary_services', 
      ['booking_id', 'service_id'], 
      {
        name: 'idx_booking_anc_unique',
        unique: true,
        using: 'BTREE',
      }
    );

    // Index #3: Service usage reports (which services are most popular)
    await queryInterface.addIndex('booking_ancillary_services', 
      ['service_id'], 
      {
        name: 'idx_booking_anc_service',
        using: 'BTREE',
      }
    );

    // Index #4: Payment method reports
    await queryInterface.addIndex('booking_ancillary_services', 
      ['payment_method'], 
      {
        name: 'idx_booking_anc_payment',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('booking_ancillary_services');
  },
};
