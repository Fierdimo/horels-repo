'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column already exists
    const tableInfo = await queryInterface.describeTable('users');
    
    if (!tableInfo.must_change_password) {
      await queryInterface.addColumn('users', 'must_change_password', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if user has temporary password and must change it on first login'
      });
      console.log('✅ Added must_change_password column to users');
    } else {
      console.log('ℹ️  must_change_password column already exists, skipping');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'must_change_password');
  }
};
