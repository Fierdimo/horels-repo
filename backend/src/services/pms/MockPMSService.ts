/**
 * Mock PMS Service
 * 
 * Simulates a complete Property Management System with multiple properties,
 * rooms, and booking capabilities. Replaces MEWS for development and testing.
 * 
 * Features:
 * - Multiple properties with detailed information
 * - Various room types per property
 * - Real-time availability tracking
 * - Booking creation and cancellation
 * - Persistent in-memory storage
 */

import {
  PMSAdapter,
  PMSProvider,
  PMSCredentials,
  PMSBookingRequest,
  PMSBookingResponse,
  PMSCancellationRequest,
  PMSCancellationResponse,
  PMSBookingStatusResponse,
  PMSAvailabilityRequest,
  PMSRoomAvailability,
  PMSBookingStatus,
} from './PMSAdapter';

// ==================== Mock Data Structures ====================

interface MockProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  description: string;
  images: string[];
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  phone: string;
  email: string;
}

interface MockRoomType {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  capacity: number;
  basePrice: number;
  images: string[];
  amenities: string[];
  quantity: number; // Total number of rooms of this type
}

interface MockBooking {
  id: string;
  propertyId: string;
  roomTypeId: string;
  roomNumber?: string;
  confirmationCode: string;
  status: PMSBookingStatus;
  checkIn: Date;
  checkOut: Date;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  numberOfGuests: number;
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
  internalBookingId?: number;
}

// ==================== Mock Database ====================

class MockPMSDatabase {
  private static instance: MockPMSDatabase;
  
  properties: Map<string, MockProperty> = new Map();
  roomTypes: Map<string, MockRoomType> = new Map();
  bookings: Map<string, MockBooking> = new Map();

  private constructor() {
    this.initializeMockData();
  }

  static getInstance(): MockPMSDatabase {
    if (!MockPMSDatabase.instance) {
      MockPMSDatabase.instance = new MockPMSDatabase();
    }
    return MockPMSDatabase.instance;
  }

  private initializeMockData() {
    // Property 1: Hotel Emperador Madrid
    const hotel1Id = '1001';
    this.properties.set(hotel1Id, {
      id: hotel1Id,
      name: 'Hotel Emperador Madrid',
      address: 'Gran Vía 53',
      city: 'Madrid',
      country: 'Spain',
      timezone: 'Europe/Madrid',
      description: 'Luxury 5-star hotel in the heart of Madrid with rooftop pool and panoramic city views',
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b',
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39'
      ],
      amenities: ['WiFi', 'Rooftop Pool', 'Spa', 'Fine Dining Restaurant', 'Bar', 'Fitness Center', '24h Room Service', 'Concierge'],
      checkInTime: '15:00',
      checkOutTime: '12:00',
      phone: '+34 915 478 800',
      email: 'reservas@emperadormadrid.com'
    });

    // Room types for Hotel Emperador Madrid
    this.roomTypes.set('MOCK-ROOM-001-1', {
      id: 'MOCK-ROOM-001-1',
      propertyId: hotel1Id,
      name: 'Standard Double Room',
      description: 'Elegant 25m² room with city views, king bed, and modern amenities',
      capacity: 2,
      basePrice: 150,
      images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304'],
      amenities: ['King Bed', 'City View', 'WiFi', 'Air Conditioning', 'Safe', 'Mini Bar'],
      quantity: 20
    });

    this.roomTypes.set('MOCK-ROOM-001-2', {
      id: 'MOCK-ROOM-001-2',
      propertyId: hotel1Id,
      name: 'Deluxe Suite',
      description: 'Spacious 45m² suite with separate living area and Gran Vía views',
      capacity: 3,
      basePrice: 280,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
      amenities: ['King Bed', 'Living Area', 'Gran Vía View', 'WiFi', 'Nespresso Machine', 'Bathrobe'],
      quantity: 10
    });

    this.roomTypes.set('MOCK-ROOM-001-3', {
      id: 'MOCK-ROOM-001-3',
      propertyId: hotel1Id,
      name: 'Presidential Suite',
      description: 'Luxurious 80m² suite with panoramic terrace, premium amenities',
      capacity: 4,
      basePrice: 550,
      images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427'],
      amenities: ['King Bed', 'Private Terrace', 'Panoramic Views', 'Jacuzzi', 'Butler Service'],
      quantity: 3
    });

