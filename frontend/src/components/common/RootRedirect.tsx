import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Redirect based on user role (only guest and staff)
  switch (user?.role) {
    case 'staff':
      return <Navigate to="/staff/dashboard" replace />;
    case 'guest':
      return <Navigate to="/guest/dashboard" replace />;
    default:
      return <Navigate to="/" replace />;
  }
}
