import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import LoggingService from './loggingService';

interface AvailabilityData {
  roomId: string;
  roomType: string;
  available: boolean;
  date: string;
  price?: number;
  currency?: string;
}

interface BookingData {
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  totalAmount: number;
  currency: string;
  specialRequests?: string;
}

interface BookingResponse {
  bookingId: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface PropertyData {
  propertyId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  rooms: RoomData[];
  amenities?: string[];
}

interface RoomData {
  roomId: string;
  roomType: string;
  maxOccupancy: number;
  basePrice: number;
  currency: string;
}

class PMSService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor(client?: AxiosInstance) {
    this.baseURL = process.env.PMS_API_URL || 'https://api.cloudbeds.com/v1.1';
    this.apiKey = process.env.PMS_API_KEY || '';

    // Only throw error if no client is provided and no API key is configured
    // This allows the service to be instantiated for non-PMS routes
    if (!this.apiKey && !client) {
      console.warn('PMS_API_KEY not configured - PMS functionality will be limited');
    }

    // Use provided client or create new one
    this.client = client || axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });

    // Add response interceptor for error handling (only if not using test client)
    if (!client) {
      this.client.interceptors.response.use(
        (response: AxiosResponse) => response,
        async (error: any) => {
          if (error.response?.status === 429 && error.config) {
            // Rate limit exceeded, retry with exponential backoff
            const retryCount = error.config._retry || 0;
            if (retryCount < this.maxRetries) {
              error.config._retry = retryCount + 1;
              const delay = this.retryDelay * Math.pow(2, retryCount);
              await new Promise(resolve => setTimeout(resolve, delay));
              return this.client.request(error.config);
            }
          }
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Get room availability for a date range
   */
  async getAvailability(propertyId: string, startDate: string, endDate: string): Promise<AvailabilityData[]> {
    try {
      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        throw new Error('Invalid date range: start date must be before end date');
      }

      if (end.getTime() - start.getTime() > 30 * 24 * 60 * 60 * 1000) { // 30 days
        throw new Error('Date range cannot exceed 30 days');
      }

      const response: AxiosResponse = await this.client.get(`/properties/${propertyId}/availability`, {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });

      // Log the API call
      await LoggingService.logAction({
        action: 'pms_availability_check',
        details: { propertyId, startDate, endDate, resultCount: response.data.length }
      });

      return response.data.map((item: any) => ({
        roomId: item.room_id,
        roomType: item.room_type,
        available: item.available,
        date: item.date,
        price: item.price,
        currency: item.currency
      }));

    } catch (error: any) {
      console.error('PMS availability error:', error.message);

      // Log the error
      await LoggingService.logAction({
        action: 'pms_api_error',
        details: {
          operation: 'getAvailability',
          propertyId,
          startDate,
          endDate,
          error: error.message
        }
      });

      throw new Error(`PMS API error: ${error.message}`);
    }
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingData: BookingData): Promise<BookingResponse> {
    try {
      // Validate required fields
      const requiredFields = ['propertyId', 'roomId', 'guestName', 'guestEmail', 'checkIn', 'checkOut', 'adults', 'totalAmount', 'currency'];
      for (const field of requiredFields) {
        if (!bookingData[field as keyof BookingData]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate dates
      const checkIn = new Date(bookingData.checkIn);
      const checkOut = new Date(bookingData.checkOut);

      if (checkIn >= checkOut) {
        throw new Error('Check-out date must be after check-in date');
      }

      const payload = {
        property_id: bookingData.propertyId,
        room_id: bookingData.roomId,
        guest_name: bookingData.guestName,
        guest_email: bookingData.guestEmail,
        check_in: bookingData.checkIn,
        check_out: bookingData.checkOut,
        adults: bookingData.adults,
        children: bookingData.children || 0,
        total_amount: bookingData.totalAmount,
        currency: bookingData.currency,
        special_requests: bookingData.specialRequests
      };

      const response: AxiosResponse = await this.client.post('/bookings', payload);

      const booking = {
        bookingId: response.data.booking_id,
        status: response.data.status,
        propertyId: response.data.property_id,
        roomId: response.data.room_id,
        guestName: response.data.guest_name,
        guestEmail: response.data.guest_email,
        checkIn: response.data.check_in,
        checkOut: response.data.check_out,
        adults: response.data.adults,
        children: response.data.children,
        totalAmount: response.data.total_amount,
        currency: response.data.currency,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at
      };

      // Log the booking creation
      await LoggingService.logAction({
        action: 'pms_booking_created',
        details: {
          bookingId: booking.bookingId,
          propertyId: booking.propertyId,
          guestEmail: booking.guestEmail,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          totalAmount: booking.totalAmount
        }
      });

      return booking;

    } catch (error: any) {
      console.error('PMS booking creation error:', error.message);

      // Log the error
      await LoggingService.logAction({
        action: 'pms_booking_error',
        details: {
          operation: 'createBooking',
          bookingData,
          error: error.message
        }
      });

      throw new Error(`Failed to create booking: ${error.message}`);
    }
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId: string): Promise<BookingResponse> {
    try {
      const response: AxiosResponse = await this.client.get(`/bookings/${bookingId}`);

      return {
        bookingId: response.data.booking_id,
        status: response.data.status,
        propertyId: response.data.property_id,
        roomId: response.data.room_id,
        guestName: response.data.guest_name,
        guestEmail: response.data.guest_email,
        checkIn: response.data.check_in,
        checkOut: response.data.check_out,
        adults: response.data.adults,
        children: response.data.children,
        totalAmount: response.data.total_amount,
        currency: response.data.currency,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at
      };

    } catch (error: any) {
      console.error('PMS get booking error:', error.message);
      throw new Error(`Failed to get booking: ${error.message}`);
    }
  }

  /**
   * Update an existing booking
   */
  async updateBooking(bookingId: string, updateData: Partial<BookingData>): Promise<BookingResponse> {
    try {
      const response: AxiosResponse = await this.client.put(`/bookings/${bookingId}`, updateData);

      // Log the update
      await LoggingService.logAction({
        action: 'pms_booking_updated',
        details: { bookingId, updateData }
      });

      return {
        bookingId: response.data.booking_id,
        status: response.data.status,
        propertyId: response.data.property_id,
        roomId: response.data.room_id,
        guestName: response.data.guest_name,
        guestEmail: response.data.guest_email,
        checkIn: response.data.check_in,
        checkOut: response.data.check_out,
        adults: response.data.adults,
        children: response.data.children,
        totalAmount: response.data.total_amount,
        currency: response.data.currency,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at
      };

    } catch (error: any) {
      console.error('PMS update booking error:', error.message);
      throw new Error(`Failed to update booking: ${error.message}`);
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.client.delete(`/bookings/${bookingId}`);

      // Log the cancellation
      await LoggingService.logAction({
        action: 'pms_booking_cancelled',
        details: { bookingId }
      });

      return { success: true, message: 'Booking cancelled successfully' };

    } catch (error: any) {
      console.error('PMS cancel booking error:', error.message);
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }
  }

  /**
   * Get property information
   */
  async getProperty(propertyId: string): Promise<PropertyData> {
    try {
      const response: AxiosResponse = await this.client.get(`/properties/${propertyId}`);

      return {
        propertyId: response.data.property_id,
        name: response.data.name,
        address: response.data.address,
        city: response.data.city,
        country: response.data.country,
        rooms: response.data.rooms.map((room: any) => ({
          roomId: room.room_id,
          roomType: room.room_type,
          maxOccupancy: room.max_occupancy,
          basePrice: room.base_price,
          currency: room.currency
        })),
        amenities: response.data.amenities
      };

    } catch (error: any) {
      console.error('PMS get property error:', error.message);
      throw new Error(`Failed to get property: ${error.message}`);
    }
  }

  /**
   * Get properties for a user (owner)
   */
  async getUserProperties(userId: number): Promise<PropertyData[]> {
    try {
      const response: AxiosResponse = await this.client.get('/properties', {
        params: { owner_id: userId }
      });

      return response.data.map((property: any) => ({
        propertyId: property.property_id,
        name: property.name,
        address: property.address,
        city: property.city,
        country: property.country,
        rooms: property.rooms || [],
        amenities: property.amenities
      }));

    } catch (error: any) {
      console.error('PMS get user properties error:', error.message);
      throw new Error(`Failed to get user properties: ${error.message}`);
    }
  }
}

export default PMSService;