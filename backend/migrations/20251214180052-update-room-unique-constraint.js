'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the global unique constraint on name
    await queryInterface.removeConstraint('rooms', 'name');
    
    // Add composite unique constraint for name + property_id
    await queryInterface.addConstraint('rooms', {
      fields: ['name', 'property_id'],
      type: 'unique',
      name: 'rooms_name_property_unique',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the composite unique constraint
    await queryInterface.removeConstraint('rooms', 'rooms_name_property_unique');
    
    // Restore the global unique constraint on name
    await queryInterface.addConstraint('rooms', {
      fields: ['name'],
      type: 'unique',
      name: 'name',
    });
  },
};
