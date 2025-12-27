'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'platform_fee_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Platform commission amount charged to customer'
    });

    await queryInterface.addColumn('bookings', 'platform_fee_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Platform commission percentage applied (e.g., 12.00 for 12%)'
    });

    await queryInterface.addColumn('bookings', 'pms_transfer_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Amount transferred to PMS (total_amount - platform_fee_amount)'
    });

    await queryInterface.addColumn('bookings', 'pms_transfer_status', {
      type: Sequelize.ENUM('pending', 'transferred', 'failed'),
      allowNull: true,
      defaultValue: 'pending',
      comment: 'Status of payment transfer to PMS'
    });

    await queryInterface.addColumn('bookings', 'pms_transfer_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Stripe transfer ID for PMS payment'
    });

    await queryInterface.addColumn('bookings', 'pms_transfer_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date when payment was transferred to PMS'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'pms_transfer_date');
    await queryInterface.removeColumn('bookings', 'pms_transfer_id');
    await queryInterface.removeColumn('bookings', 'pms_transfer_status');
    await queryInterface.removeColumn('bookings', 'pms_transfer_amount');
    await queryInterface.removeColumn('bookings', 'platform_fee_percentage');
    await queryInterface.removeColumn('bookings', 'platform_fee_amount');
  }
};
