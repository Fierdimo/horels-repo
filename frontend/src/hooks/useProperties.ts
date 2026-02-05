import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface PropertyOption {
  id: number;
  name: string;
  city: string;
  country: string;
  region?: string;
}

interface PropertiesResponse {
  success: boolean;
  data: PropertyOption[];
}

export const useProperties = () => {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await apiClient.get<PropertiesResponse>('/public/properties/list/all');
      return { properties: response.data.data };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: true,
  });
};