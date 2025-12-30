'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get property IDs (assuming properties exist from previous seeders)
    const properties = await queryInterface.sequelize.query(
      'SELECT id FROM properties LIMIT 3',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (properties.length === 0) {
      console.log('No properties found. Skipping credit booking costs seeder.');
      return;
    }

    const now = new Date();
    const costs = [];

    // Create cost configurations for each property
    properties.forEach(property => {
      // RED Season (High demand - more credits required)
      ['STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'].forEach((roomType, index) => {
        costs.push({
          property_id: property.id,
          room_type: roomType,
          season_type: 'RED',
          credits_per_night: 2 + index, // STANDARD=2, SUPERIOR=3, DELUXE=4, SUITE=5, PRESIDENTIAL=6
          effective_from: now,
          effective_until: null,
          is_active: true,
          notes: `Red season pricing for ${roomType} rooms`,
          created_at: now,
          updated_at: now
        });
      });

      // WHITE Season (Medium demand)
      ['STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'].forEach((roomType, index) => {
        costs.push({
          property_id: property.id,
          room_type: roomType,
          season_type: 'WHITE',
          credits_per_night: 1 + Math.floor(index * 0.75), // STANDARD=1, SUPERIOR=1, DELUXE=2, SUITE=3, PRESIDENTIAL=3
          effective_from: now,
          effective_until: null,
          is_active: true,
          notes: `White season pricing for ${roomType} rooms`,
          created_at: now,
          updated_at: now
        });
      });

      // BLUE Season (Low demand - fewer credits required)
      ['STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'].forEach((roomType, index) => {
        costs.push({
          property_id: property.id,
          room_type: roomType,
          season_type: 'BLUE',
          credits_per_night: 1 + Math.floor(index * 0.5), // STANDARD=1, SUPERIOR=1, DELUXE=1, SUITE=2, PRESIDENTIAL=2
          effective_from: now,
          effective_until: null,
          is_active: true,
          notes: `Blue season pricing for ${roomType} rooms`,
          created_at: now,
          updated_at: now
        });
      });
    });

    await queryInterface.bulkInsert('credit_booking_costs', costs, {});
    console.log(`Seeded ${costs.length} credit booking cost configurations`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('credit_booking_costs', null, {});
  }
};
