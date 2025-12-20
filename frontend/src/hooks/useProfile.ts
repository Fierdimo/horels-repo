import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import type { User } from '@/types/models';

interface ProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
}

interface UseProfileReturn {
  profile: User | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (data: ProfileData) => Promise<void>;
  isUpdating: boolean;
}

export function useProfile(): UseProfileReturn {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuthStore();

  // Fetch current user profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', authUser?.id],
    queryFn: () => authApi.getCurrentUser(),
    enabled: !!authUser?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const result = await authApi.updateProfile(data);
      return result.user;
    },
    onSuccess: (updatedUser) => {
      // Invalidate profile query to refetch
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      // Update auth store with new user data
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.setState({
          user: {
            ...currentUser,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
            address: updatedUser.address,
          }
        });
      }
      
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
      throw error;
    }
  });

  return {
    profile: profile || null,
    isLoading,
    error: error instanceof Error ? error : null,
    updateProfile: async (data: ProfileData): Promise<void> => {
      await updateProfileMutation.mutateAsync(data);
    },
    isUpdating: updateProfileMutation.isPending
  };
}
