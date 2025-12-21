'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('bookings');
    
    // If payment_status column exists and is an ENUM, we need to recreate it
    if (tableDescription.payment_status) {
      // Change the column type from ENUM to VARCHAR
      try {
        await queryInterface.changeColumn('bookings', 'payment_status', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'pending'
        });
        console.log('Successfully changed payment_status column from ENUM to VARCHAR');
      } catch (error) {
        console.log('Error changing column, attempting alternative approach:', error);
        // Alternative: try to modify with a different approach
        await queryInterface.sequelize.query(`
          ALTER TABLE bookings MODIFY COLUMN payment_status VARCHAR(50) NULL DEFAULT 'pending'
        `);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to ENUM
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (tableDescription.payment_status) {
      try {
        await queryInterface.changeColumn('bookings', 'payment_status', {
          type: Sequelize.ENUM('pending', 'processing', 'paid', 'failed', 'refunded'),
          allowNull: true,
          defaultValue: 'pending'
        });
      } catch (error) {
        console.log('Error reverting column:', error);
        await queryInterface.sequelize.query(`
          ALTER TABLE bookings MODIFY COLUMN payment_status ENUM('pending', 'processing', 'paid', 'failed', 'refunded') NULL DEFAULT 'pending'
        `);
      }
    }
  }
};
