'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('credit_system_config', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      config_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique key for configuration value'
      },
      config_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Numeric value of configuration'
      },
      config_type: {
        type: Sequelize.ENUM(
          'BASE_SEASON',
          'BASE_NIGHTLY',
          'TIER_MULTIPLIER',
          'ROOM_MULTIPLIER',
          'OTHER'
        ),
        allowNull: false,
        comment: 'Category of configuration'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Human-readable description'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      updated_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin user who last updated this config'
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB'
    });

    // Add indexes
    await queryInterface.addIndex('credit_system_config', ['config_type'], {
      name: 'idx_config_type'
    });

    await queryInterface.addIndex('credit_system_config', ['config_key'], {
      name: 'idx_config_key',
      unique: true
    });

    // Seed initial values
    await queryInterface.bulkInsert('credit_system_config', [
      // Base Season Values (for deposits)
      {
        config_key: 'BASE_SEASON_RED',
        config_value: 1000,
        config_type: 'BASE_SEASON',
        description: 'Valor base para semanas de temporada alta (RED)',
        updated_at: new Date()
      },
      {
        config_key: 'BASE_SEASON_WHITE',
        config_value: 600,
        config_type: 'BASE_SEASON',
        description: 'Valor base para semanas de temporada media (WHITE)',
        updated_at: new Date()
      },
      {
        config_key: 'BASE_SEASON_BLUE',
        config_value: 300,
        config_type: 'BASE_SEASON',
        description: 'Valor base para semanas de temporada baja (BLUE)',
        updated_at: new Date()
      },

      // Base Nightly Rates (for bookings)
      {
        config_key: 'BASE_NIGHTLY_RED',
        config_value: 150,
        config_type: 'BASE_NIGHTLY',
        description: 'Costo base por noche en temporada alta',
        updated_at: new Date()
      },
      {
        config_key: 'BASE_NIGHTLY_WHITE',
        config_value: 90,
        config_type: 'BASE_NIGHTLY',
        description: 'Costo base por noche en temporada media',
        updated_at: new Date()
      },
      {
        config_key: 'BASE_NIGHTLY_BLUE',
        config_value: 45,
        config_type: 'BASE_NIGHTLY',
        description: 'Costo base por noche en temporada baja',
        updated_at: new Date()
      },

      // Tier Multipliers
      {
        config_key: 'TIER_DIAMOND',
        config_value: 1.5,
        config_type: 'TIER_MULTIPLIER',
        description: 'Multiplicador para propiedades DIAMOND (premium)',
        updated_at: new Date()
      },
      {
        config_key: 'TIER_GOLD',
        config_value: 1.3,
        config_type: 'TIER_MULTIPLIER',
        description: 'Multiplicador para propiedades GOLD (alta calidad)',
        updated_at: new Date()
      },
      {
        config_key: 'TIER_SILVER_PLUS',
        config_value: 1.1,
        config_type: 'TIER_MULTIPLIER',
        description: 'Multiplicador para propiedades SILVER_PLUS (sobre estándar)',
        updated_at: new Date()
      },
      {
        config_key: 'TIER_STANDARD',
        config_value: 1.0,
        config_type: 'TIER_MULTIPLIER',
        description: 'Multiplicador para propiedades STANDARD',
        updated_at: new Date()
      },

      // Room Type Multipliers
      {
        config_key: 'ROOM_STANDARD',
        config_value: 1.0,
        config_type: 'ROOM_MULTIPLIER',
        description: 'Multiplicador para habitaciones Standard/Studio',
        updated_at: new Date()
      },
      {
        config_key: 'ROOM_SUPERIOR',
        config_value: 1.2,
        config_type: 'ROOM_MULTIPLIER',
        description: 'Multiplicador para habitaciones Superior/1BR',
        updated_at: new Date()
      },
      {
        config_key: 'ROOM_DELUXE',
        config_value: 1.5,
        config_type: 'ROOM_MULTIPLIER',
        description: 'Multiplicador para habitaciones Deluxe/2BR',
        updated_at: new Date()
      },
      {
        config_key: 'ROOM_SUITE',
        config_value: 2.0,
        config_type: 'ROOM_MULTIPLIER',
        description: 'Multiplicador para Suites/3BR',
        updated_at: new Date()
      },
      {
        config_key: 'ROOM_PRESIDENTIAL',
        config_value: 2.5,
        config_type: 'ROOM_MULTIPLIER',
        description: 'Multiplicador para Presidential/Penthouse',
        updated_at: new Date()
      },

      // Other
      {
        config_key: 'CREDIT_TO_EUR_RATE',
        config_value: 0.10,
        config_type: 'OTHER',
        description: 'Tasa de conversión de créditos a euros (1 crédito = €X)',
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('credit_system_config');
  }
};
