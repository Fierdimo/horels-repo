'use strict';

/**
 * V2 Migration: Add CONVERTED_TO_CREDITS and CANCELLED to ownership status ENUM
 * 
 * Date: 2026-02-03
 * Purpose: Support credit conversion and cancellation workflows
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // For MySQL, we need to modify the column to include all values
    await queryInterface.sequelize.query(`
      ALTER TABLE ownerships 
      MODIFY COLUMN status ENUM(
        'ACTIVE', 
        'SUSPENDED', 
        'TERMINATED', 
        'PENDING_PAYMENT', 
        'CONVERTED_TO_CREDITS', 
        'CANCELLED'
      ) NOT NULL DEFAULT 'ACTIVE'
    `);
    
    console.log('✓ Added CONVERTED_TO_CREDITS and CANCELLED to ownerships.status ENUM');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to original ENUM values
    // WARNING: This will fail if any rows have CONVERTED_TO_CREDITS or CANCELLED status
    await queryInterface.sequelize.query(`
      ALTER TABLE ownerships 
      MODIFY COLUMN status ENUM(
        'ACTIVE', 
        'SUSPENDED', 
        'TERMINATED', 
        'PENDING_PAYMENT'
      ) NOT NULL DEFAULT 'ACTIVE'
    `);
    
    console.log('✓ Removed CONVERTED_TO_CREDITS and CANCELLED from ownerships.status ENUM');
  }
};
