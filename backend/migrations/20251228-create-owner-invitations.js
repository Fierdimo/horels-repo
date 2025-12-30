'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('owner_invitations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      token: {
        type: Sequelize.STRING(64),
        unique: true,
        allowNull: false,
        comment: 'Unique token for invitation link'
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Email address of invitee'
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Pre-filled first name (optional)'
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Pre-filled last name (optional)'
      },
      created_by_staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Staff member who created the invitation'
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Property for assigned weeks'
      },
      weeks_data: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array of week assignments: [{start_date, end_date, accommodation_type}]'
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'expired', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false
      },
      accepted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the invitation was accepted'
      },
      created_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User created from this invitation'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Invitation expiration date (default 30 days)'
      },
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

    // Indexes
    await queryInterface.addIndex('owner_invitations', ['token']);
    await queryInterface.addIndex('owner_invitations', ['email']);
    await queryInterface.addIndex('owner_invitations', ['status']);
    await queryInterface.addIndex('owner_invitations', ['created_by_staff_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('owner_invitations');
  }
};
