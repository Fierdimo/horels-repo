import apiClient from './client';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '@/types/api';
import type { User } from '@/types/models';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  register: async (userData: RegisterRequest): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<RegisterResponse>('/auth/register', userData);
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<{ user: User }>('/auth/me');
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('sw2_token');
    localStorage.removeItem('sw2_user');
  },

  searchPropertiesInPlatform: async (query: string): Promise<{ 
    success: boolean; 
    data: Array<{ 
      id?: number;
      propertyId: string; 
      name: string; 
      location?: string;
      city?: string; 
      country?: string; 
      alreadyRegistered: boolean;
      source: 'platform' | 'pms';
    }> 
  }> => {
    const { data } = await apiClient.get(`/pms-search/search?q=${encodeURIComponent(query)}`);
    return data;
  },

  searchProperties: async (search: string = ''): Promise<{ 
    success: boolean; 
    data: { 
      propertyId: string; 
      name: string; 
      address?: string; 
      city?: string; 
      country?: string; 
      timezone?: string;
      alreadyRegistered?: boolean;
      existingPropertyId?: number;
    } 
  }> => {
    const { data } = await apiClient.post('/pms-search/properties', { search });
    return data;
  },

  updateProfile: async (profileData: { 
    firstName?: string; 
    lastName?: string; 
    phone?: string; 
    address?: string; 
  }): Promise<{ success: boolean; user: User }> => {
    const { data } = await apiClient.put('/auth/profile', profileData);
    return data;
  }
};
