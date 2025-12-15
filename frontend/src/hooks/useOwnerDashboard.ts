import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: dashboardApi.getOwnerDashboard
  });
}
