import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerNightCreditApi, staffNightCreditApi } from '@/api/nightCredits';
import { toast } from 'react-hot-toast';
import type { CreateNightCreditRequestDto } from '@/types/api';

/**
 * Hook for owner night credit operations
 */
export function useOwnerNightCredits() {
  const queryClient = useQueryClient();

  // Get all my requests
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['nightCreditRequests'],
    queryFn: ownerNightCreditApi.getMyRequests
  });

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: (data: CreateNightCreditRequestDto) => 
      ownerNightCreditApi.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nightCreditRequests'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Night credit request created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create request');
    }
  });

  // Create payment intent mutation
  const createPaymentIntent = useMutation({
    mutationFn: (requestId: number) => 
      ownerNightCreditApi.createPaymentIntent(requestId),
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create payment intent');
    }
  });

  // Cancel request mutation
  const cancelRequest = useMutation({
    mutationFn: (requestId: number) => 
      ownerNightCreditApi.cancelRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nightCreditRequests'] });
      toast.success('Request cancelled successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to cancel request');
    }
  });

  return {
    requests: requests || [],
    isLoading,
    refetch,
    createRequest,
    createPaymentIntent,
    cancelRequest
  };
}

/**
 * Hook for staff night credit operations
 */
export function useStaffNightCredits() {
  const queryClient = useQueryClient();

  // Get pending requests
  const { data: pendingRequests, isLoading, refetch } = useQuery({
    queryKey: ['staffNightCreditRequests'],
    queryFn: staffNightCreditApi.getPendingRequests
  });

  // Approve request mutation
  const approveRequest = useMutation({
    mutationFn: ({ requestId, notes }: { requestId: number; notes?: string }) =>
      staffNightCreditApi.approveRequest(requestId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffNightCreditRequests'] });
      toast.success('Request approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    }
  });

  // Reject request mutation
  const rejectRequest = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason: string }) =>
      staffNightCreditApi.rejectRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffNightCreditRequests'] });
      toast.success('Request rejected');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reject request');
    }
  });

  return {
    pendingRequests: pendingRequests || [],
    isLoading,
    refetch,
    approveRequest,
    rejectRequest
  };
}
