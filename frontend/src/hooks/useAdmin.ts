import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, StaffRequestsResponse } from '@/api/admin';
import toast from 'react-hot-toast';

export const useStaffRequests = () => {
  return useQuery({
    queryKey: ['staffRequests'],
    queryFn: async () => {
      const response = await adminApi.getStaffRequests();
      return response.data;
    },
  });
};

export const useApproveStaffRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => adminApi.approveStaffRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffRequests'] });
      toast.success('Staff request approved successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to approve staff request');
    },
  });
};

export const useRejectStaffRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => adminApi.rejectStaffRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffRequests'] });
      toast.success('Staff request rejected');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to reject staff request');
    },
  });
};