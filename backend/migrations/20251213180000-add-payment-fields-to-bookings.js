'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar campos de pricing detallado
    await queryInterface.addColumn('bookings', 'hotel_price_per_night', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Precio configurado por el hotel (sin comisión)'
    });

    await queryInterface.addColumn('bookings', 'guest_price_per_night', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Precio que paga el guest por noche (con comisión)'
    });

    await queryInterface.addColumn('bookings', 'commission_per_night', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Comisión de plataforma por noche'
    });

    await queryInterface.addColumn('bookings', 'total_guest_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monto total que paga el guest'
    });

    await queryInterface.addColumn('bookings', 'total_hotel_payout', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monto total que recibe el hotel'
    });

    await queryInterface.addColumn('bookings', 'total_platform_commission', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Comisión total de la plataforma'
    });

    await queryInterface.addColumn('bookings', 'commission_rate', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Porcentaje de comisión aplicado al momento de la reserva'
    });

    // Agregar campos de Stripe
    await queryInterface.addColumn('bookings', 'stripe_payment_intent_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ID del payment intent en Stripe'
    });

    await queryInterface.addColumn('bookings', 'stripe_charge_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ID del charge en Stripe'
    });

    await queryInterface.addColumn('bookings', 'stripe_transfer_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ID de la transferencia al hotel en Stripe'
    });

    await queryInterface.addColumn('bookings', 'payment_status', {
      type: Sequelize.ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Estado del pago en Stripe'
    });

    // Agregar índices para búsquedas frecuentes
    await queryInterface.addIndex('bookings', ['stripe_payment_intent_id'], {
      name: 'idx_bookings_stripe_payment_intent'
    });

    await queryInterface.addIndex('bookings', ['payment_status'], {
      name: 'idx_bookings_payment_status'
    });

    await queryInterface.addIndex('bookings', ['status', 'payment_status'], {
      name: 'idx_bookings_status_payment_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar índices
    await queryInterface.removeIndex('bookings', 'idx_bookings_stripe_payment_intent');
    await queryInterface.removeIndex('bookings', 'idx_bookings_payment_status');
    await queryInterface.removeIndex('bookings', 'idx_bookings_status_payment_status');

    // Eliminar columnas
    await queryInterface.removeColumn('bookings', 'hotel_price_per_night');
    await queryInterface.removeColumn('bookings', 'guest_price_per_night');
    await queryInterface.removeColumn('bookings', 'commission_per_night');
    await queryInterface.removeColumn('bookings', 'total_guest_amount');
    await queryInterface.removeColumn('bookings', 'total_hotel_payout');
    await queryInterface.removeColumn('bookings', 'total_platform_commission');
    await queryInterface.removeColumn('bookings', 'commission_rate');
    await queryInterface.removeColumn('bookings', 'stripe_payment_intent_id');
    await queryInterface.removeColumn('bookings', 'stripe_charge_id');
    await queryInterface.removeColumn('bookings', 'stripe_transfer_id');
    await queryInterface.removeColumn('bookings', 'payment_status');
  }
};
