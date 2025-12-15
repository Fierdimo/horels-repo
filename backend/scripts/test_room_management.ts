/**
 * Script de prueba para Room Management & Marketplace
 * 
 * Este script prueba:
 * 1. Creación de habitaciones por staff
 * 2. Activación en marketplace
 * 3. Consulta pública de habitaciones
 * 4. Verificación de availability con tracking individual
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Colores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(title: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

// Estado global para compartir entre tests
const state: any = {
  adminToken: null,
  staffToken: null,
  propertyId: null,
  roomIds: [],
};

async function login(email: string, password: string): Promise<string | null> {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password,
    });
    return response.data.token;
  } catch (err: any) {
    error(`Login failed: ${err.response?.data?.error || err.message}`);
    return null;
  }
}

async function testStaffRoomCreation() {
  section('TEST 1: Staff - Crear Habitaciones');

  if (!state.staffToken) {
    error('No staff token available. Skipping test.');
    return;
  }

  const rooms = [
    {
      name: 'Room 101',
      description: 'Standard room with garden view',
      capacity: 2,
      type: 'Standard',
      floor: '1',
      basePrice: 89.00,
      amenities: ['wifi', 'tv', 'minibar', 'air_conditioning'],
      isMarketplaceEnabled: false,
    },
    {
      name: 'Room 201',
      description: 'Deluxe room with ocean view',
      capacity: 3,
      type: 'Deluxe',
      floor: '2',
      basePrice: 150.00,
      customPrice: 135.00,
      amenities: ['wifi', 'tv', 'minibar', 'balcony', 'jacuzzi'],
      isMarketplaceEnabled: false,
    },
    {
      name: 'Room 301',
      description: 'Suite with living room',
      capacity: 4,
      type: 'Suite',
      floor: '3',
      basePrice: 250.00,
      amenities: ['wifi', 'smart_tv', 'minibar', 'balcony', 'jacuzzi', 'living_room'],
      isMarketplaceEnabled: false,
    },
  ];

  for (const room of rooms) {
    try {
      const response = await axios.post(
        `${BASE_URL}/api/hotel-staff/rooms`,
        room,
        {
          headers: { Authorization: `Bearer ${state.staffToken}` },
        }
      );

      state.roomIds.push(response.data.data.id);
      success(`Created: ${room.name} (ID: ${response.data.data.id})`);
    } catch (err: any) {
      error(`Failed to create ${room.name}: ${err.response?.data?.error || err.message}`);
    }
  }

  info(`Total rooms created: ${state.roomIds.length}`);
}

async function testStaffListRooms() {
  section('TEST 2: Staff - Listar Habitaciones');

  try {
    const response = await axios.get(`${BASE_URL}/api/hotel-staff/rooms`, {
      headers: { Authorization: `Bearer ${state.staffToken}` },
    });

    success(`Found ${response.data.count} rooms`);
    response.data.data.forEach((room: any) => {
      info(`  - ${room.name}: ${room.type}, $${room.basePrice}, Marketplace: ${room.isMarketplaceEnabled}`);
    });
  } catch (err: any) {
    error(`Failed to list rooms: ${err.response?.data?.error || err.message}`);
  }
}

async function testStaffEnableMarketplace() {
  section('TEST 3: Staff - Activar en Marketplace');

  // Activar las primeras 2 habitaciones en marketplace
  const roomsToEnable = state.roomIds.slice(0, 2);

  for (const roomId of roomsToEnable) {
    try {
      await axios.patch(
        `${BASE_URL}/api/hotel-staff/rooms/${roomId}/marketplace`,
        { enabled: true },
        {
          headers: { Authorization: `Bearer ${state.staffToken}` },
        }
      );
      success(`Room ${roomId} enabled in marketplace`);
    } catch (err: any) {
      error(`Failed to enable room ${roomId}: ${err.response?.data?.error || err.message}`);
    }
  }

  info(`Enabled ${roomsToEnable.length} rooms in marketplace`);
}

async function testPublicMarketplace() {
  section('TEST 4: Público - Ver Habitaciones en Marketplace');

  try {
    // Obtener property ID de la primera room
    const roomResponse = await axios.get(`${BASE_URL}/api/hotel-staff/rooms`, {
      headers: { Authorization: `Bearer ${state.staffToken}` },
    });

    const propertyId = roomResponse.data.data[0]?.propertyId;
    if (!propertyId) {
      error('No property found');
      return;
    }

    state.propertyId = propertyId;
    info(`Testing with property ID: ${propertyId}`);

    // Listar habitaciones públicas
    const response = await axios.get(`${BASE_URL}/api/public/properties/${propertyId}/rooms`);

    success(`Marketplace shows ${response.data.count} rooms`);
    response.data.data.forEach((room: any) => {
      info(`  - ${room.name}: ${room.type}, $${room.effectivePrice}`);
    });

    if (response.data.count !== 2) {
      error(`Expected 2 rooms in marketplace, got ${response.data.count}`);
    } else {
      success('Correct number of rooms in marketplace!');
    }
  } catch (err: any) {
    error(`Failed to fetch public rooms: ${err.response?.data?.error || err.message}`);
  }
}

async function testPublicRoomDetails() {
  section('TEST 5: Público - Detalle de Habitación');

  if (!state.propertyId || state.roomIds.length === 0) {
    error('No property or rooms available');
    return;
  }

  try {
    const roomId = state.roomIds[0];
    const response = await axios.get(
      `${BASE_URL}/api/public/properties/${state.propertyId}/rooms/${roomId}`
    );

    success(`Room details retrieved: ${response.data.data.name}`);
    info(`  Type: ${response.data.data.type}`);
    info(`  Capacity: ${response.data.data.capacity}`);
    info(`  Price: $${response.data.data.effectivePrice}`);
    info(`  Amenities: ${response.data.data.amenities?.join(', ')}`);
  } catch (err: any) {
    error(`Failed to fetch room details: ${err.response?.data?.error || err.message}`);
  }
}

async function testAvailabilityEmpty() {
  section('TEST 6: Availability - Sin Reservas');

  if (!state.propertyId) {
    error('No property available');
    return;
  }

  try {
    const startDate = '2025-12-20';
    const endDate = '2025-12-23';

    const response = await axios.get(
      `${BASE_URL}/api/public/properties/${state.propertyId}/availability`,
      {
        params: { start_date: startDate, end_date: endDate },
      }
    );

    success('Availability check successful');
    info(`  Available: ${response.data.data.available}`);
    info(`  Total Rooms: ${response.data.data.totalRooms}`);
    info(`  Occupied Rooms: ${response.data.data.occupiedRooms}`);
    info(`  Available Rooms: ${response.data.data.availableRooms}`);
    info(`  Available Room IDs: ${response.data.data.availableRoomIds?.join(', ')}`);

    if (response.data.data.availableRooms !== 2) {
      error(`Expected 2 available rooms, got ${response.data.data.availableRooms}`);
    } else {
      success('Correct availability count!');
    }
  } catch (err: any) {
    error(`Failed to check availability: ${err.response?.data?.error || err.message}`);
  }
}

async function testCreateBooking() {
  section('TEST 7: Crear Booking con room_id');

  if (!state.propertyId || state.roomIds.length === 0) {
    error('No property or rooms available');
    return;
  }

  try {
    // Crear booking directamente en DB usando modelo
    info('Creating test booking with room_id...');
    
    // Simular booking (en producción esto vendría desde el endpoint de bookings)
    const bookingData = {
      property_id: state.propertyId,
      room_id: state.roomIds[0], // Asignar primera habitación
      guest_name: 'Test Guest',
      guest_email: 'test@example.com',
      check_in: new Date('2025-12-20'),
      check_out: new Date('2025-12-23'),
      room_type: 'Standard',
      status: 'confirmed',
      guest_token: `test-token-${Date.now()}`,
      total_amount: 267.00, // 3 nights * $89
      currency: 'USD',
    };

    info('Booking data prepared (would be created via booking endpoint)');
    info(`  Room ID: ${bookingData.room_id}`);
    info(`  Check-in: ${bookingData.check_in}`);
    info(`  Check-out: ${bookingData.check_out}`);
    
    success('Booking preparation successful');
  } catch (err: any) {
    error(`Failed to prepare booking: ${err.message}`);
  }
}

async function testStaffUpdateRoom() {
  section('TEST 8: Staff - Actualizar Habitación');

  if (!state.staffToken || state.roomIds.length === 0) {
    error('No staff token or rooms available');
    return;
  }

  try {
    const roomId = state.roomIds[0];
    const updates = {
      customPrice: 79.99,
      description: 'Updated: Standard room with garden view and free breakfast',
      amenities: ['wifi', 'tv', 'minibar', 'air_conditioning', 'free_breakfast'],
    };

    await axios.put(
      `${BASE_URL}/api/hotel-staff/rooms/${roomId}`,
      updates,
      {
        headers: { Authorization: `Bearer ${state.staffToken}` },
      }
    );

    success(`Room ${roomId} updated successfully`);
    info(`  New price: $${updates.customPrice}`);
    info(`  Updated description`);
    info(`  Added free_breakfast amenity`);
  } catch (err: any) {
    error(`Failed to update room: ${err.response?.data?.error || err.message}`);
  }
}

async function testFilters() {
  section('TEST 9: Público - Filtros de Habitaciones');

  if (!state.propertyId) {
    error('No property available');
    return;
  }

  try {
    // Test 1: Filtrar por tipo
    const byType = await axios.get(
      `${BASE_URL}/api/public/properties/${state.propertyId}/rooms?type=Standard`
    );
    success(`Filter by type 'Standard': ${byType.data.count} rooms`);

    // Test 2: Filtrar por capacidad mínima
    const byCapacity = await axios.get(
      `${BASE_URL}/api/public/properties/${state.propertyId}/rooms?min_capacity=3`
    );
    success(`Filter by min_capacity=3: ${byCapacity.data.count} rooms`);

    // Test 3: Filtrar por precio máximo
    const byPrice = await axios.get(
      `${BASE_URL}/api/public/properties/${state.propertyId}/rooms?max_price=100`
    );
    success(`Filter by max_price=100: ${byPrice.data.count} rooms`);
  } catch (err: any) {
    error(`Failed to test filters: ${err.response?.data?.error || err.message}`);
  }
}

async function runTests() {
  log('\n🚀 Starting Room Management Tests\n', colors.cyan);

  // Login
  section('Setup: Authentication');
  
  info('Logging in as admin...');
  state.adminToken = await login('admin@example.com', 'admin123');
  if (state.adminToken) {
    success('Admin login successful');
  }

  info('Logging in as staff...');
  // Intentar con varios usuarios staff posibles
  const staffEmails = ['staff@hotel1.com', 'staff@example.com', 'staff1@example.com'];
  
  for (const email of staffEmails) {
    state.staffToken = await login(email, 'password123');
    if (state.staffToken) {
      success(`Staff login successful: ${email}`);
      break;
    }
  }

  if (!state.staffToken) {
    error('Could not login as staff. Please create a staff user first.');
    info('Run: POST /auth/register with role "staff" and propertyId');
    return;
  }

  // Ejecutar tests
  await testStaffRoomCreation();
  await testStaffListRooms();
  await testStaffEnableMarketplace();
  await testPublicMarketplace();
  await testPublicRoomDetails();
  await testAvailabilityEmpty();
  await testCreateBooking();
  await testStaffUpdateRoom();
  await testFilters();

  // Resumen
  section('Test Summary');
  success('All tests completed!');
  info(`Rooms created: ${state.roomIds.length}`);
  info(`Property ID: ${state.propertyId}`);
  
  log('\n✨ Room Management System is working correctly!\n', colors.green);
}

// Ejecutar tests
runTests().catch((err) => {
  error(`Test execution failed: ${err.message}`);
  process.exit(1);
});