    // Property 2: Barcelona Princess
    const hotel2Id = '1002';
    this.properties.set(hotel2Id, {
      id: hotel2Id,
      name: 'Barcelona Princess',
      address: 'Avinguda Diagonal 1',
      city: 'Barcelona',
      country: 'Spain',
      timezone: 'Europe/Madrid',
      description: 'Modern beachfront hotel with Mediterranean charm and direct beach access',
      images: [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d'
      ],
      amenities: ['WiFi', 'Beach Access', 'Infinity Pool', 'Beach Club', 'Mediterranean Restaurant', 'Parking', 'Kids Club'],
      checkInTime: '14:00',
      checkOutTime: '11:00',
      phone: '+34 933 567 800',
      email: 'info@barcelonaprincess.com'
    });

    this.roomTypes.set('MOCK-ROOM-002-1', {
      id: 'MOCK-ROOM-002-1',
      propertyId: hotel2Id,
      name: 'Sea View Room',
      description: 'Bright 30m² room with private balcony and Mediterranean views',
      capacity: 2,
      basePrice: 180,
      images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d32'],
      amenities: ['Queen Bed', 'Sea View Balcony', 'WiFi', 'Air Conditioning', 'Rain Shower'],
      quantity: 25
    });

    this.roomTypes.set('MOCK-ROOM-002-2', {
      id: 'MOCK-ROOM-002-2',
      propertyId: hotel2Id,
      name: 'Family Suite',
      description: 'Spacious 55m² suite with two bedrooms, perfect for families',
      capacity: 4,
      basePrice: 320,
      images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a'],
      amenities: ['2 Bedrooms', 'Sea View', 'Kitchenette', 'Living Room', 'Kids Amenities'],
      quantity: 8
    });

    // Property 3: Alfonso XIII Sevilla
    const hotel3Id = '1003';
    this.properties.set(hotel3Id, {
      id: hotel3Id,
      name: 'Alfonso XIII Sevilla',
      address: 'Calle San Fernando 2',
      city: 'Sevilla',
      country: 'Spain',
      timezone: 'Europe/Madrid',
      description: 'Historic 5-star luxury hotel with Andalusian architecture and royal heritage',
      images: [
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791',
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'
      ],
      amenities: ['WiFi', 'Garden Pool', 'Courtyard Gardens', 'Fine Dining', 'Spa', 'Valet Parking', 'Piano Bar'],
      checkInTime: '15:00',
      checkOutTime: '12:00',
      phone: '+34 954 917 000',
      email: 'reservations@alfonsoxiii-seville.com'
    });

    this.roomTypes.set('MOCK-ROOM-003-1', {
      id: 'MOCK-ROOM-003-1',
      propertyId: hotel3Id,
      name: 'Classic Room',
      description: 'Elegant room with traditional Andalusian décor and courtyard views',
      capacity: 2,
      basePrice: 200,
      images: ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461'],
      amenities: ['King Bed', 'Courtyard View', 'Marble Bathroom', 'WiFi', 'Luxury Toiletries'],
      quantity: 15
    });

    this.roomTypes.set('MOCK-ROOM-003-2', {
      id: 'MOCK-ROOM-003-2',
      propertyId: hotel3Id,
      name: 'Royal Suite',
      description: 'Majestic 70m² suite with historic furniture and garden terrace',
      capacity: 3,
      basePrice: 480,
      images: ['https://images.unsplash.com/photo-1591088398332-8a7791972843'],
      amenities: ['King Bed', 'Garden Terrace', 'Separate Living Room', 'Butler Service', 'Champagne Welcome'],
      quantity: 5
    });

    // Property 4: Maria Cristina San Sebastian
    const hotel4Id = 'MOCK-PROP-004';
    this.properties.set(hotel4Id, {
      id: hotel4Id,
      name: 'Maria Cristina San Sebastian',
      address: 'Paseo República Argentina 4',
      city: 'San Sebastián',
      country: 'Spain',
      timezone: 'Europe/Madrid',
      description: 'Belle Époque luxury hotel overlooking the Urumea River and La Concha Bay',
      images: [
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4',
        'https://images.unsplash.com/photo-1517840901100-8179e982acb7'
      ],
      amenities: ['WiFi', 'Michelin Star Restaurant', 'Spa', 'River Views', 'Bar', 'Concierge', 'Valet Parking'],
      checkInTime: '15:00',
      checkOutTime: '12:00',
      phone: '+34 943 437 600',
      email: 'info@mariacristina.com'
    });

    this.roomTypes.set('MOCK-ROOM-004-1', {
      id: 'MOCK-ROOM-004-1',
      propertyId: hotel4Id,
      name: 'Superior River View',
      description: 'Refined 32m² room with Belle Époque elegance and river views',
      capacity: 2,
      basePrice: 220,
      images: ['https://images.unsplash.com/photo-1596436889106-be35e843f974'],
      amenities: ['King Bed', 'River View', 'Belle Époque Décor', 'WiFi', 'Rainfall Shower'],
      quantity: 18
    });

