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
      const response = await apiClient.get<PropertiesResponse>('/properties/names');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on failure
    enabled: false, // Disable this query (v1 legacy endpoint)
  });
};