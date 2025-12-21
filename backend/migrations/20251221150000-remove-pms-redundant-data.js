'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Remove redundant PMS data from rooms table
     * These fields are already available from the PMS API and should be fetched in real-time
     * instead of storing copies that can become out of sync.
     * 
     * Keeping only:
     * - pms_resource_id (mapeo único)
     * - property_id (FK)
     * - room_type_id (categorización local)
     * - custom_price (override local)
     * - is_marketplace_enabled (decisión del staff)
     * - images (contenido marketing)
     * - pms_last_sync (auditoría)
     */

    // Remove redundant PMS fields (in order they were added)
    // Use snake_case to match actual column names in database
    try {
      await queryInterface.removeColumn('rooms', 'type');
    } catch (e) { /* column might not exist */ }
    
    try {
      await queryInterface.removeColumn('rooms', 'floor');
    } catch (e) { /* column might not exist */ }
    
    try {
      await queryInterface.removeColumn('rooms', 'status');
    } catch (e) { /* column might not exist */ }
    
    try {
      await queryInterface.removeColumn('rooms', 'amenities');
    } catch (e) { /* column might not exist */ }
    
    try {
      await queryInterface.removeColumn('rooms', 'basePrice');
    } catch (e) { /* column might not exist */ }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Restore removed columns
     * Note: This will restore the schema but data loss may have occurred
     */
    await queryInterface.addColumn('rooms', 'type', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('rooms', 'floor', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('rooms', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'available',
    });

    await queryInterface.addColumn('rooms', 'amenities', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn('rooms', 'basePrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  }
};
