/**
 * PMS Adapter Interface
 * 
 * Unified interface for all Property Management System integrations.
 * Implements Open/Closed Principle: closed for modification, open for extension.
 * 
 * Supported Providers:
 * - Mews (primary)
 * - Cloudbeds
 * - Opera
 * - Others (extensible)
 */

// ==================== Types ====================

export type PMSProvider = 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'none' | 'other';

export interface PMSCredentials {
  provider: PMSProvider;
  propertyId: string;
  apiKey?: string;
  clientToken?: string;
  accessToken?: string;
  environment?: 'sandbox' | 'production';
  [key: string]: any; // Provider-specific fields
}

export interface PMSGuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationality?: string;
  passportNumber?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface PMSBookingRequest {
  // Dates
  checkIn: Date;
  checkOut: Date;
  
  // Guest
  guest: PMSGuestDetails;
  numberOfGuests: number;
  
  // Room
  roomCategory: string;
  roomPreferences?: string[];
  
  // Requests
  specialRequests?: string;
  
  // Internal reference
  internalBookingId: number;
  internalConfirmationCode: string;
}

export interface PMSBookingResponse {
  success: boolean;
  pmsBookingId: string;
  pmsConfirmationCode?: string;
  status: PMSBookingStatus;
  roomAssigned?: string;
  checkInTime?: string;
  checkOutTime?: string;
  message?: string;
  rawResponse?: any; // Full PMS response for debugging
}

export type PMSBookingStatus = 
  | 'CONFIRMED' 
  | 'PENDING' 
  | 'CANCELLED' 
  | 'CHECKED_IN' 
  | 'CHECKED_OUT' 
  | 'NO_SHOW'
  | 'UNKNOWN';

export interface PMSCancellationRequest {
  pmsBookingId: string;
  reason?: string;
}

export interface PMSCancellationResponse {
  success: boolean;
  pmsBookingId: string;
  status: PMSBookingStatus;
  refundAmount?: number;
  cancellationFee?: number;
  message?: string;
}

export interface PMSBookingStatusResponse {
  pmsBookingId: string;
  status: PMSBookingStatus;
  roomAssigned?: string;
  lastModified?: Date;
  guestCheckedIn?: Date;
  guestCheckedOut?: Date;
}

export interface PMSAvailabilityRequest {
  checkIn: Date;
  checkOut: Date;
  roomCategory?: string;
}

export interface PMSRoomAvailability {
  roomCategory: string;
  totalRooms: number;
  availableRooms: number;
  rate: number;
  currency: string;
  // Optional additional details
  description?: string;
  capacity?: number;
  amenities?: string[];
  images?: string[];
}

export interface PMSError {
  code: string;
  message: string;
  details?: any;
  provider: PMSProvider;
}

// ==================== Interface ====================

/**
 * PMSAdapter Interface
 * 
 * All PMS integrations must implement this interface.
 * Use Liskov Substitution Principle: any adapter can be swapped without breaking code.
 */
export interface PMSAdapter {
  /**
   * Get provider name
   */
  getProvider(): PMSProvider;
  
  /**
   * Test connection to PMS
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Create a new booking in the PMS
   * 
   * @throws PMSError if booking fails
   */
  createBooking(request: PMSBookingRequest): Promise<PMSBookingResponse>;
  
  /**
   * Cancel an existing booking in the PMS
   * 
   * @throws PMSError if cancellation fails
   */
  cancelBooking(request: PMSCancellationRequest): Promise<PMSCancellationResponse>;
  
  /**
   * Get current status of a booking from PMS
   * 
   * @throws PMSError if status check fails
   */
  getBookingStatus(pmsBookingId: string): Promise<PMSBookingStatusResponse>;
  
  /**
   * Get room availability for date range
   * 
   * Used for hotel inventory sync (Phase 4 integration)
   * 
   * @throws PMSError if availability check fails
   */
  getAvailability(request: PMSAvailabilityRequest): Promise<PMSRoomAvailability[]>;
  
  /**
   * Update guest details for existing booking
   * 
   * Optional: Not all PMS support this
   */
  updateGuestDetails?(pmsBookingId: string, guest: PMSGuestDetails): Promise<boolean>;
}

// ==================== Errors ====================

export class PMSError extends Error {
  constructor(
    public code: string,
    message: string,
    public provider: PMSProvider,
    public details?: any
  ) {
    super(message);
    this.name = 'PMSError';
  }
}

export class PMSConnectionError extends PMSError {
  constructor(provider: PMSProvider, details?: any) {
    super('PMS_CONNECTION_ERROR', `Failed to connect to ${provider} PMS`, provider, details);
    this.name = 'PMSConnectionError';
  }
}

export class PMSBookingError extends PMSError {
  constructor(provider: PMSProvider, message: string, details?: any) {
    super('PMS_BOOKING_ERROR', message, provider, details);
    this.name = 'PMSBookingError';
  }
}

export class PMSCancellationError extends PMSError {
  constructor(provider: PMSProvider, message: string, details?: any) {
    super('PMS_CANCELLATION_ERROR', message, provider, details);
    this.name = 'PMSCancellationError';
  }
}

export class PMSValidationError extends PMSError {
  constructor(provider: PMSProvider, message: string, details?: any) {
    super('PMS_VALIDATION_ERROR', message, provider, details);
    this.name = 'PMSValidationError';
  }
}
