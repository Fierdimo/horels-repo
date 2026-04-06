'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('owner_profiles', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      full_name:    { type: Sequelize.STRING(255), allowNull: true },
      address:      { type: Sequelize.STRING(500), allowNull: true },
      postal_code:  { type: Sequelize.STRING(20),  allowNull: true },
      city:         { type: Sequelize.STRING(100), allowNull: true },
      province:     { type: Sequelize.STRING(50),  allowNull: true },
      country:      { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Italy' },
      tax_code:     { type: Sequelize.STRING(20),  allowNull: true },
      vat_number:   { type: Sequelize.STRING(20),  allowNull: true },
      phone_2:      { type: Sequelize.STRING(50),  allowNull: true },
      phone_3:      { type: Sequelize.STRING(50),  allowNull: true },
      fax:          { type: Sequelize.STRING(50),  allowNull: true },
      pec:          { type: Sequelize.STRING(255), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('owner_profiles', ['full_name'],  { name: 'idx_owner_profiles_full_name' });
    await queryInterface.addIndex('owner_profiles', ['tax_code'],   { name: 'idx_owner_profiles_tax_code' });
    await queryInterface.addIndex('owner_profiles', ['vat_number'], { name: 'idx_owner_profiles_vat' });

    console.log('✅ Created owner_profiles table');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('owner_profiles');
    console.log('✅ Dropped owner_profiles table');
  },
};
