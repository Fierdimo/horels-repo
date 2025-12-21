'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Adding critical performance indices...');

      // 1. Weeks table - Availability search (CRITICAL)
      await queryInterface.addIndex('weeks', {
        fields: ['property_id', 'status', 'start_date', 'end_date'],
        name: 'idx_weeks_availability',
        comment: 'Optimizes availability search queries'
      });
      console.log('✅ Added idx_weeks_availability to weeks');

      // 2. Weeks table - Owner status search
      await queryInterface.addIndex('weeks', {
        fields: ['owner_id', 'status'],
        name: 'idx_weeks_owner_status',
        comment: 'Optimizes "my weeks" queries'
      });
      console.log('✅ Added idx_weeks_owner_status to weeks');

      // 3. Swap requests - Available swaps (CRITICAL)
      await queryInterface.addIndex('swap_requests', {
        fields: ['status', 'property_id'],
        name: 'idx_swaps_available',
        comment: 'Optimizes swap matching queries'
      });
      console.log('✅ Added idx_swaps_available to swap_requests');

      // 4. Users table - Property staff lookup
      await queryInterface.addIndex('users', {
        fields: ['property_id', 'role_id'],
        name: 'idx_users_property_role',
        comment: 'Optimizes staff lookup by property'
      });
      console.log('✅ Added idx_users_property_role to users');

      // 5. Night credits - Expiring credits alert
      await queryInterface.addIndex('night_credits', {
        fields: ['status', 'expiry_date'],
        name: 'idx_night_credits_expiring',
        comment: 'Optimizes expiring credits notifications'
      });
      console.log('✅ Added idx_night_credits_expiring to night_credits');

      // 6. Bookings - Stripe reconciliation
      await queryInterface.addIndex('bookings', {
        fields: ['stripe_charge_id'],
        name: 'idx_bookings_stripe_charge',
        comment: 'Optimizes Stripe charge lookups'
      });
      console.log('✅ Added idx_bookings_stripe_charge to bookings');

      console.log('✅ All critical indices added successfully!');
    } catch (error) {
      console.error('Error adding indices:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing critical performance indices...');

      const indices = [
        { table: 'weeks', name: 'idx_weeks_availability' },
        { table: 'weeks', name: 'idx_weeks_owner_status' },
        { table: 'swap_requests', name: 'idx_swaps_available' },
        { table: 'users', name: 'idx_users_property_role' },
        { table: 'night_credits', name: 'idx_night_credits_expiring' },
        { table: 'bookings', name: 'idx_bookings_stripe_charge' },
      ];

      for (const idx of indices) {
        try {
          await queryInterface.removeIndex(idx.table, idx.name);
          console.log(`✅ Removed ${idx.name} from ${idx.table}`);
        } catch (e) {
          console.log(`⚠️ Index ${idx.name} not found (may have been removed already)`);
        }
      }

      console.log('✅ Index rollback completed!');
    } catch (error) {
      console.error('Error removing indices:', error);
      throw error;
    }
  }
};