    this.roomTypes.set('MOCK-ROOM-004-2', {
      id: 'MOCK-ROOM-004-2',
      propertyId: hotel4Id,
      name: 'Presidential Suite',
      description: 'Spectacular 90m² suite with bay views and historic charm',
      capacity: 4,
      basePrice: 650,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
      amenities: ['King Bed', 'La Concha Bay View', 'Grand Piano', 'Butler Service', 'Private Dining'],
      quantity: 2
    });

    console.log('[MockPMSDatabase] Initialized with:');
    console.log(`  - ${this.properties.size} properties`);
    console.log(`  - ${this.roomTypes.size} room types`);
    console.log(`  - Total rooms: ${Array.from(this.roomTypes.values()).reduce((sum, rt) => sum + rt.quantity, 0)}`);
  }

  // Helper methods
  getRoomTypesForProperty(propertyId: string): MockRoomType[] {
    return Array.from(this.roomTypes.values())
      .filter(rt => rt.propertyId === propertyId);
  }

  getBookingsForRoom(roomTypeId: string, checkIn: Date, checkOut: Date): MockBooking[] {
    return Array.from(this.bookings.values()).filter(booking => {
      if (booking.roomTypeId !== roomTypeId) return false;
      if (booking.status === 'CANCELLED') return false;
      
      // Check for date overlap
      const bookingStart = booking.checkIn.getTime();
      const bookingEnd = booking.checkOut.getTime();
      const requestStart = checkIn.getTime();
      const requestEnd = checkOut.getTime();
      
      return (requestStart < bookingEnd) && (requestEnd > bookingStart);
    });
  }

  isRoomAvailable(roomTypeId: string, checkIn: Date, checkOut: Date): boolean {
    const roomType = this.roomTypes.get(roomTypeId);
    if (!roomType) return false;

    const overlappingBookings = this.getBookingsForRoom(roomTypeId, checkIn, checkOut);
    return overlappingBookings.length < roomType.quantity;
  }

  getAvailableRoomCount(roomTypeId: string, checkIn: Date, checkOut: Date): number {
    const roomType = this.roomTypes.get(roomTypeId);
    if (!roomType) return 0;

    const overlappingBookings = this.getBookingsForRoom(roomTypeId, checkIn, checkOut);
    return Math.max(0, roomType.quantity - overlappingBookings.length);
  }
}

// ==================== Mock PMS Adapter ====================

export class MockPMSAdapter implements PMSAdapter {
  private credentials: PMSCredentials;
  private db: MockPMSDatabase;

  constructor(credentials: PMSCredentials) {
    this.credentials = credentials;
    this.db = MockPMSDatabase.getInstance();
    console.log(`[MockPMSAdapter] Initialized for property: ${credentials.propertyId || 'ALL'}`);
  }

  getProvider(): PMSProvider {
    return 'other';
  }

  async testConnection(): Promise<boolean> {
    console.log('[MockPMSAdapter] Testing connection... ✓');
    return true;
  }

  async createBooking(request: PMSBookingRequest): Promise<PMSBookingResponse> {
    console.log('[MockPMSAdapter] Creating booking:', {
      property: this.credentials.propertyId,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      guest: request.guest.email
    });

    // Find available room type
    const roomTypes = this.db.getRoomTypesForProperty(this.credentials.propertyId);
    const availableRoomType = roomTypes.find(rt => 
      rt.name.toLowerCase().includes(request.roomCategory.toLowerCase()) &&
      this.db.isRoomAvailable(rt.id, request.checkIn, request.checkOut)
    );

    if (!availableRoomType) {
      return {
        success: false,
        pmsBookingId: '',
        status: 'CANCELLED',
        message: 'No rooms available for the requested dates and category'
      };
    }

    // Generate booking
    const bookingId = `MOCK-BKG-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const confirmationCode = `CONF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const booking: MockBooking = {
      id: bookingId,
      propertyId: this.credentials.propertyId,
      roomTypeId: availableRoomType.id,
      roomNumber: `${Math.floor(Math.random() * 400) + 100}`,
      confirmationCode,
      status: 'CONFIRMED',
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      guest: {
        firstName: request.guest.firstName,
        lastName: request.guest.lastName,
        email: request.guest.email,
        phone: request.guest.phone
      },
      numberOfGuests: request.numberOfGuests,
      specialRequests: request.specialRequests,
      createdAt: new Date(),
      updatedAt: new Date(),
      internalBookingId: request.internalBookingId
    };

    this.db.bookings.set(bookingId, booking);

    console.log('[MockPMSAdapter] ✓ Booking created:', bookingId);

    return {
      success: true,
      pmsBookingId: bookingId,
      pmsConfirmationCode: confirmationCode,
      status: 'CONFIRMED',
      roomAssigned: booking.roomNumber,
      checkInTime: this.db.properties.get(this.credentials.propertyId)?.checkInTime,
      checkOutTime: this.db.properties.get(this.credentials.propertyId)?.checkOutTime,
      message: `Booking confirmed at ${availableRoomType.name}`
    };
  }

