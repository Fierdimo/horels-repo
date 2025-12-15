import { IPMSAdapter } from './PMSFactory';

/**
 * Mock PMS Adapter for properties without PMS integration
 * Returns simulated data for testing and development
 */
export class MockPMSAdapter implements IPMSAdapter {
  private propertyId?: string;

  setPropertyId(propertyId: string): void {
    this.propertyId = propertyId;
  }

  getPropertyId(): string | undefined {
    return this.propertyId;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getAvailability(params: any): Promise<any> {
    return {
      rooms: [
        {
          id: 'mock-room-1',
          name: 'Standard Room',
          available: true,
          price: 100
        },
        {
          id: 'mock-room-2',
          name: 'Deluxe Room',
          available: true,
          price: 150
        }
      ]
    };
  }

  async getBookings(params: any): Promise<any> {
    return [];
  }

  async createBooking(params: any): Promise<any> {
    return {
      id: `mock-booking-${Date.now()}`,
      status: 'confirmed',
      ...params
    };
  }

  async updateBooking(bookingId: string, params: any): Promise<any> {
    return {
      id: bookingId,
      status: 'updated',
      ...params
    };
  }

  async cancelBooking(bookingId: string): Promise<any> {
    return {
      id: bookingId,
      status: 'cancelled'
    };
  }

  async getPropertyInfo(propertyId?: string): Promise<any> {
    // Simular diferentes hoteles según el propertyId o credenciales
    const mockHotels = {
      'hotel-test-001': {
        success: true,
        data: {
          propertyId: 'hotel-test-001',
          name: 'Hotel Emperador Madrid',
          address: 'Gran Vía 53',
          city: 'Madrid',
          country: 'Spain',
          timezone: 'Europe/Madrid',
          description: 'Luxury hotel in the heart of Madrid',
          images: [
            'https://images.unsplash.com/photo-1566073771259-6a8506099945',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'
          ],
          amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym']
        }
      },
      'hotel-test-002': {
        success: true,
        data: {
          propertyId: 'hotel-test-002',
          name: 'Barcelona Princess',
          address: 'Avinguda Diagonal 1',
          city: 'Barcelona',
          country: 'Spain',
          timezone: 'Europe/Madrid',
          description: 'Modern beachfront hotel',
          images: [
            'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
            'https://images.unsplash.com/photo-1571896349842-33c89424de2d'
          ],
          amenities: ['WiFi', 'Beach Access', 'Pool', 'Restaurant', 'Parking']
        }
      },
      'hotel-test-003': {
        success: true,
        data: {
          propertyId: 'hotel-test-003',
          name: 'Alfonso XIII Sevilla',
          address: 'Calle San Fernando 2',
          city: 'Sevilla',
          country: 'Spain',
          timezone: 'Europe/Madrid',
          description: 'Historic luxury hotel',
          images: [
            'https://images.unsplash.com/photo-1564501049412-61c2a3083791',
            'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'
          ],
          amenities: ['WiFi', 'Pool', 'Garden', 'Restaurant', 'Valet Parking']
        }
      },
      'hotel-test-004': {
        success: true,
        data: {
          propertyId: 'hotel-test-004',
          name: 'Maria Cristina San Sebastian',
          address: 'Paseo República Argentina 4',
          city: 'San Sebastián',
          country: 'Spain',
          timezone: 'Europe/Madrid',
          description: 'Belle Époque hotel',
          images: [
            'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4',
            'https://images.unsplash.com/photo-1517840901100-8179e982acb7'
          ],
          amenities: ['WiFi', 'Spa', 'Restaurant', 'Bar', 'Concierge']
        }
      }
    };

    const requestedId = propertyId || this.propertyId;
    
    // Si se solicita un ID específico, devolverlo
    if (requestedId && mockHotels[requestedId as keyof typeof mockHotels]) {
      return mockHotels[requestedId as keyof typeof mockHotels];
    }

    // Por defecto, devolver el primero
    return mockHotels['hotel-test-001'];
  }
}

export default MockPMSAdapter;
