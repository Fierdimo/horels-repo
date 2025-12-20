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
  // Weeks
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

  // Swaps
  getSwaps: async (): Promise<SwapRequest[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/timeshare/swaps');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error('Failed to fetch swaps:', error);
      return [];
    }
  },

  createSwap: async (request: CreateSwapRequest): Promise<SwapRequest> => {
    try {
      const { data } = await apiClient.post<ApiResponse<SwapRequest>>('/timeshare/swaps', request);
      return data.data!;
    } catch (error) {
      console.error('Failed to create swap:', error);
      throw error;
    }
  },

  acceptSwap: async (swapId: number, request: AcceptSwapRequest): Promise<any> => {
    try {
      const { data } = await apiClient.post(`/timeshare/swaps/${swapId}/authorize`, request);
      return data;
    } catch (error) {
      console.error('Failed to accept swap:', error);
      throw error;
    }
  },

  // Night Credits
  getCredits: async (): Promise<NightCredit[]> => {
    try {
      const { data } = await apiClient.get<ApiResponse<NightCredit[]>>('/timeshare/night-credits');
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      // If 404 or other error, return empty array
      console.error('Failed to fetch credits:', error);
      return [];
    }
  },

  useCredits: async (creditId: number, request: UseCreditsRequest): Promise<any> => {
    const { data } = await apiClient.post(`/timeshare/night-credits/${creditId}/use`, request);
    return data;
  }
};
