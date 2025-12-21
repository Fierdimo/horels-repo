import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import type { LoginRequest, RegisterRequest } from '@/types/api';

interface LoginOptions {
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export function useAuth() {
  const { token, user, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => authApi.login(credentials)
  });

  const registerMutation = useMutation({
    mutationFn: (userData: RegisterRequest) => authApi.register(userData),
    onSuccess: (data) => {
      // Save token and user data
      setAuth(data.token, data.user);
      localStorage.setItem('sw2_token', data.token);
      localStorage.setItem('sw2_user', JSON.stringify(data.user));
      
      // Will redirect based on status in RegisterWizard
    }
  });

  const logout = () => {
    authApi.logout();
    clearAuth();
    localStorage.removeItem('sw2_token');
    localStorage.removeItem('sw2_user');
    queryClient.clear();
    navigate('/login');
  };

  const login = (credentials: LoginRequest, options?: LoginOptions) => {
    loginMutation.mutate(credentials, {
      onSuccess: (data) => {
        
        // Set auth state
        setAuth(data.token, data.user);
        localStorage.setItem('sw2_token', data.token);
        localStorage.setItem('sw2_user', JSON.stringify(data.user));
        
        
        // Call custom success callback if provided
        options?.onSuccess?.();
        
        // Determine redirect based on role and status
        const redirectPath = getRoleBasedRedirect(data.user.role, data.user.status);
        navigate(redirectPath);
      },
      onError: (error) => {
        console.error('Login mutation error:', error);
        options?.onError?.(error);
      }
    });
  };

  return {
    user,
    token,
    isAuthenticated,
    login,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error
  };
}

function getRoleBasedRedirect(role: string, status?: string): string {
  // If user status is suspended, redirect to suspended page
  if (status === 'suspended') {
    return '/account-suspended';
  }

  // If user status is pending, redirect to pending approval page
  if (status === 'pending') {
    return '/pending-approval';
  }

  // Otherwise redirect based on role
  switch (role) {
    case 'owner':
      return '/owner/dashboard';
    case 'staff':
      return '/staff/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'guest':
      return '/guest/dashboard';
    default:
      return '/owner/dashboard';
  }
}
