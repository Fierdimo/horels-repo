'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Agregar columnas payment_intent_id y payment_status si no existen
      const tableDescription = await queryInterface.describeTable('bookings', { transaction });
      
      if (!tableDescription.payment_intent_id) {
        await queryInterface.addColumn('bookings', 'payment_intent_id', {
          type: Sequelize.STRING,
          allowNull: true,
        }, { transaction });
      }
      
      if (!tableDescription.payment_status) {
        await queryInterface.addColumn('bookings', 'payment_status', {
          type: Sequelize.STRING,
          allowNull: true,
        }, { transaction });
      }
      
      await transaction.commit();
      console.log('Migración completada: Agregadas columnas payment_intent_id y payment_status');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('bookings', 'payment_intent_id', { transaction });
      await queryInterface.removeColumn('bookings', 'payment_status', { transaction });
      
      await transaction.commit();
      console.log('Rollback completado: Removidas columnas payment_intent_id y payment_status');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
