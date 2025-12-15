import apiClient from './client';
import type { 
  NightCreditRequest,
  ApiResponse 
} from '@/types/models';
import type { 
  CreateNightCreditRequestDto,
  NightCreditRequestDetail,
  PaymentIntentResponse,
  StaffRequestDetail,
  AvailabilityCheck
} from '@/types/api';

/**
 * Owner Night Credit Request API
 */
export const ownerNightCreditApi = {
  /**
   * Create a night credit request
   */
  createRequest: async (request: CreateNightCreditRequestDto): Promise<NightCreditRequest> => {
    const { data } = await apiClient.post<ApiResponse<NightCreditRequest>>(
      '/owner/night-credits/requests',
      request
    );
    return data.data!;
  },

  /**
   * Get all my night credit requests
   */
  getMyRequests: async (): Promise<NightCreditRequest[]> => {
    const { data } = await apiClient.get<ApiResponse<NightCreditRequest[]>>(
      '/owner/night-credits/requests'
    );
    return data.data || [];
  },

  /**
   * Get single request detail
   */
  getRequestDetail: async (requestId: number): Promise<NightCreditRequestDetail> => {
    const { data } = await apiClient.get<ApiResponse<NightCreditRequestDetail>>(
      `/owner/night-credits/requests/${requestId}`
    );
    return data.data!;
  },

  /**
   * Create payment intent for additional nights
   */
  createPaymentIntent: async (requestId: number): Promise<PaymentIntentResponse> => {
    const { data } = await apiClient.post<ApiResponse<PaymentIntentResponse>>(
      `/owner/night-credits/requests/${requestId}/pay`
    );
    return data.data!;
  },

  /**
   * Cancel a pending request
   */
  cancelRequest: async (requestId: number): Promise<void> => {
    await apiClient.delete(`/owner/night-credits/requests/${requestId}`);
  }
};

/**
 * Staff Night Credit Request API
 */
export const staffNightCreditApi = {
  /**
   * Get all pending requests for my property
   */
  getPendingRequests: async (): Promise<NightCreditRequest[]> => {
    const { data } = await apiClient.get<ApiResponse<NightCreditRequest[]>>(
      '/staff/night-credits/requests'
    );
    return data.data || [];
  },

  /**
   * Get request detail with availability check
   */
  getRequestDetail: async (requestId: number): Promise<StaffRequestDetail> => {
    const { data } = await apiClient.get<ApiResponse<StaffRequestDetail>>(
      `/staff/night-credits/requests/${requestId}`
    );
    return data.data!;
  },

  /**
   * Approve a request
   */
  approveRequest: async (requestId: number, notes?: string): Promise<NightCreditRequest> => {
    const { data } = await apiClient.patch<ApiResponse<NightCreditRequest>>(
      `/staff/night-credits/requests/${requestId}/approve`,
      { notes }
    );
    return data.data!;
  },

  /**
   * Reject a request
   */
  rejectRequest: async (requestId: number, reason: string): Promise<NightCreditRequest> => {
    const { data } = await apiClient.patch<ApiResponse<NightCreditRequest>>(
      `/staff/night-credits/requests/${requestId}/reject`,
      { reason }
    );
    return data.data!;
  },

  /**
   * Check availability for dates and property
   */
  checkAvailability: async (propertyId: number, checkIn: string, checkOut: string): Promise<AvailabilityCheck> => {
    const { data } = await apiClient.get<ApiResponse<AvailabilityCheck>>(
      `/staff/night-credits/availability`,
      {
        params: { propertyId, checkIn, checkOut }
      }
    );
    return data.data!;
  }
};
