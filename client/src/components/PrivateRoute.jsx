import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// =============================================================================
// PrivateRoute — Protects routes that require authentication
// =============================================================================
// Why a wrapper component instead of inline checks in each page:
// Route protection is a cross-cutting concern — duplicating `if (!token)`
// checks in every page component is error-prone (one missed check = a
// security hole). A single wrapper component enforces the rule consistently.
//
// Why <Outlet /> instead of {children}:
// React Router v6 uses <Outlet /> for nested route rendering. This lets us
// wrap multiple child routes with one guard:
//   <Route element={<PrivateRoute />}>
//     <Route path="/dashboard" element={<DashboardPage />} />
//     <Route path="/history" element={<HistoryPage />} />
//   </Route>
// =============================================================================

/**
 * Loading spinner shown while the auth state is being hydrated from
 * localStorage. Extracted as a separate component to keep PrivateRoute's
 * render logic clean.
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

export default function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // Why show a spinner during loading instead of redirecting:
  // On page refresh, isLoading is true while we verify the stored token.
  // Without this check, the guard would see isAuthenticated=false (token
  // state hasn't been hydrated yet) and redirect to /login, then the
  // useEffect finishes and the user is authenticated — causing a visible
  // flash of the login page. The spinner prevents this jarring UX.
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Why <Navigate replace /> instead of window.location:
  // Navigate is React Router's declarative redirect. Using `replace` means
  // the login redirect doesn't add to browser history — pressing "back"
  // after logging in won't take the user back to the redirect, which would
  // just redirect them forward again (infinite back-button loop).
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
