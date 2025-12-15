'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('night_credit_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      
      // Quién solicita
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Owner requesting to use night credits'
      },
      
      credit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'night_credits',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Night credit being used'
      },
      
      // Qué solicita
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Property where owner wants to stay'
      },
      
      check_in: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Check-in date'
      },
      
      check_out: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Check-out date'
      },
      
      nights_requested: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Number of nights to use from credits'
      },
      
      room_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Preferred room type'
      },
      
      // Estado de aprobación
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'expired', 'completed'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Status of the request'
      },
      
      reviewed_by_staff_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Staff member who reviewed the request'
      },
      
      review_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date when staff reviewed the request'
      },
      
      staff_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes from staff (reason for rejection, special instructions, etc.)'
      },
      
      // Extensión marketplace (opcional)
      additional_nights: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Additional nights owner wants to purchase via marketplace'
      },
      
      additional_price: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Total price for additional nights (excluding commission)'
      },
      
      additional_commission: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Platform commission for additional nights'
      },
      
      payment_intent_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Stripe Payment Intent ID for additional nights payment'
      },
      
      payment_status: {
        type: Sequelize.ENUM('not_required', 'pending', 'paid', 'failed', 'refunded'),
        defaultValue: 'not_required',
        allowNull: false,
        comment: 'Payment status for additional nights'
      },
      
      // Booking resultante
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Booking created when request is completed'
      },
      
      // Metadata
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('night_credit_requests', ['owner_id'], {
      name: 'idx_night_credit_requests_owner'
    });
    
    await queryInterface.addIndex('night_credit_requests', ['credit_id'], {
      name: 'idx_night_credit_requests_credit'
    });
    
    await queryInterface.addIndex('night_credit_requests', ['property_id'], {
      name: 'idx_night_credit_requests_property'
    });
    
    await queryInterface.addIndex('night_credit_requests', ['status'], {
      name: 'idx_night_credit_requests_status'
    });
    
    await queryInterface.addIndex('night_credit_requests', ['reviewed_by_staff_id'], {
      name: 'idx_night_credit_requests_staff'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('night_credit_requests', 'idx_night_credit_requests_staff');
    await queryInterface.removeIndex('night_credit_requests', 'idx_night_credit_requests_status');
    await queryInterface.removeIndex('night_credit_requests', 'idx_night_credit_requests_property');
    await queryInterface.removeIndex('night_credit_requests', 'idx_night_credit_requests_credit');
    await queryInterface.removeIndex('night_credit_requests', 'idx_night_credit_requests_owner');
    
    await queryInterface.dropTable('night_credit_requests');
  }
};
