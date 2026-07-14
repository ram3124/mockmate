import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// =============================================================================
// AdminRoute — Protects routes that require admin role
// =============================================================================
// Why a separate AdminRoute instead of adding a `role` prop to PrivateRoute:
// The redirect behavior is fundamentally different — PrivateRoute sends
// unauthenticated users to /login, while AdminRoute sends authenticated-but-
// not-admin users to /dashboard. Combining both into one component with
// conditional logic would make it harder to read and maintain. Two simple
// components are clearer than one complex one.
// =============================================================================

/**
 * Loading spinner — same as PrivateRoute's spinner.
 * Why duplicate instead of importing from PrivateRoute: PrivateRoute doesn't
 * export its spinner (it's an internal implementation detail). Creating a
 * shared LoadingSpinner component would be cleaner in a larger app, but for
 * two usages, a small inline component avoids the overhead of another file.
 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <svg
        className="animate-spin h-10 w-10 text-primary-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export default function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Not logged in at all — send to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not an admin — redirect to dashboard instead of
  // showing a blank 403 page. Why dashboard? It's the most useful landing
  // page for a non-admin user, and showing an error page for a student who
  // accidentally navigated to an admin URL is poor UX.
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
