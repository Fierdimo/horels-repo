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
  // WEEKS
  // ============================================================================
  
  getWeeks: async (): Promise<Week[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<Week[]>>('/timeshare/weeks');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch weeks:', error);
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
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/owner/swaps/browse/available');
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
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>(url);
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
  // NIGHT CREDITS
  // ============================================================================
  
  getCredits: async (): Promise<NightCredit[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<NightCredit[]>>('/timeshare/night-credits');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      return [];
    }
  },

  useCredits: async (creditId: number, request: UseCreditsRequest): Promise<any> => {
    const { data } = await apiClient.post(`/timeshare/night-credits/${creditId}/use`, request);
    return data;
  }
};
