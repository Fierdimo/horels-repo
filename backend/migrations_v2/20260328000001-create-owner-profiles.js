'use strict';

/**
 * Migration: Create owner_profiles table
 *
 * Extends `users` with Italian-specific timeshare owner fields:
 * fiscal codes, certified email (PEC), additional phones, fax.
 *
 * See: docs_v2/TIMESHARE_BULK_IMPORT.md - Schema Mapping
 * See: docs_v2/DATABASE_DESIGN.md - Table 10: owner_profiles
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('owner_profiles')) {
      console.log('⏭️  owner_profiles table already exists');
      return;
    }

    await queryInterface.createTable('owner_profiles', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER, // matches users.id (signed int)
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // Legal / display name
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Verbatim from source file (Multiproprietari). May be company name.'
      },

      // Address
      address: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      province: {
        type: Sequelize.STRING(5),
        allowNull: true,
        comment: '2-letter IT province code. EE = foreign resident.'
      },
      country: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'Italy'
      },

      // Italian fiscal identifiers
      tax_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Codice fiscale (individuals)'
      },
      vat_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Partita IVA (companies)'
      },

      // Additional contact info (users.phone holds the primary phone)
      phone_2: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      phone_3: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      fax: {
        type: Sequelize.STRING(30),
        allowNull: true,
        comment: 'NULL when source contained ESONERO'
      },
      pec: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Italian certified email (Posta Elettronica Certificata)'
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('owner_profiles', ['full_name'], {
      name: 'idx_owner_profiles_full_name'
    });
    await queryInterface.addIndex('owner_profiles', ['tax_code'], {
      name: 'idx_owner_profiles_tax_code'
    });
    await queryInterface.addIndex('owner_profiles', ['vat_number'], {
      name: 'idx_owner_profiles_vat'
    });

    console.log('✅ Created owner_profiles table');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('owner_profiles');
  }
};
