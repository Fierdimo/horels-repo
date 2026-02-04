import axios from 'axios';
import apiClient from './client';
import type { 
  Week, 
  SwapRequest, 
  NightCredit,
  ApiResponse 
} from '@/types/models';
import type { 
  ConfirmWeekRequest, 
  CreateSwapRequest,
  AcceptSwapRequest,
  UseCreditsRequest 
} from '@/types/api';

export const timeshareApi = {
  // ============================================================================
  // BOOKINGS
  // ============================================================================
  
  getMyBookings: async (): Promise<any[]> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get(`${baseURL}/api/v2/bookings`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      console.log('📦 Bookings API response:', data);
      // El endpoint devuelve { success: true, data: { bookings: [...], meta: {...} } }
      return Array.isArray(data.data?.bookings) ? data.data.bookings : [];
    } catch (error) {
      console.error('Failed to fetch my bookings:', error);
      return [];
    }
  },

  // ============================================================================
  // WEEKS
  // ============================================================================
  
  getWeeks: async (filter?: 'all' | 'available'): Promise<Week[]> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const currentYear = new Date().getFullYear();
      const { data } = await axios.get<ApiResponse<any[]>>(`${baseURL}/api/owner/weeks?year=${currentYear}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      
      let weeks = Array.isArray(data.data) ? data.data : [];
      
      // Apply filter if provided
      if (filter === 'available') {
        weeks = weeks.filter((w: any) => w.status === 'ASSIGNED');
      }
      
      return weeks;
    } catch (error) {
      console.error('Failed to fetch weeks:', error);
      return [];
    }
  },

  // V2: Get owner weeks with full ownership details
  getOwnerWeeks: async (year?: number): Promise<any[]> => {
    try {
      const currentYear = year || new Date().getFullYear();
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get<ApiResponse<any[]>>(`${baseURL}/api/owner/weeks?year=${currentYear}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch owner weeks:', error);
      return [];
    }
  },

  // V2: Get owner ownerships
  getOwnerOwnerships: async (): Promise<any[]> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get<ApiResponse<any[]>>(`${baseURL}/api/owner/ownerships`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch owner ownerships:', error);
      return [];
    }
  },

  confirmWeek: async (weekId: number, request: ConfirmWeekRequest): Promise<any> => {
    const { data } = await apiClient.post(`/timeshare/weeks/${weekId}/confirm`, request);
    return data;
  },

  convertWeek: async (weekId: number): Promise<NightCredit> => {
    const { data } = await apiClient.post<ApiResponse<NightCredit>>(`/timeshare/weeks/${weekId}/convert`);
    return data.data!;
  },

  // Confirm pending booking from invitation
  confirmInvitationBooking: async (bookingId: number): Promise<any> => {
    const { data } = await apiClient.post(`/staff/invitations/confirm-booking/${bookingId}`);
    return data;
  },

  // Convert pending booking to credits
  convertInvitationBookingToCredits: async (bookingId: number): Promise<any> => {
    const { data } = await apiClient.post(`/staff/invitations/convert-booking-to-credits/${bookingId}`);
    return data;
  },

  // ============================================================================
  // SWAPS - Owner Endpoints
  // ============================================================================
  
  /**
   * Search for compatible weeks available for swap
   * GET /owner/swaps/compatible-weeks/:weekId
   */
  searchCompatibleWeeks: async (weekId: number, propertyId?: number, limit: number = 50): Promise<any> => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId.toString());
      params.append('limit', limit.toString());
      
      const { data } = await apiClient.get<ApiResponse<any>>(
        `/owner/swaps/compatible-weeks/${weekId}?${params.toString()}`
      );
      return data.data;
    } catch (error) {
      console.error('Failed to search compatible weeks:', error);
      throw error;
    }
  },

  /**
   * Create a new swap request
   * POST /owner/swaps
   */
  createSwap: async (request: CreateSwapRequest): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>('/owner/swaps', request);
      return data.data!;
    } catch (error) {
      console.error('Failed to create swap:', error);
      throw error;
    }
  },

  /**
   * Get available swaps to browse and accept
   * GET /owner/swaps/browse/available
   */
  getAvailableSwaps: async (): Promise<SwapRequest[]> => {
    try {
      console.log('[timeshareApi.getAvailableSwaps] Calling /timeshare/swaps/browse/available');
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/timeshare/swaps/browse/available');
      console.log('[timeshareApi.getAvailableSwaps] Response:', data);
      console.log('[timeshareApi.getAvailableSwaps] Swaps count:', Array.isArray(data.data) ? data.data.length : 0);
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch available swaps:', error);
      return [];
    }
  },

  /**
   * Get pending swaps created by the user
   * GET /owner/swaps/pending
   */
  getPendingSwaps: async (): Promise<SwapRequest[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/owner/swaps/pending');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch pending swaps:', error);
      return [];
    }
  },

  /**
   * Get all swap requests for current owner
   * GET /owner/swaps
   */
  getSwaps: async (role?: 'requester' | 'responder' | 'both'): Promise<SwapRequest[]> => {
    try {
      const url = role ? `/owner/swaps?role=${role}` : '/owner/swaps';
      console.log('[timeshareApi.getSwaps] Calling URL:', url);
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>(url);
      console.log('[timeshareApi.getSwaps] Response:', data);
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch swaps:', error);
      return [];
    }
  },

  /**
   * Get swap request details
   * GET /owner/swaps/:swapId
   */
  getSwapDetails: async (swapId: number): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.get<ApiResponse<SwapRequest>>(`/owner/swaps/${swapId}`);
      return data.data!;
    } catch (error) {
      console.error('Failed to fetch swap details:', error);
      throw error;
    }
  },

  /**
   * Accept a swap request (as responder)
   * POST /owner/swaps/:swapId/accept
   */
  acceptSwap: async (swapId: number | string, responderWeekId?: number | string): Promise<SwapRequest> => {
    try {
      const body = responderWeekId ? { responderWeekId } : {};
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>(
        `/owner/swaps/${swapId}/accept`,
        body
      );
      return data.data!;
    } catch (error) {
      console.error('Failed to accept swap:', error);
      throw error;
    }
  },

  /**
   * Reject a swap request (as responder)
   * POST /owner/swaps/:swapId/reject
   */
  rejectSwap: async (swapId: number): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>(
        `/owner/swaps/${swapId}/reject`
      );
      return data.data!;
    } catch (error) {
      console.error('Failed to reject swap:', error);
      throw error;
    }
  },

  /**
   * Create a Stripe payment intent for swap fee
   * POST /owner/swaps/:swapId/payment-intent
   */
  createSwapPaymentIntent: async (swapId: number): Promise<any> => {
    try {
      const { data } = await apiClient.post<ApiResponse<any>>(
        `/owner/swaps/${swapId}/payment-intent`
      );
      return data.data;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw error;
    }
  },

  /**
   * Confirm payment and complete the swap
   * POST /owner/swaps/:swapId/confirm-payment
   */
  confirmSwapPayment: async (swapId: number, paymentIntentId: string): Promise<any> => {
    try {
      const { data } = await apiClient.post<ApiResponse<any>>(
        `/owner/swaps/${swapId}/confirm-payment`,
        { paymentIntentId }
      );
      return data.data;
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      throw error;
    }
  },

  // ============================================================================
  // SWAPS - Staff Endpoints
  // ============================================================================

  /**
   * Get pending swap requests for staff's property
   * GET /staff/swaps/pending
   */
  getStaffPendingSwaps: async (): Promise<SwapRequest[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/staff/swaps/pending');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch pending swaps:', error);
      return [];
    }
  },

  /**
   * Get all swap requests for staff's property
   * GET /staff/swaps
   */
  getStaffSwaps: async (status?: string): Promise<SwapRequest[]> => {
    try {
      const url = status ? `/staff/swaps?status=${status}` : '/staff/swaps';
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>(url);
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch staff swaps:', error);
      return [];
    }
  },

  /**
   * Get swap details (staff view)
   * GET /staff/swaps/:swapId
   */
  getStaffSwapDetails: async (swapId: number): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.get<ApiResponse<SwapRequest>>(`/staff/swaps/${swapId}`);
      return data.data!;
    } catch (error) {
      console.error('Failed to fetch staff swap details:', error);
      throw error;
    }
  },

  /**
   * Approve a swap request (staff action)
   * POST /staff/swaps/:swapId/approve
   */
  approveSwap: async (swapId: number, notes?: string): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>(
        `/staff/swaps/${swapId}/approve`,
        { notes }
      );
      return data.data!;
    } catch (error) {
      console.error('Failed to approve swap:', error);
      throw error;
    }
  },

  /**
   * Reject a swap request (staff action)
   * POST /staff/swaps/:swapId/reject
   */
  rejectStaffSwap: async (swapId: number, reason: string): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>(
        `/staff/swaps/${swapId}/reject`,
        { reason }
      );
      return data.data!;
    } catch (error) {
      console.error('Failed to reject swap:', error);
      throw error;
    }
  },

  // ============================================================================
  // CREDIT WALLET (New unified credit system)
  // ============================================================================
  
  getCreditWallet: async (): Promise<any> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get(`${baseURL}/api/v2/credits/balance`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      return data.data || { balance: 0, available_balance: 0 };
    } catch (error) {
      console.error('Failed to fetch credit wallet:', error);
      return { balance: 0, available_balance: 0 };
    }
  },

  getCreditTransactions: async (): Promise<any[]> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const { data } = await axios.get(`${baseURL}/api/v2/credits/transactions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      });
      console.log('📊 Credit transactions response:', data);
      
      // V2 endpoint returns array directly in data.data
      if (Array.isArray(data?.data)) {
        console.log('✅ Transactions found:', data.data.length);
        return data.data;
      }
      
      console.warn('⚠️ No transactions in response, data structure:', data);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch credit transactions:', error);
      return [];
    }
  },

  // ============================================================================
  // INVITATION BOOKINGS (Staff approval workflow)
  // ============================================================================

  getPendingApprovals: async (): Promise<any[]> => {
    try {
      const { data } = await apiClient.get('/staff/invitations/pending-approvals');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
      return [];
    }
  },

  approveBooking: async (bookingId: number): Promise<any> => {
    const { data } = await apiClient.post(`/staff/invitations/approve-booking/${bookingId}`);
    return data;
  },

  rejectBooking: async (bookingId: number, reason: string): Promise<any> => {
    const { data } = await apiClient.post(`/staff/invitations/reject-booking/${bookingId}`, { reason });
    return data;
  },

  // ============================================================================
  // MARKETPLACE - PAY WITH CREDITS
  // ============================================================================

  /**
   * Get credit to EUR conversion rate
   */
  getCreditToEurRate: async (): Promise<number> => {
    const { data } = await apiClient.get('/public/credit-to-eur-rate');
    return data.data.rate;
  },

  /**
   * Calculate credit cost for a booking (without creating it)
   * Returns the exact credits required based on Master Formula
   */
  calculateCreditCost: async (params: {
    propertyId: number;
    roomType: string;
    checkIn: string;
    checkOut: string;
  }): Promise<{
    creditsRequired: number;
    creditsPerNight: number;
    totalAmountEUR: number;
    pricePerNightEUR: number;
    nights: number;
    season: string;
    roomType: string;
    breakdown: any;
    wallet: {
      availableCredits: number;
      hasEnoughCredits: boolean;
      deficit: number;
    };
  }> => {
    const { propertyId, roomType, checkIn, checkOut } = params;
    const { data } = await apiClient.post(
      `/public/properties/${propertyId}/room-types/${encodeURIComponent(roomType)}/calculate-credit-cost`,
      { checkIn, checkOut }
    );
    return data.data;
  },

  bookRoomWithCredits: async (params: {
    propertyId: number;
    roomType: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }): Promise<any> => {
    const { data } = await apiClient.post(
      `/public/properties/${params.propertyId}/room-types/${encodeURIComponent(params.roomType)}/book-with-credits`,
      params
    );
    return data;
  },

  // ============================================================================
  // WEEK CONVERSION / RELEASE
  // ============================================================================

  previewWeekRelease: async (weekId: number): Promise<{
    estimatedCredits: number;
    expirationDate: string;
    breakdown: {
      baseSeason: number;
      tierMultiplier: number;
      roomMultiplier: number;
      locationMultiplier: number;
    };
    weekInfo: {
      year: number;
      weekNumber: number;
      startDate: string;
      endDate: string;
      propertyName: string;
      unitName: string;
    };
  }> => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const { data } = await axios.post(`${baseURL}/api/v2/weeks/${weekId}/preview-release`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
      }
    });
    return data.data;
  },

  releaseWeekToCredits: async (weekId: number): Promise<{
    creditsEarned: number;
    expiresAt: string;
    transactionId: number;
  }> => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const { data } = await axios.post(`${baseURL}/api/v2/weeks/release`, 
      { 
        allocationId: weekId,
        confirmDecay: true
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sw2_token')}`
        }
      }
    );
    return data.data;
  },
};
