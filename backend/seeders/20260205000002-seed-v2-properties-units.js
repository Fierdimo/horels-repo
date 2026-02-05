'use strict';

/**
 * V2 Seeder: Timeshare properties and units
 * Seeds demo properties with their units for testing
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove existing data to make seeder idempotent
    await queryInterface.bulkDelete('timeshare_units', null, {});
    await queryInterface.bulkDelete('timeshare_properties', null, {});

    // Insert properties
    await queryInterface.bulkInsert('timeshare_properties', [
      {
        id: 1,
        name: 'Sunset Beach Resort Marbella',
        slug: 'sunset-beach-marbella',
        city: 'Marbella',
        country: 'Spain',
        region: 'Costa del Sol',
        latitude: 36.5098,
        longitude: -4.8826,
        address: 'Avenida del Mar, 123',
        postal_code: '29600',
        pms_provider: 'mews',
        pms_property_id: 'MARBELLA-001',
        program_type: 'FLOATING',
        weeks_per_year: 52,
        check_in_day: 'SATURDAY',
        is_active: true,
        description: 'Luxury beachfront resort in Marbella with stunning Mediterranean views',
        amenities: JSON.stringify(['Pool', 'Spa', 'Restaurant', 'Beach Access', 'Gym', 'Kids Club']),
        images: JSON.stringify(['https://example.com/resort1.jpg']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        name: 'Mountain View Retreat Barcelona',
        slug: 'mountain-view-barcelona',
        city: 'Barcelona',
        country: 'Spain',
        region: 'Catalonia',
        latitude: 41.3851,
        longitude: 2.1734,
        address: 'Carrer de Montjuïc, 45',
        postal_code: '08038',
        pms_provider: 'mews',
        pms_property_id: 'BCN-002',
        program_type: 'FIXED_WEEK',
        weeks_per_year: 52,
        check_in_day: 'SUNDAY',
        is_active: true,
        description: 'Premium urban resort with mountain and city views',
        amenities: JSON.stringify(['Pool', 'Restaurant', 'Gym', 'Spa', 'Business Center']),
        images: JSON.stringify(['https://example.com/resort2.jpg']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        name: 'Costa Blanca Family Resort',
        slug: 'costa-blanca-resort',
        city: 'Alicante',
        country: 'Spain',
        region: 'Costa Blanca',
        latitude: 38.3452,
        longitude: -0.4810,
        address: 'Playa de San Juan',
        postal_code: '03540',
        pms_provider: 'mews',
        pms_property_id: 'ALC-003',
        program_type: 'FLOATING',
        weeks_per_year: 52,
        check_in_day: 'SATURDAY',
        is_active: true,
        description: 'Family-friendly resort on the beautiful Costa Blanca',
        amenities: JSON.stringify(['Pool', 'Kids Club', 'Restaurant', 'Beach Access', 'Tennis']),
        images: JSON.stringify(['https://example.com/resort3.jpg']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Seasonal factors for all units (week-by-week multipliers)
    const seasonalFactors = JSON.stringify({
      1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8,  // Low season (Jan)
      5: 0.9, 6: 0.9, 7: 0.9, 8: 0.9,  // Early Feb
      9: 1.0, 10: 1.0, 11: 1.0, 12: 1.0,  // Mid season
      13: 1.1, 14: 1.1, 15: 1.1, 16: 1.1,  // Spring
      17: 1.2, 18: 1.2, 19: 1.2, 20: 1.2,  // Late spring
      21: 1.5, 22: 1.5, 23: 1.5, 24: 1.5,  // Summer HIGH (Jun)
      25: 1.8, 26: 1.8, 27: 1.8, 28: 1.8,  // Peak summer (Jul)
      29: 1.8, 30: 1.8, 31: 1.8, 32: 1.8,  // Peak summer (Aug)
      33: 1.5, 34: 1.5, 35: 1.5, 36: 1.5,  // Early fall
      37: 1.2, 38: 1.2, 39: 1.2, 40: 1.2,  // Fall
      41: 1.0, 42: 1.0, 43: 1.0, 44: 1.0,  // Late fall
      45: 0.9, 46: 0.9, 47: 0.9, 48: 0.9,  // Early winter
      49: 0.8, 50: 0.8, 51: 0.8, 52: 1.3   // Holidays
    });

    // Insert units for Marbella property (LUXURY - highest tier)
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 1,
        category: 'Studio Ocean View',
        slug: 'studio-ocean-marbella',
        capacity_min: 2,
        capacity_max: 2,
        quantity: 8,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 35,
        base_credit_value: 1000.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'OCEAN',
        is_active: true,
        description: 'Cozy studio with ocean views',
        amenities: JSON.stringify(['Ocean View', 'Kitchenette', 'Balcony', 'WiFi']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 1,
        category: '1BR Premium',
        slug: '1br-premium-marbella',
        capacity_min: 2,
        capacity_max: 4,
        quantity: 12,
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 60,
        base_credit_value: 1500.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'OCEAN',
        is_active: true,
        description: 'One bedroom apartment with premium amenities',
        amenities: JSON.stringify(['Ocean View', 'Full Kitchen', 'Balcony', 'WiFi', 'Living Room']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 1,
        category: '2BR Deluxe',
        slug: '2br-deluxe-marbella',
        capacity_min: 4,
        capacity_max: 6,
        quantity: 6,
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 90,
        base_credit_value: 2000.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'OCEAN',
        is_active: true,
        description: 'Spacious two bedroom deluxe suite',
        amenities: JSON.stringify(['Ocean View', 'Full Kitchen', 'Balcony', 'WiFi', 'Living Room', 'Dining Area']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert units for Barcelona property (PREMIUM - mid-high tier)
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 2,
        category: 'Studio City View',
        slug: 'studio-city-barcelona',
        capacity_min: 2,
        capacity_max: 2,
        quantity: 10,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 40,
        base_credit_value: 900.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'CITY',
        is_active: true,
        description: 'Modern studio with city views',
        amenities: JSON.stringify(['City View', 'Kitchenette', 'Balcony', 'WiFi']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 2,
        category: '1BR Mountain View',
        slug: '1br-mountain-barcelona',
        capacity_min: 2,
        capacity_max: 4,
        quantity: 15,
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 65,
        base_credit_value: 1300.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'MOUNTAIN',
        is_active: true,
        description: 'One bedroom with mountain views',
        amenities: JSON.stringify(['Mountain View', 'Full Kitchen', 'Balcony', 'WiFi', 'Living Room']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 2,
        category: '2BR Penthouse',
        slug: '2br-penthouse-barcelona',
        capacity_min: 4,
        capacity_max: 6,
        quantity: 4,
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 110,
        base_credit_value: 1800.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'MOUNTAIN',
        is_active: true,
        description: 'Luxury penthouse with panoramic views',
        amenities: JSON.stringify(['Panoramic View', 'Full Kitchen', 'Terrace', 'WiFi', 'Living Room', 'Dining Area', 'Premium Finishes']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert units for Alicante property (STANDARD - base tier)
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 3,
        category: 'Studio Standard',
        slug: 'studio-standard-alicante',
        capacity_min: 2,
        capacity_max: 3,
        quantity: 15,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 32,
        base_credit_value: 700.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'POOL',
        is_active: true,
        description: 'Comfortable studio near the beach',
        amenities: JSON.stringify(['Pool View', 'Kitchenette', 'WiFi']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 3,
        category: '1BR Family',
        slug: '1br-family-alicante',
        capacity_min: 2,
        capacity_max: 4,
        quantity: 20,
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 55,
        base_credit_value: 1000.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'OCEAN',
        is_active: true,
        description: 'Family-friendly one bedroom apartment',
        amenities: JSON.stringify(['Beach View', 'Full Kitchen', 'Balcony', 'WiFi', 'Living Room']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        property_id: 3,
        category: '2BR Beach Front',
        slug: '2br-beachfront-alicante',
        capacity_min: 4,
        capacity_max: 6,
        quantity: 10,
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 85,
        base_credit_value: 1400.00,
        seasonal_factors: seasonalFactors,
        currency: 'EUR',
        view_type: 'OCEAN',
        is_active: true,
        description: 'Beachfront apartment with direct access',
        amenities: JSON.stringify(['Beach Front', 'Full Kitchen', 'Terrace', 'WiFi', 'Living Room', 'Dining Area']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    console.log('✅ V2 Properties and units seeded:');
    console.log('   - 3 properties (Marbella, Barcelona, Alicante)');
    console.log('   - 9 units (3 per property)');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('timeshare_units', null, {});
    await queryInterface.bulkDelete('timeshare_properties', null, {});
  }
};
