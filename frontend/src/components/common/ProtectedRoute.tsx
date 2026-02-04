import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<"owner" | "guest" | "staff" | "admin">;
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore()
  
  console.log('🔒 ProtectedRoute check:');
  console.log('  - hasHydrated:', hasHydrated);
  console.log('  - isAuthenticated:', isAuthenticated);
  console.log('  - user:', user);
  console.log('  - user?.role:', user?.role);
  console.log('  - allowedRoles:', allowedRoles);

  // Wait for store to hydrate from localStorage before checking auth
  if (!hasHydrated) {
    console.log('⏳ Waiting for store to hydrate...');
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log('❌ Not authenticated - redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('❌ Role not allowed - redirecting to /unauthorized');
    console.log('  - User role:', user.role);
    console.log('  - Allowed roles:', allowedRoles);
    return <Navigate to="/unauthorized" replace />;
  }

  console.log('✅ Access granted');
  return <>{children}</>;
}
