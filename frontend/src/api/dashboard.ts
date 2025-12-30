import apiClient from './client';
import type { DashboardResponse, OwnerDashboardResponse } from '@/types/api';

export const dashboardApi = {
  getOwnerDashboard: async (): Promise<OwnerDashboardResponse> => {
    const { data } = await apiClient.get<{ success: boolean; data: OwnerDashboardResponse }>('/timeshare/dashboard');
    return data.data;
  }
};
