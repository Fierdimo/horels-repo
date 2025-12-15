import apiClient from './client';
import type { DashboardResponse } from '@/types/api';

export const dashboardApi = {
  getOwnerDashboard: async (): Promise<DashboardResponse> => {
    const { data } = await apiClient.get<{ data: DashboardResponse }>('/owner/dashboard');
    return data.data;
  }
};
