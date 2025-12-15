import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import type { CreateSwapRequest, AcceptSwapRequest } from '@/types/api';

export function useSwaps() {
  const queryClient = useQueryClient();

  const { data: swaps, isLoading, error } = useQuery({
    queryKey: ['swaps'],
    queryFn: timeshareApi.getSwaps
  });

  const createSwapMutation = useMutation({
    mutationFn: (request: CreateSwapRequest) => timeshareApi.createSwap(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
    }
  });

  const acceptSwapMutation = useMutation({
    mutationFn: ({ swapId, data }: { swapId: number; data: AcceptSwapRequest }) =>
      timeshareApi.acceptSwap(swapId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swaps'] });
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
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
