import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { toast } from 'react-hot-toast';
import type { CreateSwapRequest, AcceptSwapRequest } from '@/types/api';

export function useSwaps() {
  const queryClient = useQueryClient();

  const { data: swaps, isLoading, error } = useQuery({
    queryKey: ['swaps'],
    queryFn: timeshareApi.getSwaps,
    retry: 1
  });

  const createSwapMutation = useMutation({
    mutationFn: (request: CreateSwapRequest) => timeshareApi.createSwap(request),
    onSuccess: () => {
      toast.success('Swap created successfully');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create swap');
    }
  });

  const acceptSwapMutation = useMutation({
    mutationFn: ({ swapId, data }: { swapId: number; data: AcceptSwapRequest }) =>
      timeshareApi.acceptSwap(swapId, data),
    onSuccess: () => {
      toast.success('Swap accepted successfully');
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to accept swap');
    }
  });

  return {
    swaps: swaps || [],
    isLoading,
    error,
    createSwap: createSwapMutation.mutate,
    acceptSwap: acceptSwapMutation.mutate,
    isCreating: createSwapMutation.isPending,
    isAccepting: acceptSwapMutation.isPending
  };
}
