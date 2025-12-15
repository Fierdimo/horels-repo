import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface PropertyOption {
  name: string;
  location: string;
}

interface PropertiesResponse {
  properties: PropertyOption[];
}

export const useProperties = () => {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await apiClient.get<PropertiesResponse>('/api/properties/names');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};