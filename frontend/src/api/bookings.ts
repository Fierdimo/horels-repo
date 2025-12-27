import apiClient from './client';

export interface Booking {
  id: number;
  guest_id: number;
  owner_id?: number;
  property_id: number;
  check_in: string;
  check_out: string;
  check_in_date?: string; // Alias
  check_out_date?: string; // Alias
  room_type?: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  payment_method?: 'credits' | 'stripe' | 'hybrid';
  total_credits?: number;
  total_amount?: number;
  currency?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  special_requests?: string;
  guest_token?: string;
  Property?: {
    id: number;
    name: string;
    location?: string;
    city?: string;
    country?: string;
    address?: string;
  };
  Services?: ServiceRequest[];
}

export interface ServiceRequest {
  id: number;
  booking_id: number;
  service_type: string;
  description?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'in_progress';
  price?: number;
  quantity?: number;
  created_at?: string;
  requested_at?: string;
}

export const bookingsApi = {
  // Get all bookings for current user - uses existing dashboard endpoint
  getMyBookings: async (): Promise<{ success: boolean; bookings: Booking[] }> => {
    const { data } = await apiClient.get('/dashboard/bookings');
    return {
      success: data.success,
      bookings: data.bookings || []
    };
  },

  // Get active booking (currently staying) - filters from dashboard bookings
  getActiveBooking: async (): Promise<{ success: boolean; booking: Booking | null }> => {
    const { data } = await apiClient.get('/dashboard/bookings', {
      params: { status: 'confirmed' }
    });
    
    const bookings = data.bookings || [];
    const now = new Date();
    
    // Find booking where check_in <= today <= check_out
    const activeBooking = bookings.find((booking: Booking) => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      return now >= checkIn && now <= checkOut;
    });

    return {
      success: true,
      booking: activeBooking || null
    };
  },

  // Get upcoming bookings - filters from dashboard bookings
  getUpcomingBookings: async (): Promise<{ success: boolean; bookings: Booking[] }> => {
    const { data } = await apiClient.get('/dashboard/bookings');
    const bookings = data.bookings || [];
    const now = new Date();
    
    // Filter bookings where check_in > today
    const upcomingBookings = bookings.filter((booking: Booking) => {
      const checkIn = new Date(booking.check_in);
      return checkIn > now;
    });

    return {
      success: true,
      bookings: upcomingBookings
    };
  },

  // Get booking by ID - uses timeshare endpoint
  getBookingById: async (bookingId: number): Promise<{ success: boolean; booking: Booking }> => {
    const { data } = await apiClient.get(`/timeshare/bookings/${bookingId}`);
    return {
      success: data.success,
      booking: data.data
    };
  },

  // Request extra service - uses hotel guest endpoint
  requestService: async (bookingId: number, serviceData: {
    service_type: string;
    description?: string;
    notes?: string;
    quantity?: number;
  }): Promise<{ success: boolean; service: ServiceRequest }> => {
    // First get booking to retrieve guest_token
    const bookingResponse = await apiClient.get(`/timeshare/bookings/${bookingId}`);
    const guestToken = bookingResponse.data.data.guest_token;
    
    // Use hotel guest service endpoint
    const { data } = await apiClient.post('/hotel/services', {
      token: guestToken,
      service_type: serviceData.service_type,
      notes: serviceData.notes || serviceData.description,
      quantity: serviceData.quantity || 1
    });
    
    return {
      success: true,
      service: data.service
    };
  },

  // Get services for a booking - uses hotel guest endpoint
  getBookingServices: async (bookingId: number): Promise<{ success: boolean; services: ServiceRequest[] }> => {
    // First get booking to retrieve guest_token
    const bookingResponse = await apiClient.get(`/timeshare/bookings/${bookingId}`);
    const guestToken = bookingResponse.data.data.guest_token;
    
    const { data } = await apiClient.get(`/hotel/services/${guestToken}`);
    return {
      success: true,
      services: data.services || []
    };
  },

  // Cancel booking - uses PMS endpoint
  cancelBooking: async (bookingId: number, reason?: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.delete(`/pms/bookings/${bookingId}`, {
      data: { reason }
    });
    return {
      success: data.success
    };
  },
};
