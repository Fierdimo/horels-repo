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
        tier: 'GOLD',
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
        tier: 'DIAMOND',
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
        tier: 'STANDARD',
        description: 'Family-friendly resort on the beautiful Costa Blanca',
        amenities: JSON.stringify(['Pool', 'Kids Club', 'Restaurant', 'Beach Access', 'Tennis']),
        images: JSON.stringify(['https://example.com/resort3.jpg']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert units for Marbella property
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 1,
        category: 'Studio Ocean View',
        slug: 'studio-ocean-marbella',
        capacity_min: 2,
        capacity_max: 2,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 35,
        base_credit_value: 600,
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
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 60,
        base_credit_value: 900,
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
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 90,
        base_credit_value: 1200,
        is_active: true,
        description: 'Spacious two bedroom deluxe suite',
        amenities: JSON.stringify(['Ocean View', 'Full Kitchen', 'Balcony', 'WiFi', 'Living Room', 'Dining Area']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert units for Barcelona property
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 2,
        category: 'Studio City View',
        slug: 'studio-city-barcelona',
        capacity_min: 2,
        capacity_max: 2,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 40,
        base_credit_value: 700,
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
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 65,
        base_credit_value: 1000,
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
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 110,
        base_credit_value: 1500,
        is_active: true,
        description: 'Luxury penthouse with panoramic views',
        amenities: JSON.stringify(['Panoramic View', 'Full Kitchen', 'Terrace', 'WiFi', 'Living Room', 'Dining Area', 'Premium Finishes']),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert units for Alicante property
    await queryInterface.bulkInsert('timeshare_units', [
      {
        property_id: 3,
        category: 'Studio Standard',
        slug: 'studio-standard-alicante',
        capacity_min: 2,
        capacity_max: 3,
        bedrooms: 0,
        bathrooms: 1,
        size_sqm: 32,
        base_credit_value: 500,
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
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 55,
        base_credit_value: 750,
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
        bedrooms: 2,
        bathrooms: 2,
        size_sqm: 85,
        base_credit_value: 1100,
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
