'use strict';

/**
 * Migration: Modify bookings table for credit system
 * 
 * Purpose: Add credit payment support to bookings
 * 
 * Performance Optimizations:
 * - Index on payment_method for payment type reports
 * - Composite index (user_id, payment_method) for user payment history
 * - Index on paid_with_credits for credit usage analytics
 * 
 * Changes:
 * 1. Add payment_method (CREDITS, EUROS, HYBRID, P2P_SWAP)
 * 2. Add credit_amount_paid
 * 3. Add euro_amount_paid
 * 4. Add topup_required (for hybrid payments)
 * 5. Add credit_refund_amount (for cancellations)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add payment method for booking
    await queryInterface.addColumn('bookings', 'payment_method', {
      type: Sequelize.ENUM('CREDITS', 'EUROS', 'HYBRID', 'P2P_SWAP'),
      allowNull: true, // Nullable for existing bookings
      after: 'status',
      comment: 'How booking was paid: CREDITS (100% credits), EUROS (100% cash), HYBRID (credits + cash topup), P2P_SWAP (direct week swap)',
    });

    // Credits paid for booking
    await queryInterface.addColumn('bookings', 'credit_amount_paid', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'payment_method',
      comment: 'Amount paid in credits (null if paid in euros)',
    });

    // Euros paid for booking
    await queryInterface.addColumn('bookings', 'euro_amount_paid', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'credit_amount_paid',
      comment: 'Amount paid in euros (includes topup for hybrid payments)',
    });

    // Topup required flag
    await queryInterface.addColumn('bookings', 'topup_required', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'euro_amount_paid',
      comment: 'Whether user had to pay cash topup (hybrid payment)',
    });

    // Topup amount
    await queryInterface.addColumn('bookings', 'topup_amount_euros', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'topup_required',
      comment: 'Euro topup amount for hybrid payments',
    });

    // Credits refunded on cancellation
    await queryInterface.addColumn('bookings', 'credit_refund_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'topup_amount_euros',
      comment: 'Credits refunded if booking was cancelled',
    });

    // Credit-to-euro rate at booking time
    await queryInterface.addColumn('bookings', 'credit_conversion_rate', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
      after: 'credit_refund_amount',
      comment: 'Credit-to-euro rate at time of booking (historical snapshot)',
    });

    // Booking cost calculation metadata
    await queryInterface.addColumn('bookings', 'payment_calculation_metadata', {
      type: Sequelize.JSON,
      allowNull: true,
      after: 'credit_conversion_rate',
      comment: 'Detailed payment breakdown: {nights, room_rate_per_night, season_rates, ancillary_costs}',
    });

    // 🔥 CRITICAL INDEX: Payment method analytics
    await queryInterface.addIndex('bookings', ['payment_method'], {
      name: 'idx_bookings_payment_method',
      using: 'BTREE',
    });

    // Index for credit usage reports
    await queryInterface.addIndex('bookings', ['credit_amount_paid'], {
      name: 'idx_bookings_credit_paid',
      using: 'BTREE',
    });

    // Index for hybrid payment analytics
    await queryInterface.addIndex('bookings', ['topup_required'], {
      name: 'idx_bookings_topup',
      using: 'BTREE',
    });

    // Composite index for property credit bookings
    await queryInterface.addIndex('bookings', ['property_id', 'payment_method'], {
      name: 'idx_bookings_property_payment',
      using: 'BTREE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('bookings', 'idx_bookings_property_payment');
    await queryInterface.removeIndex('bookings', 'idx_bookings_topup');
    await queryInterface.removeIndex('bookings', 'idx_bookings_credit_paid');
    await queryInterface.removeIndex('bookings', 'idx_bookings_payment_method');
    
    await queryInterface.removeColumn('bookings', 'payment_calculation_metadata');
    await queryInterface.removeColumn('bookings', 'credit_conversion_rate');
    await queryInterface.removeColumn('bookings', 'credit_refund_amount');
    await queryInterface.removeColumn('bookings', 'topup_amount_euros');
    await queryInterface.removeColumn('bookings', 'topup_required');
    await queryInterface.removeColumn('bookings', 'euro_amount_paid');
    await queryInterface.removeColumn('bookings', 'credit_amount_paid');
    await queryInterface.removeColumn('bookings', 'payment_method');
  },
};
