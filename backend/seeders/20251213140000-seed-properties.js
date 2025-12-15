'use strict';
const crypto = require('crypto');

// Simple encryption function for seeder (matches pmsEncryption.ts logic)
function encryptPMSCredentials(credentials) {
  const key = process.env.PMS_ENCRYPTION_KEY;
  if (!key) {
    console.warn('⚠️  PMS_ENCRYPTION_KEY not set. Using unencrypted credentials for demo.');
    return JSON.stringify(credentials);
  }

  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get admin user - use first admin user found
    const adminId = 1; // Default to first user if not found

    // Sample properties
    const properties = [
      {
        name: 'Grand Hotel Madrid',
        location: 'Madrid, Spain',
        description: 'Luxury hotel in the heart of Madrid with stunning views and world-class amenities.',
        address: 'Calle Gran Via 123, Floor 5',
        city: 'Madrid',
        postal_code: '28013',
        country: 'Spain',
        latitude: 40.4168,
        longitude: -3.7038,
        contact_phone: '+34 91 123 4567',
        contact_email: 'info@grandhotelmadrid.com',
        website: 'https://grandhotelmadrid.com',
        stars: 5,
        amenities: JSON.stringify([
          'WiFi', 'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 
          'Room Service', 'Concierge', 'Parking', 'Airport Shuttle'
        ]),
        images: JSON.stringify([
          'https://example.com/images/hotel1-1.jpg',
          'https://example.com/images/hotel1-2.jpg',
          'https://example.com/images/hotel1-3.jpg'
        ]),
        check_in_time: '15:00:00',
        check_out_time: '12:00:00',
        timezone: 'Europe/Madrid',
        languages: JSON.stringify(['es', 'en', 'fr', 'de']),
        pms_provider: 'mews',
        pms_property_id: 'property-demo-madrid-001',
        pms_credentials: encryptPMSCredentials({
          clientToken: process.env.MEWS_CLIENT_TOKEN || 'demo-client-token',
          accessToken: process.env.MEWS_ACCESS_TOKEN || 'demo-access-token'
        }),
        pms_config: JSON.stringify({
          apiUrl: 'https://api.mews-demo.com',
          environment: 'demo'
        }),
        pms_sync_enabled: true,
        pms_last_sync: null,
        commission_percentage: 15.00,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Beach Resort Barcelona',
        location: 'Barcelona, Spain',
        description: 'Beautiful beachfront resort with Mediterranean cuisine and family-friendly activities.',
        address: 'Passeig Maritim 456',
        city: 'Barcelona',
        postal_code: '08003',
        country: 'Spain',
        latitude: 41.3851,
        longitude: 2.1734,
        contact_phone: '+34 93 789 1234',
        contact_email: 'reservations@beachresortbcn.com',
        website: 'https://beachresortbcn.com',
        stars: 4,
        amenities: JSON.stringify([
          'WiFi', 'Beach Access', 'Pool', 'Restaurant', 'Bar', 
          'Kids Club', 'Water Sports', 'Parking'
        ]),
        images: JSON.stringify([
          'https://example.com/images/hotel2-1.jpg',
          'https://example.com/images/hotel2-2.jpg'
        ]),
        check_in_time: '14:00:00',
        check_out_time: '11:00:00',
        timezone: 'Europe/Madrid',
        languages: JSON.stringify(['es', 'en', 'ca']),
        pms_provider: 'none',
        pms_property_id: null,
        pms_credentials: null,
        pms_config: null,
        pms_sync_enabled: false,
        pms_last_sync: null,
        commission_percentage: 12.50,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Mountain Lodge Pyrenees',
        location: 'Pyrenees, Spain',
        description: 'Cozy mountain retreat perfect for skiing and hiking enthusiasts.',
        address: 'Carretera de Montaña Km 15',
        city: 'Baqueira',
        postal_code: '25598',
        country: 'Spain',
        latitude: 42.7993,
        longitude: 0.9296,
        contact_phone: '+34 973 456 789',
        contact_email: 'contact@mountainlodge.com',
        website: 'https://mountainlodgepyrenees.com',
        stars: 3,
        amenities: JSON.stringify([
          'WiFi', 'Ski Storage', 'Restaurant', 'Bar', 'Fireplace', 
          'Parking', 'Ski Pass Sales'
        ]),
        images: JSON.stringify([
          'https://example.com/images/hotel3-1.jpg'
        ]),
        check_in_time: '16:00:00',
        check_out_time: '10:00:00',
        timezone: 'Europe/Madrid',
        languages: JSON.stringify(['es', 'en', 'ca']),
        pms_provider: 'none',
        pms_property_id: null,
        pms_credentials: null,
        pms_config: null,
        pms_sync_enabled: false,
        pms_last_sync: null,
        commission_percentage: 10.00,
        status: 'pending_verification',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('properties', properties);

    console.log('✅ Seeded 3 properties');
  },

  async down(queryInterface, Sequelize) {
    // Delete properties
    await queryInterface.bulkDelete('properties', {
      name: {
        [Sequelize.Op.in]: ['Grand Hotel Madrid', 'Beach Resort Barcelona', 'Mountain Lodge Pyrenees']
      }
    });
  }
};
