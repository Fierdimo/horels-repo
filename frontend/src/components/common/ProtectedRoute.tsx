import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<'owner' | 'guest' | 'staff' | 'admin'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  console.log('[ProtectedRoute] Checking access:', { 
    isAuthenticated, 
    userRole: user?.role, 
    allowedRoles, 
    hasAccess: isAuthenticated && (!allowedRoles || (user && allowedRoles.includes(user.role)))
  });

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Redirecting to login: not authenticated');
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('[ProtectedRoute] Redirecting to unauthorized: user role not allowed');
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
