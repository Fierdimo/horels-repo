'use strict';

/**
 * Migration: Fix room_type_id to allow NULL values
 * The room_type_id field should be optional as it's used for local categorization only.
 * PMS rooms don't necessarily have a room_type assigned initially.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔧 Making room_type_id nullable...');
      
      // Simply execute the ALTER TABLE statements without checking
      // This is safe because:
      // 1. If FK doesn't exist, DROP will be ignored
      // 2. If column is already NULL, MODIFY is idempotent
      // 3. If FK already exists with same name, ADD will fail but we catch it
      
      // Drop any existing FK constraints (ignore errors if not exists)
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE rooms DROP FOREIGN KEY rooms_room_type_id_fk;`,
          { raw: true }
        );
      } catch (e) {
        // FK might not exist, that's fine
      }

      // Modify the column to allow NULL
      await queryInterface.sequelize.query(
        `ALTER TABLE rooms MODIFY COLUMN room_type_id INT NULL;`,
        { raw: true }
      );

      // Re-add the foreign key constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE rooms 
         ADD CONSTRAINT rooms_room_type_id_fk 
         FOREIGN KEY (room_type_id) 
         REFERENCES room_types(id) 
         ON UPDATE CASCADE 
         ON DELETE SET NULL;`,
        { raw: true }
      );

      console.log('✅ room_type_id column modified to allow NULL');

    } catch (error) {
      console.error('❌ Error in migration:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Use raw SQL for the reverse migration
      // 1. Drop the foreign key constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE rooms DROP FOREIGN KEY rooms_room_type_id_fk;`
      );

      // 2. Revert to NOT NULL (might fail if there are NULL values)
      await queryInterface.sequelize.query(
        `ALTER TABLE rooms MODIFY COLUMN room_type_id INT NOT NULL;`
      );

      // 3. Re-add the foreign key constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE rooms 
         ADD CONSTRAINT rooms_room_type_id_fk 
         FOREIGN KEY (room_type_id) 
         REFERENCES room_types(id) 
         ON UPDATE CASCADE 
         ON DELETE SET NULL;`
      );

    } catch (error) {
      throw error;
    }
  },
};