  async cancelBooking(request: PMSCancellationRequest): Promise<PMSCancellationResponse> {
    console.log('[MockPMSAdapter] Cancelling booking:', request.pmsBookingId);

    const booking = this.db.bookings.get(request.pmsBookingId);
    
    if (!booking) {
      return {
        success: false,
        pmsBookingId: request.pmsBookingId,
        status: 'UNKNOWN',
        message: 'Booking not found'
      };
    }

    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();

    console.log('[MockPMSAdapter] ✓ Booking cancelled:', request.pmsBookingId);

    return {
      success: true,
      pmsBookingId: request.pmsBookingId,
      status: 'CANCELLED',
      message: 'Booking cancelled successfully'
    };
  }

  async getBookingStatus(pmsBookingId: string): Promise<PMSBookingStatusResponse> {
    console.log('[MockPMSAdapter] Getting booking status:', pmsBookingId);

    const booking = this.db.bookings.get(pmsBookingId);

    if (!booking) {
      return {
        pmsBookingId,
        status: 'UNKNOWN'
      };
    }

    return {
      pmsBookingId: booking.id,
      status: booking.status,
      roomAssigned: booking.roomNumber
    };
  }

  async getAvailability(request: PMSAvailabilityRequest): Promise<PMSRoomAvailability[]> {
    console.log('[MockPMSAdapter] Getting availability:', {
      property: this.credentials.propertyId,
      checkIn: request.checkIn,
      checkOut: request.checkOut
    });

    const roomTypes = this.db.getRoomTypesForProperty(this.credentials.propertyId);
    const availability: PMSRoomAvailability[] = [];

    for (const roomType of roomTypes) {
      const availableCount = this.db.getAvailableRoomCount(
        roomType.id,
        request.checkIn,
        request.checkOut
      );

      if (availableCount > 0) {
        availability.push({
          roomCategory: roomType.name,
          totalRooms: roomType.quantity,
          availableRooms: availableCount,
          rate: roomType.basePrice,
          currency: 'EUR',
          description: roomType.description,
          capacity: roomType.capacity,
          amenities: roomType.amenities,
          images: roomType.images
        });
      }
    }

    console.log(`[MockPMSAdapter] ✓ Found ${availability.length} available room types`);

    return availability;
  }
}

// ==================== Mock PMS Management API ====================

export class MockPMSManager {
  private db: MockPMSDatabase;

  constructor() {
    this.db = MockPMSDatabase.getInstance();
  }

  // Get all properties
  getAllProperties(): MockProperty[] {
    return Array.from(this.db.properties.values());
  }

  // Get property details
  getProperty(propertyId: string): MockProperty | undefined {
    return this.db.properties.get(propertyId);
  }

  // Get room types for property
  getRoomTypes(propertyId: string): MockRoomType[] {
    return this.db.getRoomTypesForProperty(propertyId);
  }

  // Get all bookings
  getAllBookings(): MockBooking[] {
    return Array.from(this.db.bookings.values());
  }

  // Get bookings for property
  getPropertyBookings(propertyId: string): MockBooking[] {
    return Array.from(this.db.bookings.values())
      .filter(b => b.propertyId === propertyId);
  }

  // Get booking by ID
  getBooking(bookingId: string): MockBooking | undefined {
    return this.db.bookings.get(bookingId);
  }

  // Clear all bookings (for testing)
  clearAllBookings(): void {
    this.db.bookings.clear();
    console.log('[MockPMSManager] All bookings cleared');
  }

  // Get statistics
  getStats() {
    const totalRooms = Array.from(this.db.roomTypes.values())
      .reduce((sum, rt) => sum + rt.quantity, 0);
    
    const activeBookings = Array.from(this.db.bookings.values())
      .filter(b => b.status !== 'CANCELLED').length;

    return {
      properties: this.db.properties.size,
      roomTypes: this.db.roomTypes.size,
      totalRooms,
      totalBookings: this.db.bookings.size,
      activeBookings,
      cancelledBookings: this.db.bookings.size - activeBookings
    };
  }
}

export default MockPMSAdapter;
