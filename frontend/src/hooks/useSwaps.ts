import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { toast } from 'react-hot-toast';
import { useAuth } from './useAuth';
import type { CreateSwapRequest } from '@/types/api';

export function useSwaps() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  // ============================================================================
  // Owner Queries and Mutations
  // ============================================================================

  // Available swaps to browse
  const { data: availableSwaps, isLoading: availableLoading } = useQuery({
    queryKey: ['swaps', 'available'],
    queryFn: () => timeshareApi.getAvailableSwaps(),
    enabled: !isStaff,
    retry: 1
  });

  // Pending swaps created by the user
  const { data: pendingSwaps, isLoading: pendingLoading } = useQuery({
    queryKey: ['swaps', 'pending'],
    queryFn: () => timeshareApi.getPendingSwaps(),
    enabled: !isStaff,
    retry: 1
  });

  // User's own swaps
  const { data: swaps, isLoading, error } = useQuery({
    queryKey: ['swaps'],
    queryFn: () => timeshareApi.getSwaps(),
    enabled: !isStaff,
    retry: 1
  });

  // Search for compatible weeks
  const searchCompatibleMutation = useMutation({
    mutationFn: (weekId: number) => timeshareApi.searchCompatibleWeeks(weekId),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to search compatible weeks');
    }
  });

  // Create a new swap
  const createSwapMutation = useMutation({
    mutationFn: (request: CreateSwapRequest) => timeshareApi.createSwap(request),
    onSuccess: () => {
      toast.success('Swap created successfully');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['swaps', 'pending'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create swap');
    }
  });

  // Accept a swap as responder
  const acceptSwapMutation = useMutation({
    mutationFn: ({ swapId, responderWeekId }: { swapId: number | string; responderWeekId?: number | string }) => 
      timeshareApi.acceptSwap(swapId, responderWeekId),
    onSuccess: () => {
      toast.success('Swap accepted successfully');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['swaps', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to accept swap');
    }
  });

  // Reject a swap as responder
  const rejectSwapMutation = useMutation({
    mutationFn: (swapId: number) => timeshareApi.rejectSwap(swapId),
    onSuccess: () => {
      toast.success('Swap rejected');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to reject swap');
    }
  });

  // Create payment intent for swap fee
  const createPaymentIntentMutation = useMutation({
    mutationFn: (swapId: number) => timeshareApi.createSwapPaymentIntent(swapId),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create payment intent');
    }
  });

  // Confirm payment and complete swap
  const confirmPaymentMutation = useMutation({
    mutationFn: ({ swapId, paymentIntentId }: { swapId: number; paymentIntentId: string }) =>
      timeshareApi.confirmSwapPayment(swapId, paymentIntentId),
    onSuccess: () => {
      toast.success('Payment completed and swap finalized!');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to confirm payment');
    }
  });

  // ============================================================================
  // Staff Queries and Mutations
  // ============================================================================

  const { data: staffPendingSwaps, isLoading: staffPendingLoading } = useQuery({
    queryKey: ['staff', 'swaps', 'pending'],
    queryFn: timeshareApi.getStaffPendingSwaps,
    enabled: isStaff,
    retry: 1
  });

  const { data: staffSwaps, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', 'swaps'],
    queryFn: () => timeshareApi.getStaffSwaps(),
    enabled: isStaff,
    retry: 1
  });

  // Approve swap (staff)
  const approveSwapMutation = useMutation({
    mutationFn: ({ swapId, notes }: { swapId: number; notes?: string }) =>
      timeshareApi.approveSwap(swapId, notes),
    onSuccess: () => {
      toast.success('Swap approved');
      queryClient.invalidateQueries({ queryKey: ['staff', 'swaps'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'swaps', 'pending'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to approve swap');
    }
  });

  // Reject swap (staff)
  const rejectStaffSwapMutation = useMutation({
    mutationFn: ({ swapId, reason }: { swapId: number; reason: string }) =>
      timeshareApi.rejectStaffSwap(swapId, reason),
    onSuccess: () => {
      toast.success('Swap rejected');
      queryClient.invalidateQueries({ queryKey: ['staff', 'swaps'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'swaps', 'pending'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to reject swap');
    }
  });

  // ============================================================================
  // Return hooks
  // ============================================================================

  return {
    // Owner data
    swaps: swaps || [],
    isLoading,
    error,
    availableSwaps: availableSwaps || [],
    availableLoading,
    pendingSwaps: pendingSwaps || [],
    pendingLoading,

    // Owner mutations
    searchCompatible: searchCompatibleMutation.mutate,
    searchingCompatible: searchCompatibleMutation.isPending,
    compatibleWeeks: searchCompatibleMutation.data,

    createSwap: createSwapMutation.mutate,
    isCreating: createSwapMutation.isPending,

    acceptSwap: acceptSwapMutation.mutate,
    isAccepting: acceptSwapMutation.isPending,

    rejectSwap: rejectSwapMutation.mutate,
    isRejecting: rejectSwapMutation.isPending,

    createPaymentIntent: createPaymentIntentMutation.mutate,
    creatingPaymentIntent: createPaymentIntentMutation.isPending,
    paymentIntent: createPaymentIntentMutation.data,

    confirmPayment: confirmPaymentMutation.mutate,
    confirmingPayment: confirmPaymentMutation.isPending,

    // Staff data
    staffPendingSwaps: staffPendingSwaps || [],
    staffSwaps: staffSwaps || [],
    staffPendingLoading,
    staffLoading,

    // Staff mutations
    approveSwap: approveSwapMutation.mutate,
    approvingSwap: approveSwapMutation.isPending,

    rejectStaffSwap: rejectStaffSwapMutation.mutate,
    rejectingStaffSwap: rejectStaffSwapMutation.isPending
  };
}
