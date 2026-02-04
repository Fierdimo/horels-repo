import apiClient from './client';

export interface Property {
  id: number;
  name: string;
  location?: string;
  city?: string;
  country?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_marketplace_enabled?: boolean;
  pms_provider?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PropertiesResponse {
  success: boolean;
  data: Property[];
  total?: number;
}

export const propertiesApi = {
  /**
   * Get all properties
   */
  getAll: async (): Promise<PropertiesResponse> => {
    const { data } = await apiClient.get('/properties');
    return data;
  },

  /**
   * Get property by ID
   */
  getById: async (id: number): Promise<{ success: boolean; data: Property }> => {
    const { data } = await apiClient.get(`/properties/${id}`);
    return data;
  },

  /**
   * Get properties for current user (staff sees only their property)
   */
  getMine: async (): Promise<PropertiesResponse> => {
    const { data } = await apiClient.get('/properties/mine');
    return data;
  },
};
