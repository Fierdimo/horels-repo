import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import type { ConfirmWeekRequest } from '@/types/api';

export function useWeeks() {
  const queryClient = useQueryClient();

  const { data: weeks, isLoading, error } = useQuery({
    queryKey: ['weeks'],
    queryFn: timeshareApi.getWeeks
  });

  const confirmWeekMutation = useMutation({
    mutationFn: ({ weekId, data }: { weekId: number; data: ConfirmWeekRequest }) =>
      timeshareApi.confirmWeek(weekId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
    }
  });

  const convertWeekMutation = useMutation({
    mutationFn: (weekId: number) => timeshareApi.convertWeek(weekId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
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
