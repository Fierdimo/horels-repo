'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Check if accommodation_type column already exists
      const table = await queryInterface.describeTable('weeks');
      
      if (table.accommodation_type) {
        console.log('accommodation_type column already exists');
        return;
      }

      // Add the new accommodation_type column
      await queryInterface.addColumn('weeks', 'accommodation_type', {
        type: Sequelize.STRING,
        allowNull: true, // Temporary nullable to allow migration
        comment: 'Type of accommodation (sencilla, duplex, suite, etc.) - inherited from room.type'
      });

      // Migrate data from color to accommodation_type
      // Mapping: red -> standard, blue -> deluxe, white -> suite
      await queryInterface.sequelize.query(`
        UPDATE weeks
        SET accommodation_type = CASE 
          WHEN color = 'red' THEN 'standard'
          WHEN color = 'blue' THEN 'deluxe'
          WHEN color = 'white' THEN 'suite'
          ELSE 'standard'
        END
        WHERE accommodation_type IS NULL
      `);

      // Make accommodation_type NOT NULL after data migration
      await queryInterface.changeColumn('weeks', 'accommodation_type', {
        type: Sequelize.STRING,
        allowNull: false
      });

      // Remove the old color column
      await queryInterface.removeColumn('weeks', 'color');

      console.log('✅ Successfully migrated color to accommodation_type');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      // Check if color column exists
      const table = await queryInterface.describeTable('weeks');
      
      if (table.color) {
        console.log('color column already exists, skipping rollback');
        return;
      }

      // Add color column back
      await queryInterface.addColumn('weeks', 'color', {
        type: Sequelize.ENUM('red', 'blue', 'white'),
        allowNull: true
      });

      // Migrate data back from accommodation_type to color
      // Mapping: standard -> red, deluxe -> blue, suite -> white
      await queryInterface.sequelize.query(`
        UPDATE weeks
        SET color = CASE 
          WHEN accommodation_type = 'standard' THEN 'red'
          WHEN accommodation_type = 'deluxe' THEN 'blue'
          WHEN accommodation_type = 'suite' THEN 'white'
          ELSE 'red'
        END
        WHERE color IS NULL
      `);

      // Make color NOT NULL
      await queryInterface.changeColumn('weeks', 'color', {
        type: Sequelize.ENUM('red', 'blue', 'white'),
        allowNull: false
      });

      // Remove accommodation_type column
      await queryInterface.removeColumn('weeks', 'accommodation_type');

      console.log('✅ Successfully rolled back accommodation_type to color');
    } catch (error) {
      console.error('Error in rollback:', error);
      throw error;
    }
  }
};
