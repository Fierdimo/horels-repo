'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add new room_type_id column as nullable
      await queryInterface.addColumn('rooms', 'room_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'room_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Foreign key to room_types table'
      });

      // Migrate data from type (string) to room_type_id (FK)
      // This query maps the existing string values to room_type IDs
      await queryInterface.sequelize.query(`
        UPDATE rooms r
        JOIN room_types rt ON LOWER(r.type) = LOWER(rt.name)
        SET r.room_type_id = rt.id
        WHERE r.type IS NOT NULL
      `);

      // Make room_type_id NOT NULL after migration
      await queryInterface.changeColumn('rooms', 'room_type_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      });

      // Remove the old type column
      await queryInterface.removeColumn('rooms', 'type');

      console.log('✅ Successfully migrated rooms.type to room_type_id FK');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Add type column back as STRING
      await queryInterface.addColumn('rooms', 'type', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Room type (standard, deluxe, suite, etc.)'
      });

      // Migrate data back from room_type_id to type
      await queryInterface.sequelize.query(`
        UPDATE rooms r
        JOIN room_types rt ON r.room_type_id = rt.id
        SET r.type = rt.name
        WHERE r.room_type_id IS NOT NULL
      `);

      // Make type NOT NULL
      await queryInterface.changeColumn('rooms', 'type', {
        type: Sequelize.STRING(255),
        allowNull: false,
      });

      // Remove room_type_id column
      await queryInterface.removeColumn('rooms', 'room_type_id');

      console.log('✅ Successfully rolled back room_type_id to type column');
    } catch (error) {
      console.error('Error in rollback:', error);
      throw error;
    }
  }
};
