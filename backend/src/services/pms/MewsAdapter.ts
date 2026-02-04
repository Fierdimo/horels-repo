/**
 * Mews PMS Adapter
 * 
 * Integration with Mews Property Management System API.
 * 
 * API Documentation: https://mews-systems.gitbook.io/connector-api/
 * 
 * Key Concepts:
 * - ServiceId: Unique identifier for the bookable service (e.g., accommodation)
 * - ResourceCategoryId: Room type/category
 * - ReservationId: Mews booking identifier
 * - CustomerId: Guest profile in Mews
 * 
 * Environment:
 * - Sandbox: https://api.mews-demo.com
 * - Production: https://api.mews.com
 */

import axios, { AxiosInstance } from 'axios';
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
  PMSConnectionError,
  PMSBookingError,
  PMSCancellationError,
  PMSValidationError,
} from './PMSAdapter';

interface MewsCredentials extends PMSCredentials {
  provider: 'mews';
  clientToken: string;
  accessToken: string;
  serviceId: string; // Mews ServiceId for bookable service
  environment: 'sandbox' | 'production';
}

interface MewsCustomer {
  Id: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone?: string;
}

interface MewsReservation {
  Id: string;
  Number: string; // Confirmation code
  State: 'Confirmed' | 'Started' | 'Processed' | 'Canceled' | 'Optional';
  CustomerId: string;
  ServiceId: string;
  StartUtc: string;
  EndUtc: string;
  AssignedResourceId?: string;
  AssignedResourceCategoryId: string;
}

export class MewsAdapter implements PMSAdapter {
  private client: AxiosInstance;
  private credentials: MewsCredentials;
  private baseUrl: string;

