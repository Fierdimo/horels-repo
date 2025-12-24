'use strict';

/**
 * Migration: Fix room_type_id to allow NULL values
 * The room_type_id field should be optional as it's used for local categorization only.
 * PMS rooms don't necessarily have a room_type assigned initially.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Get the foreign key constraint name
      const [constraints] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'rooms' 
         AND COLUMN_NAME = 'room_type_id' 
         AND REFERENCED_TABLE_NAME IS NOT NULL;`,
        { transaction }
      );

      // 2. Drop the foreign key constraint if it exists
      if (constraints && constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME;
        await queryInterface.sequelize.query(
          `ALTER TABLE rooms DROP FOREIGN KEY ${constraintName};`,
          { transaction }
        );
      }

      // 3. Modify the column to allow NULL
      await queryInterface.changeColumn('rooms', 'room_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }, { transaction });

      // 4. Re-add the foreign key constraint
      await queryInterface.addConstraint('rooms', {
        fields: ['room_type_id'],
        type: 'foreign key',
        name: 'rooms_room_type_id_fk',
        references: {
          table: 'room_types',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Drop the foreign key constraint
      await queryInterface.removeConstraint('rooms', 'rooms_room_type_id_fk', { transaction });

      // 2. Revert to NOT NULL (this might fail if there are NULL values)
      await queryInterface.changeColumn('rooms', 'room_type_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      }, { transaction });

      // 3. Re-add the foreign key constraint
      await queryInterface.addConstraint('rooms', {
        fields: ['room_type_id'],
        type: 'foreign key',
        name: 'rooms_room_type_id_fk',
        references: {
          table: 'room_types',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
