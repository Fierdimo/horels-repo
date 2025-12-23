import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { toast } from 'react-hot-toast';
import type { ConfirmWeekRequest } from '@/types/api';

export function useWeeks(filter?: 'all' | 'available') {
  const queryClient = useQueryClient();

  const { data: weeks, isLoading, error } = useQuery({
    queryKey: ['weeks', filter],
    queryFn: () => timeshareApi.getWeeks(filter),
    retry: 1
  });

  const confirmWeekMutation = useMutation({
    mutationFn: ({ weekId, data }: { weekId: number; data: ConfirmWeekRequest }) =>
      timeshareApi.confirmWeek(weekId, data),
    onSuccess: () => {
      toast.success('Week confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to confirm week');
    }
  });

  const convertWeekMutation = useMutation({
    mutationFn: (weekId: number) => timeshareApi.convertWeek(weekId),
    onSuccess: () => {
      toast.success('Week converted successfully');
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to convert week');
    }
  });

  return {
    weeks: weeks || [],
    isLoading,
    error,
    confirmWeek: confirmWeekMutation.mutate,
    convertWeek: convertWeekMutation.mutate,
    isConfirming: confirmWeekMutation.isPending,
    isConverting: convertWeekMutation.isPending
  };
}
