import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import HomePage from './pages/HomePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminQuestionsPage from './pages/AdminQuestionsPage';
import SessionPage from './pages/SessionPage';
import ReportPage from './pages/ReportPage'; // adjust name/path as needed

// =============================================================================
// RootRedirect
// =============================================================================
// Smart routing based on auth state. Avoids empty blank white flashes by 
// rendering a styled loading spinner during initial session validation.
// =============================================================================
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="auth-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-surface-200/60 text-xs sm:text-sm animate-pulse tracking-wide">
            Syncing session with MockMate...
          </p>
        </div>
      </div>
    );
  }
  
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <>
      {/* Global Toast Notification System Container */}
      <Toaster 
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          className: 'text-sm font-medium rounded-xl border border-white/10 backdrop-blur-md px-4 py-2.5 max-w-[90vw] sm:max-w-md',
          style: {
            background: 'rgba(20, 20, 25, 0.85)',
            color: '#f4f4f5',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        {/* Public routes — accessible without authentication */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes — require authentication (any role) */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="/session/:sessionId/report" element={<ReportPage />} />
        </Route>

        {/* Admin routes — require authentication + admin role */}
        <Route element={<AdminRoute />}>
          <Route path="/admin/questions" element={<AdminQuestionsPage />} />
        </Route>

        {/* Root redirect — smart routing based on auth state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Catch-all — send unknown paths to root for re-evaluation */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;