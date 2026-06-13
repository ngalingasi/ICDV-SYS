import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../store/authStore';

interface Props {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // Force password change
  if (user?.must_change_password && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role ?? '';
    if (userRole !== 'super_admin' && !allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}
