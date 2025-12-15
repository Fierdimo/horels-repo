'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add approval workflow fields
    await queryInterface.addColumn('swap_requests', 'reviewed_by_staff_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Staff member who reviewed/approved the request'
    });

    await queryInterface.addColumn('swap_requests', 'staff_approval_status', {
      type: Sequelize.ENUM('pending_review', 'approved', 'rejected'),
      defaultValue: 'pending_review',
      allowNull: false,
      comment: 'Staff approval status for the swap request'
    });

    await queryInterface.addColumn('swap_requests', 'staff_review_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when staff reviewed the request'
    });

    await queryInterface.addColumn('swap_requests', 'staff_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Notes from staff during review (reason for rejection, etc.)'
    });

    await queryInterface.addColumn('swap_requests', 'responder_acceptance', {
      type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Whether the other owner accepted the swap'
    });

    await queryInterface.addColumn('swap_requests', 'responder_acceptance_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when responder accepted/rejected'
    });

    // Payment tracking
    await queryInterface.addColumn('swap_requests', 'commission_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Commission charged for this swap (calculated based on platform settings)'
    });

    await queryInterface.addColumn('swap_requests', 'payment_intent_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Stripe Payment Intent ID for commission payment'
    });

    await queryInterface.addColumn('swap_requests', 'payment_status', {
      type: Sequelize.ENUM('pending', 'paid', 'refunded', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Payment status for the swap commission'
    });

    await queryInterface.addColumn('swap_requests', 'paid_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when commission was paid'
    });

    // Property context for staff filtering
    await queryInterface.addColumn('swap_requests', 'property_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'properties',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Property associated with this swap (from requester week)'
    });

    // Add indexes for staff queries
    await queryInterface.addIndex('swap_requests', ['staff_approval_status'], {
      name: 'idx_swap_requests_staff_approval'
    });
    await queryInterface.addIndex('swap_requests', ['payment_status'], {
      name: 'idx_swap_requests_payment_status'
    });
    await queryInterface.addIndex('swap_requests', ['property_id'], {
      name: 'idx_swap_requests_property'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('swap_requests', 'idx_swap_requests_property');
    await queryInterface.removeIndex('swap_requests', 'idx_swap_requests_payment_status');
    await queryInterface.removeIndex('swap_requests', 'idx_swap_requests_staff_approval');
    
    await queryInterface.removeColumn('swap_requests', 'property_id');
    await queryInterface.removeColumn('swap_requests', 'paid_at');
    await queryInterface.removeColumn('swap_requests', 'payment_status');
    await queryInterface.removeColumn('swap_requests', 'payment_intent_id');
    await queryInterface.removeColumn('swap_requests', 'commission_amount');
    await queryInterface.removeColumn('swap_requests', 'responder_acceptance_date');
    await queryInterface.removeColumn('swap_requests', 'responder_acceptance');
    await queryInterface.removeColumn('swap_requests', 'staff_notes');
    await queryInterface.removeColumn('swap_requests', 'staff_review_date');
    await queryInterface.removeColumn('swap_requests', 'staff_approval_status');
    await queryInterface.removeColumn('swap_requests', 'reviewed_by_staff_id');
  }
};
