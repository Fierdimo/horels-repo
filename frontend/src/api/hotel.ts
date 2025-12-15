import apiClient from './client';
import type { HotelService } from '@/types/models';
import type { RequestServiceRequest } from '@/types/api';

export const hotelApi = {
  // Guest access via token
  getBookingByToken: async (token: string): Promise<any> => {
    const { data } = await apiClient.get(`/hotel/booking/${token}`);
    return data;
  },

  // Service requests
  requestService: async (request: RequestServiceRequest): Promise<any> => {
    const { data } = await apiClient.post('/hotel/services', request);
    return data;
  },

  getServicesByToken: async (token: string): Promise<HotelService[]> => {
    const { data } = await apiClient.get<{ services: HotelService[] }>(`/hotel/services/${token}`);
    return data.services || [];
  },

  // Secret World integration
  getNearbyContent: async (token: string, radius: number = 5): Promise<any> => {
    const { data } = await apiClient.get(`/hotel/nearby/${token}`, {
      params: { radius }
    });
    return data;
  }
};
