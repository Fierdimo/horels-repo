import { apiClient } from '@/lib/apiClient';
import { ApiResponse } from '@/types/api';

export interface StaffRequest {
  id: number;
  email: string;
  hotelName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  Role: {
    name: string;
  };
}

export interface StaffRequestsResponse {
  requests: StaffRequest[];
}

export const adminApi = {
  // Get pending staff requests
  getStaffRequests: (): Promise<ApiResponse<StaffRequestsResponse>> =>
    apiClient.get('/admin/staff-requests'),

  // Approve a staff request
  approveStaffRequest: (userId: number): Promise<ApiResponse<{ message: string }>> =>
    apiClient.post(`/admin/staff-requests/${userId}/approve`, {}),

  // Reject a staff request (if needed)
  rejectStaffRequest: (userId: number): Promise<ApiResponse<{ message: string }>> =>
    apiClient.post(`/admin/staff-requests/${userId}/reject`, {}),
};