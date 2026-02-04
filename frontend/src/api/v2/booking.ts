import api from '../client';

// ==================== Types ====================

export type BookingSource = 'TIMESHARE' | 'HOTEL_PMS';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface CreateBookingRequest {
  source: BookingSource;
  
  // Timeshare booking
  weekAllocationId?: number;
  
  // Hotel booking
  propertyId?: number;
  roomCategory?: string;
  
  // Guest information
  guestId: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  
  // Stay details
  checkIn: string; // ISO 8601 format
  checkOut: string; // ISO 8601 format
  nights: number;
  guests: number;
  
  // Payment
  creditsToUse: number;
  cashAmount?: number; // For mixed payments (hotels)
  
  // Additional
  specialRequests?: string;
}

export interface Booking {
  id: number;
  confirmationCode: string;
  source: BookingSource;
  status: BookingStatus;
  
  // Property info
  property: {
    id: number;
    name: string;
    location: string;
    imageUrl?: string;
  };
  
  // Unit info
  roomCategory?: string;
  unit?: {
    name: string;
    type: string;
    capacity: number;
  };
  
  // Week info (timeshare only)
  weekInfo?: {
    weekAllocationId: number;
    weekNumber: number;
    year: number;
  };
  
  // Guest info
  guest: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  
  // Stay details
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  
  // Payment breakdown
  payment: {
    creditsUsed: number;
    cashPaid: number;
    total: number;
  };
  
  // Platform economics
  economics: {
    platformCost: number;
    platformRevenue: number;
    platformMargin: number;
  };
  
  specialRequests?: string;
  cancellationReason?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

export interface BookingListResponse {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BookingFilters {
  status?: BookingStatus;
  source?: BookingSource;
  upcoming?: boolean; // Only future bookings
  page?: number;
  limit?: number;
}

export interface CreateBookingResponse {
  success: boolean;
  data: Booking;
  message: string;
}

export interface CancelBookingResponse {
  success: boolean;
  data: Booking;
  message: string;
}

// ==================== API Calls ====================

/**
 * Create a new booking (timeshare or hotel)
 */
export const createBooking = async (request: CreateBookingRequest): Promise<CreateBookingResponse> => {
  const response = await api.post('/api/v2/bookings', request);
  return response.data;
};

/**
 * Get booking details by ID
 */
export const getBooking = async (id: number): Promise<Booking> => {
  const response = await api.get(`/api/v2/bookings/${id}`);
  return response.data.data;
};

/**
 * Cancel a booking and refund credits
 */
export const cancelBooking = async (
  id: number,
  reason?: string
): Promise<CancelBookingResponse> => {
  const response = await api.delete(`/api/v2/bookings/${id}`, {
    data: { reason }
  });
  return response.data;
};

/**
 * Get user's bookings with optional filters
 */
export const getUserBookings = async (
  filters?: BookingFilters
): Promise<BookingListResponse> => {
  const params = new URLSearchParams();
  
  if (filters?.status) params.append('status', filters.status);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.upcoming !== undefined) params.append('upcoming', String(filters.upcoming));
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));
  
  const response = await api.get(`/api/v2/bookings?${params.toString()}`);
  return response.data.data;
};

// ==================== Helper Functions ====================

/**
 * Format booking status for display
 */
export const formatBookingStatus = (status: BookingStatus): string => {
  const statusMap: Record<BookingStatus, string> = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    COMPLETED: 'Completada',
    NO_SHOW: 'No presentado'
  };
  return statusMap[status] || status;
};

/**
 * Get status badge color for UI
 */
export const getStatusColor = (status: BookingStatus): string => {
  const colorMap: Record<BookingStatus, string> = {
    PENDING: 'yellow',
    CONFIRMED: 'green',
    CANCELLED: 'red',
    COMPLETED: 'blue',
    NO_SHOW: 'gray'
  };
  return colorMap[status] || 'gray';
};

/**
 * Check if booking can be cancelled
 */
export const canCancelBooking = (booking: Booking): boolean => {
  // Can cancel if confirmed and check-in is in the future
  if (booking.status !== 'CONFIRMED') return false;
  
  const checkInDate = new Date(booking.checkIn);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return checkInDate > today;
};

/**
 * Calculate days until check-in
 */
export const daysUntilCheckIn = (booking: Booking): number => {
  const checkInDate = new Date(booking.checkIn);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkInDate.setHours(0, 0, 0, 0);
  
  const diffTime = checkInDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Format date range for display
 */
export const formatDateRange = (checkIn: string, checkOut: string): string => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  const options: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  };
  
  return `${checkInDate.toLocaleDateString('es-ES', options)} - ${checkOutDate.toLocaleDateString('es-ES', options)}`;
};
