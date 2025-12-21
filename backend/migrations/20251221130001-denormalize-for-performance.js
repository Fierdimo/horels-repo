'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Adding denormalization fields for performance...');

      // 1. Add accommodation_type to swap_requests (denormalization)
      // This avoids JOINs with weeks table in matching queries
      await queryInterface.addColumn('swap_requests', 'accommodation_type', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Denormalized from weeks.accommodation_type - used for efficient swap matching'
      });
      console.log('✅ Added accommodation_type to swap_requests');

      // Populate accommodation_type from weeks table
      await queryInterface.sequelize.query(`
        UPDATE swap_requests sr
        JOIN weeks w ON sr.requester_week_id = w.id
        SET sr.accommodation_type = w.accommodation_type
        WHERE sr.accommodation_type IS NULL
      `);
      console.log('✅ Populated accommodation_type in swap_requests');

      // Create index on accommodation_type for efficient matching
      await queryInterface.addIndex('swap_requests', {
        fields: ['accommodation_type'],
        name: 'idx_swaps_accommodation_type',
        comment: 'Optimizes swap matching by accommodation type'
      });
      console.log('✅ Added idx_swaps_accommodation_type to swap_requests');

      // 2. Add property_id to night_credits (denormalization)
      // This allows filtering credits by property without JOINs
      await queryInterface.addColumn('night_credits', 'property_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Denormalized from weeks through original_week_id - enables property-level filtering'
      });
      console.log('✅ Added property_id to night_credits');

      // Populate property_id from original_week_id
      await queryInterface.sequelize.query(`
        UPDATE night_credits nc
        JOIN weeks w ON nc.original_week_id = w.id
        SET nc.property_id = w.property_id
        WHERE nc.property_id IS NULL
      `);
      console.log('✅ Populated property_id in night_credits');

      // Create index for property-level filtering
      await queryInterface.addIndex('night_credits', {
        fields: ['property_id', 'status'],
        name: 'idx_night_credits_property_status',
        comment: 'Optimizes filtering credits by property'
      });
      console.log('✅ Added idx_night_credits_property_status to night_credits');

      // 3. Add tracking columns for night credits
      await queryInterface.addColumn('night_credits', 'used_nights', {
        type: Sequelize.INTEGER.UNSIGNED,
        defaultValue: 0,
        comment: 'Number of nights consumed from this credit batch'
      });
      console.log('✅ Added used_nights to night_credits');

      await queryInterface.addColumn('night_credits', 'last_used_date', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last usage of these credits'
      });
      console.log('✅ Added last_used_date to night_credits');

      console.log('✅ All denormalization fields added successfully!');
    } catch (error) {
      console.error('Error adding denormalization fields:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing denormalization fields...');

      // Remove indices first
      const indices = [
        { table: 'swap_requests', name: 'idx_swaps_accommodation_type' },
        { table: 'night_credits', name: 'idx_night_credits_property_status' },
      ];

      for (const idx of indices) {
        try {
          await queryInterface.removeIndex(idx.table, idx.name);
          console.log(`✅ Removed ${idx.name}`);
        } catch (e) {
          console.log(`⚠️ Index ${idx.name} not found`);
        }
      }

      // Remove columns
      await queryInterface.removeColumn('swap_requests', 'accommodation_type');
      console.log('✅ Removed accommodation_type from swap_requests');

      await queryInterface.removeColumn('night_credits', 'property_id');
      console.log('✅ Removed property_id from night_credits');

      await queryInterface.removeColumn('night_credits', 'used_nights');
      console.log('✅ Removed used_nights from night_credits');

      await queryInterface.removeColumn('night_credits', 'last_used_date');
      console.log('✅ Removed last_used_date from night_credits');

      console.log('✅ Denormalization rollback completed!');
    } catch (error) {
      console.error('Error removing denormalization fields:', error);
      throw error;
    }
  }
};
