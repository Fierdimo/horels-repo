'use strict';

/**
 * Migration: Drop legacy credit system tables
 * 
 * Purpose: Clean up old night credits system before implementing new credit system
 * This prevents conflicts and ensures clean implementation of new requirements
 * 
 * Tables to drop (IF THEY EXIST):
 * 1. night_credit_requests - Old credit request system
 * 2. night_credits - Old credit tracking system  
 * 3. fees - Old fee tracking system (swap_fee, conversion_fee)
 * 4. platform_settings (old version) - Will be recreated with new schema
 * 
 * Note: Uses DROP TABLE IF EXISTS for clean production deployment
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop tables in reverse dependency order to avoid foreign key errors
    // Using IF EXISTS to make this idempotent and safe for production
    
    // 1. Drop night_credit_requests (depends on night_credits)
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS `night_credit_requests`;');
    
    // 2. Remove night_credit_id column from bookings if it exists
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      DROP COLUMN IF EXISTS night_credit_id;
    `);
    
    // 3. Drop fees table
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS `fees`;');
    
    // 4. Drop night_credits table
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS `night_credits`;');
    
    // 5. Drop old platform_settings (will be recreated with new schema)
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS `platform_settings`;');
  },

  down: async (queryInterface, Sequelize) => {
    // This migration is irreversible - dropped tables cannot be restored
    // Data must be restored from backup if needed
  },
};