  constructor(credentials: MewsCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.environment === 'production'
      ? 'https://api.mews.com'
      : 'https://api.mews-demo.com';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      if (config.data) {
        config.data.ClientToken = this.credentials.clientToken;
        config.data.AccessToken = this.credentials.accessToken;
      }
      return config;
    });
  }

  getProvider(): PMSProvider {
    return 'mews';
  }

  /**
   * Test connection by calling Mews API configuration endpoint
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post('/api/connector/v1/configuration/get', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
      });

      return response.status === 200 && response.data.Enterprise;
    } catch (error) {
      console.error('[MewsAdapter] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Create booking in Mews
   * 
   * Process:
   * 1. Create or find customer (guest)
   * 2. Get resource category (room type)
   * 3. Create reservation
   */
  async createBooking(request: PMSBookingRequest): Promise<PMSBookingResponse> {
    try {
      // Step 1: Create customer (guest profile)
      const customer = await this.createOrGetCustomer(request.guest);

      // Step 2: Get resource category ID for room type
      const resourceCategoryId = await this.getResourceCategoryId(request.roomCategory);

      // Step 3: Create reservation
      const reservation = await this.createReservation({
        customerId: customer.Id,
        serviceId: this.credentials.serviceId,
        resourceCategoryId,
        startUtc: request.checkIn.toISOString(),
        endUtc: request.checkOut.toISOString(),
        numberOfGuests: request.numberOfGuests,
        notes: request.specialRequests,
        internalReference: `${request.internalConfirmationCode}-${request.internalBookingId}`,
      });

      // Map Mews state to our status
      const status = this.mapMewsStateToStatus(reservation.State);

      return {
        success: true,
        pmsBookingId: reservation.Id,
        pmsConfirmationCode: reservation.Number,
        status,
        roomAssigned: reservation.AssignedResourceId,
        message: 'Booking created successfully in Mews',
        rawResponse: reservation,
      };

    } catch (error: any) {
      console.error('[MewsAdapter] Create booking failed:', error);
      throw new PMSBookingError(
        'mews',
        `Failed to create booking: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Cancel booking in Mews
   */
  async cancelBooking(request: PMSCancellationRequest): Promise<PMSCancellationResponse> {
    try {
      // Mews cancel reservation endpoint
      const response = await this.client.post('/api/connector/v1/reservations/cancel', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        ReservationIds: [request.pmsBookingId],
        Notes: request.reason || 'Cancelled by guest',
        ChargeCancellationFee: false,
      });

      if (!response.data || response.status !== 200) {
        throw new Error('Invalid response from Mews');
      }

      return {
        success: true,
        pmsBookingId: request.pmsBookingId,
        status: 'CANCELLED',
        message: 'Booking cancelled successfully in Mews',
      };

    } catch (error: any) {
      console.error('[MewsAdapter] Cancel booking failed:', error);
      throw new PMSCancellationError(
        'mews',
        `Failed to cancel booking: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Get booking status from Mews
   */
  async getBookingStatus(pmsBookingId: string): Promise<PMSBookingStatusResponse> {
    try {
      const response = await this.client.post('/api/connector/v1/reservations/getAll', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        ReservationIds: [pmsBookingId],
      });

      if (!response.data || !response.data.Reservations || response.data.Reservations.length === 0) {
        throw new Error('Reservation not found in Mews');
      }

      const reservation: MewsReservation = response.data.Reservations[0];
      const status = this.mapMewsStateToStatus(reservation.State);

      return {
        pmsBookingId: reservation.Id,
        status,
        roomAssigned: reservation.AssignedResourceId,
        lastModified: new Date(),
      };

    } catch (error: any) {
      console.error('[MewsAdapter] Get booking status failed:', error);
      throw new PMSBookingError(
        'mews',
        `Failed to get booking status: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Get availability from Mews
   * 
   * Used for hotel inventory sync
   */
  async getAvailability(request: PMSAvailabilityRequest): Promise<PMSRoomAvailability[]> {
    try {
      const response = await this.client.post('/api/connector/v1/services/getAvailability', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        ServiceId: this.credentials.serviceId,
        StartUtc: request.checkIn.toISOString(),
        EndUtc: request.checkOut.toISOString(),
      });

      if (!response.data || !response.data.ResourceCategories) {
        return [];
      }

      // Map Mews resource categories to our format
      const availability: PMSRoomAvailability[] = response.data.ResourceCategories.map((category: any) => ({
        roomCategory: category.Name,
        totalRooms: category.TotalCapacity || 0,
        availableRooms: category.AvailableCapacity || 0,
        rate: category.Prices?.[0]?.Amount || 0,
        currency: category.Prices?.[0]?.Currency || 'EUR',
      }));

      // Filter by category if specified
      if (request.roomCategory) {
        return availability.filter(a => 
          a.roomCategory.toLowerCase().includes(request.roomCategory!.toLowerCase())
        );
      }

      return availability;

    } catch (error: any) {
      console.error('[MewsAdapter] Get availability failed:', error);
      throw new PMSBookingError(
        'mews',
        `Failed to get availability: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Create or find existing customer in Mews
   */
  private async createOrGetCustomer(guest: any): Promise<MewsCustomer> {
    try {
      // Try to find existing customer by email
      const searchResponse = await this.client.post('/api/connector/v1/customers/search', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        Email: guest.email,
      });

      if (searchResponse.data?.Customers && searchResponse.data.Customers.length > 0) {
        return searchResponse.data.Customers[0];
      }

      // Customer not found, create new
      const createResponse = await this.client.post('/api/connector/v1/customers/add', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        Customers: [
          {
            FirstName: guest.firstName,
            LastName: guest.lastName,
            Email: guest.email,
            Phone: guest.phone,
          },
        ],
      });

      if (!createResponse.data?.Customers || createResponse.data.Customers.length === 0) {
        throw new Error('Failed to create customer in Mews');
      }

      return createResponse.data.Customers[0];

    } catch (error: any) {
      console.error('[MewsAdapter] Create/get customer failed:', error);
      throw new PMSValidationError(
        'mews',
        `Failed to create or find customer: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Get resource category ID by name
   */
  private async getResourceCategoryId(categoryName: string): Promise<string> {
    try {
      const response = await this.client.post('/api/connector/v1/resourceCategories/getAll', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        ServiceIds: [this.credentials.serviceId],
      });

      if (!response.data?.ResourceCategories) {
        throw new Error('No resource categories found');
      }

      const category = response.data.ResourceCategories.find((cat: any) =>
        cat.Name.toLowerCase() === categoryName.toLowerCase() ||
        cat.Name.toLowerCase().includes(categoryName.toLowerCase())
      );

      if (!category) {
        throw new Error(`Room category "${categoryName}" not found in Mews`);
      }

      return category.Id;

    } catch (error: any) {
      console.error('[MewsAdapter] Get resource category failed:', error);
      throw new PMSValidationError(
        'mews',
        `Failed to find room category: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Create reservation in Mews
   */
  private async createReservation(params: {
    customerId: string;
    serviceId: string;
    resourceCategoryId: string;
    startUtc: string;
    endUtc: string;
    numberOfGuests: number;
    notes?: string;
    internalReference: string;
  }): Promise<MewsReservation> {
    try {
      const response = await this.client.post('/api/connector/v1/reservations/add', {
        ClientToken: this.credentials.clientToken,
        AccessToken: this.credentials.accessToken,
        Reservations: [
          {
            CustomerId: params.customerId,
            ServiceId: params.serviceId,
            ResourceCategoryId: params.resourceCategoryId,
            StartUtc: params.startUtc,
            EndUtc: params.endUtc,
            AdultCount: params.numberOfGuests,
            State: 'Confirmed',
            Notes: params.notes,
            ExternalIdentifier: params.internalReference,
          },
        ],
      });

      if (!response.data?.Reservations || response.data.Reservations.length === 0) {
        throw new Error('Failed to create reservation in Mews');
      }

      return response.data.Reservations[0];

    } catch (error: any) {
      console.error('[MewsAdapter] Create reservation failed:', error);
      throw new PMSBookingError(
        'mews',
        `Failed to create reservation: ${error.message}`,
        error.response?.data || error
      );
    }
  }

  /**
   * Map Mews reservation state to our booking status
   */
  private mapMewsStateToStatus(state: string): PMSBookingStatus {
    const stateMap: Record<string, PMSBookingStatus> = {
      'Confirmed': 'CONFIRMED',
      'Optional': 'PENDING',
      'Started': 'CHECKED_IN',
      'Processed': 'CHECKED_OUT',
      'Canceled': 'CANCELLED',
    };

    return stateMap[state] || 'UNKNOWN';
  }
}
