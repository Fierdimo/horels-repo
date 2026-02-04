'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add property_id column to users table
    await queryInterface.addColumn('users', 'property_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true, // Nullable porque no todos los usuarios son staff
      references: {
        model: 'properties',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Si se borra la propiedad, el staff queda sin property_id
      comment: 'Property assigned to staff users - only used for role=staff'
    });

    // Add index for faster queries
    await queryInterface.addIndex('users', ['property_id'], {
      name: 'idx_users_property_id'
    });

    console.log('✅ Added property_id column to users table');
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('users', 'idx_users_property_id');
    
    // Remove column
    await queryInterface.removeColumn('users', 'property_id');
    
    console.log('✅ Removed property_id column from users table');
  }
};
