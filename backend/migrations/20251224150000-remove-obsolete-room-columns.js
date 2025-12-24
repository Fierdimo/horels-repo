'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Remove obsolete columns from rooms table
     * These columns were part of the original schema but are not needed
     * in the "Reference Only" PMS architecture where all room data comes
     * from the PMS in real-time.
     * 
     * The rooms table should only store:
     * - id (PK)
     * - pms_resource_id (PMS mapping)
     * - property_id (FK)
     * - room_type_id (local categorization, nullable)
     * - custom_price (local override)
     * - is_marketplace_enabled (staff control)
     * - images (marketing content)
     * - pms_last_sync (audit trail)
     * - createdAt, updatedAt (timestamps)
     */

    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop unique constraint/index on name if it exists
      try {
        await queryInterface.removeIndex('rooms', 'rooms_name_property_unique', { transaction });
      } catch (e) {
        console.log('Index rooms_name_property_unique does not exist, skipping...');
      }

      try {
        await queryInterface.removeIndex('rooms', 'name', { transaction });
      } catch (e) {
        console.log('Index name does not exist, skipping...');
      }

      // Remove obsolete columns
      try {
        await queryInterface.removeColumn('rooms', 'name', { transaction });
        console.log('✅ Removed column: name');
      } catch (e) {
        console.log('Column name does not exist, skipping...');
      }

      try {
        await queryInterface.removeColumn('rooms', 'description', { transaction });
        console.log('✅ Removed column: description');
      } catch (e) {
        console.log('Column description does not exist, skipping...');
      }

      try {
        await queryInterface.removeColumn('rooms', 'capacity', { transaction });
        console.log('✅ Removed column: capacity');
      } catch (e) {
        console.log('Column capacity does not exist, skipping...');
      }

      await transaction.commit();
      console.log('✅ Migration completed: removed obsolete room columns');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed, rolled back:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Restore removed columns
     * Note: This will restore the schema but data loss will have occurred
     */
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.addColumn('rooms', 'name', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Room',
      }, { transaction });

      await queryInterface.addColumn('rooms', 'description', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('rooms', 'capacity', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      }, { transaction });

      // Restore unique constraint on name
      await queryInterface.addIndex('rooms', ['name', 'property_id'], {
        unique: true,
        name: 'rooms_name_property_unique',
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
