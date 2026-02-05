import apiClient from './client';

export interface Booking {
  id: number;
  guest_id?: number;
  owner_id?: number;
  property_id?: number;
  check_in?: string;
  check_out?: string;
  check_in_date?: string; // Alias
  check_out_date?: string; // Alias
  checkIn?: string; // V2 format
  checkOut?: string; // V2 format
  room_type?: string;
  roomCategory?: string; // V2 format
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
  confirmationCode?: string; // V2 format
  source?: string; // V2 format
  nights?: number; // V2 format
  guests?: number; // V2 format
  creditsUsed?: number; // V2 format
  cancelledAt?: string; // V2 format
  Property?: {
    id: number;
    name: string;
    location?: string;
    city?: string;
    country?: string;
    address?: string;
  };
  property?: { // V2 format
    id: number;
    name: string;
    location?: string;
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
    const activeBooking = bookings.find((booking: any) => {
      const checkIn = new Date(booking.check_in || booking.checkIn);
      const checkOut = new Date(booking.check_out || booking.checkOut);
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
    const upcomingBookings = bookings.filter((booking: any) => {
      const checkIn = new Date(booking.check_in || booking.checkIn);
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

  // Cancel booking - uses new dedicated endpoint with refund support
  cancelBooking: async (bookingId: number, reason?: string): Promise<{ success: boolean; message: string; data: any }> => {
    const { data } = await apiClient.post(`/api/bookings/${bookingId}/cancel`, { reason });
    return data;
  },

  // Cancel booking V2 - uses V2 endpoint (DELETE)
  cancelBookingV2: async (bookingId: number, reason?: string): Promise<{ success: boolean; data: any }> => {
    const { data } = await apiClient.delete(`/api/v2/bookings/${bookingId}`, {
      data: { reason }
    });
    return data;
  },

  // Download invoice as PDF
  downloadInvoice: async (bookingId: number) => {
    const response = await apiClient.get(`/api/bookings/${bookingId}/invoice`, {
      responseType: 'blob',
    });
    
    // Create a blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${bookingId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
