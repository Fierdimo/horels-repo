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
    const { data } = await apiClient.get<ApiResponse<Week[]>>('/timeshare/weeks');
    return data.data || [];
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
    const { data } = await apiClient.get<ApiResponse<SwapRequest[]>>('/timeshare/swaps');
    return data.data || [];
  },

  createSwap: async (request: CreateSwapRequest): Promise<SwapRequest> => {
    const { data } = await apiClient.post<ApiResponse<SwapRequest>>('/timeshare/swaps', request);
    return data.data!;
  },

  acceptSwap: async (swapId: number, request: AcceptSwapRequest): Promise<any> => {
    const { data } = await apiClient.post(`/timeshare/swaps/${swapId}/authorize`, request);
    return data;
  },

  // Night Credits
  getCredits: async (): Promise<NightCredit[]> => {
    const { data } = await apiClient.get<ApiResponse<NightCredit[]>>('/timeshare/night-credits');
    return data.data || [];
  },

  useCredits: async (creditId: number, request: UseCreditsRequest): Promise<any> => {
    const { data } = await apiClient.post(`/timeshare/night-credits/${creditId}/use`, request);
    return data;
  }
};
